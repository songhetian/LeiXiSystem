import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException, BadRequestException, ForbiddenException, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService, scopeIsEmpty } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { calculatePayroll, assertPayrollBalanced, type PayrollConfig } from './engine/payroll-engine';
import { fromCents, toCents } from '../common/money.util';
import { PayslipService } from './payslip.service';
import { NotificationClientInterface } from '../notification/notification-client.interface';
import { ERROR_CODES } from '../common/error-codes';
import { DistributedLockService, LockAcquisitionError } from '../common/distributed-lock.service';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

const LOCK_TTL_MS = 120_000;
/** 算薪创建事务超时：批量取数后事务内只剩写操作，但仍需容纳上百员工的明细写入 */
const CREATE_RUN_TX_TIMEOUT_MS = 30_000;
/** 批次列表允许的月份格式（YYYY-MM） */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 批次状态枚举（与 Prisma PayrollRunStatus 一致，非法值按参数错误处理） */
const RUN_STATUSES = ['draft', 'confirmed', 'published', 'recalled'] as const;
type RunStatusValue = (typeof RUN_STATUSES)[number];
/** 通知投递重试：最多 3 次，退避 1s / 2s（调用方在 setImmediate 内，不阻塞主请求） */
const NOTIFY_MAX_ATTEMPTS = 3;
const NOTIFY_RETRY_DELAYS_MS = [1_000, 2_000];
/** 缺月报阻断时最多列出的员工数 */
const MISSING_EMPLOYEE_DETAIL_LIMIT = 5;

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private payslipService: PayslipService,
    @Inject('NOTIFICATION_CLIENT') private notificationService: NotificationClientInterface,
    private lockService: DistributedLockService,
    private eventEmitter: EventEmitter2,
  ) {}

  private readonly payrollConfig: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
    lateDeductionPerTime: 50,
    earlyDeductionPerTime: 50,
  };

  /**
   * 取某员工在指定计薪月的生效基础工资。
   * 规则（CONTEXT.md）：发薪为「本月发上月」，薪资变更自带生效月。
   * 取「生效月 ≤ 计薪月」的最新一条薪资调整（同一生效月按更新时间倒序取最新）；
   * 无任何调整记录时回退员工当前薪资（初始工资），即默认次月生效。
   *
   * 取数异常一律向上抛出（非 HttpException 由全局过滤器按 500/5000 留痕）：
   * 此前吞掉异常并回退「员工当前薪资」会在 DB 故障时按错误基数计薪，
   * 且故障被静默掩盖，对账时无法追溯。
   */
  async getEffectiveSalary(
    employeeId: number,
    month: string,
    fallback: number,
  ): Promise<number> {
    const adj = await this.prisma.salaryAdjustment.findFirst({
      where: {
        employeeId,
        effectiveMonth: { lte: month },
      },
      orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
    });
    return adj ? Number(adj.amount) : fallback;
  }

  async createRun(month: string, userId: number) {
    return this.lockService.withLock(`payroll:create:${month}`, LOCK_TTL_MS, async () => {
      const existing = await this.prisma.payrollRun.findUnique({ where: { month } });
      if (existing) {
        throw new ConflictException({ code: ERROR_CODES.PAYROLL_RUN_EXISTS, message: '该月份算薪批次已存在' });
      }

      const confirmedMonthlies = await this.prisma.attendanceMonthly.findMany({
        where: { month, status: 'confirmed' },
        include: { employee: true },
      });

      if (confirmedMonthlies.length === 0) {
        throw new ConflictException({ code: ERROR_CODES.PAYROLL_MONTHLY_NOT_CONFIRMED, message: '该月份考勤月报尚未确认' });
      }

      // C5（决策 D6①）：在职员工缺当月已确认月报会静默漏发，创建前直接阻断
      await this.assertAllActiveEmployeesCovered(confirmedMonthlies.map((m) => m.employeeId));

      // B6：事务前一次性批量取「生效月 ≤ 计薪月」的薪资调整，
      // 事务内只做写操作，避免上百员工时交互式事务超时（P2028）。
      const employeeIds = Array.from(new Set(confirmedMonthlies.map((m) => m.employeeId)));
      const salaryAdjustments = employeeIds.length > 0
        ? await this.prisma.salaryAdjustment.findMany({
            where: { employeeId: { in: employeeIds }, effectiveMonth: { lte: month } },
            orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
          })
        : [];
      // 结果已按生效月/创建时间倒序，同一员工取首条即「生效月 ≤ 计薪月」的最新一条
      const effectiveSalaryMap = new Map<number, number>();
      for (const adj of salaryAdjustments) {
        if (!effectiveSalaryMap.has(adj.employeeId)) {
          effectiveSalaryMap.set(adj.employeeId, Number(adj.amount));
        }
      }

      let run;
      try {
        run = await this.prisma.$transaction(async (tx) => {
          const createdRun = await tx.payrollRun.create({
            data: { month, status: 'draft' },
          });

          // 金额全程以「分」定点累加，写库边界统一转 Prisma.Decimal，杜绝浮点漂移
          let totalCents = 0;
          const detailData: Array<{
            runId: number;
            employeeId: number;
            itemCode: string;
            itemName: string;
            amount: Prisma.Decimal;
          }> = [];
          for (const m of confirmedMonthlies) {
            // 取计薪月生效薪资（默认次月生效），无调整记录回退员工当前薪资
            const basicSalary =
              effectiveSalaryMap.get(m.employeeId) ?? Number(m.employee.salary);
            const result = calculatePayroll(
              { name: m.employee.name, basicSalary },
              {
                workDays: Number(m.workDays),
                scheduledDays: Number(m.workDays) + Number(m.absentDays),
                absentDays: Number(m.absentDays),
                lateCount: m.lateCount,
                earlyCount: m.earlyCount,
                // 全勤奖只被「无薪假」取消：有薪假（年假/病假等）不影响全勤
                noLeave: Number(m.unpaidLeaveMinutes) === 0,
                // 加班按日类型分桶取 1.5 / 2 / 3 倍；此处不得再退化成单一桶
                overtimeHours: {
                  weekday: Number(m.overtimeWeekdayHours),
                  weekend: Number(m.overtimeWeekendHours),
                  holiday: Number(m.overtimeHolidayHours),
                },
              },
              this.payrollConfig,
            );

            for (const item of result.items) {
              detailData.push({
                runId: createdRun.id,
                employeeId: m.employeeId,
                itemCode: item.code,
                itemName: item.name,
                amount: new Prisma.Decimal(fromCents(toCents(item.amount)).toFixed(2)),
              });
            }
            totalCents += toCents(result.total);
          }

          // 对账断言：明细定点累加必须等于批次总额，不等即抛错回滚事务
          assertPayrollBalanced(
            detailData.map((d) => d.amount.toNumber()),
            fromCents(totalCents),
          );

          if (detailData.length > 0) {
            await tx.payrollDetail.createMany({ data: detailData });
          }

          const updatedRun = await tx.payrollRun.update({
            where: { id: createdRun.id },
            data: {
              totalEmployees: confirmedMonthlies.length,
              totalAmount: new Prisma.Decimal(fromCents(totalCents).toFixed(2)),
            },
          });

          return updatedRun;
        }, { timeout: CREATE_RUN_TX_TIMEOUT_MS });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException({ code: ERROR_CODES.PAYROLL_RUN_EXISTS, message: '该月份算薪批次已存在' });
        }
        throw err;
      }

      return run;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException(
          { code: err.code, message: err.message },
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    });
  }

  async listRuns(params: {
    userId: number;
    page: number;
    pageSize: number;
    month?: string;
    status?: string;
  }) {
    const { userId, page, pageSize, month, status } = params;

    // B2：筛选参数校验（空串视同未传，避免前端清空筛选框后变成非法参数）
    if (month) {
      if (!MONTH_PATTERN.test(month)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '月份格式不合法，应为 YYYY-MM' });
      }
    }
    if (status && !RUN_STATUSES.includes(status as RunStatusValue)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '批次状态不合法' });
    }

    // IDOR fix: filter runs by data scope
    const scope = await this.dataScope.visibleScope(userId);
    // fail-closed：既非全量、又无部门范围、又未关联员工 → 无任何可见数据。
    // 此前 where 会保持 undefined 变成「不过滤」，把全公司批次连同总额/人数一并返回。
    if (scopeIsEmpty(scope)) {
      return { list: [], total: 0, page, pageSize };
    }

    // 筛选条件与数据权限条件「合并」而非覆盖：任一侧条件丢失都会造成越权或筛了却没生效
    const where: Prisma.PayrollRunWhereInput = {};
    if (month) where.month = month;
    if (status) where.status = status as RunStatusValue;

    // B8（决策 D5①）：可见性按「明细所属员工/部门」判定，与 getRunDetails 一致。
    // 不再依赖 payslip.runId——草稿/已确认批次还没有工资条，主管会整批看不到。
    if (scope.selfEmployeeId) {
      where.details = { some: { employeeId: scope.selfEmployeeId } };
    } else if (!scope.all) {
      where.details = { some: { employee: { departmentId: { in: scope.ids } } } };
    }

    // 无任何条件时保持 undefined（Prisma 语义等价，但避免无谓的 where: {}）
    const effectiveWhere = Object.keys(where).length > 0 ? where : undefined;

    const [list, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where: effectiveWhere,
        orderBy: { month: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payrollRun.count({ where: effectiveWhere }),
    ]);
    return { list, total, page, pageSize };
  }

  async getRunDetails(runId: number, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
    }

    const scope = await this.dataScope.visibleScope(userId);

    const [details, adjustments] = await Promise.all([
      this.prisma.payrollDetail.findMany({
        where: { runId },
        include: {
          employee: { select: { id: true, employeeNo: true, name: true, departmentId: true } },
        },
        orderBy: [{ employeeId: 'asc' }, { itemCode: 'asc' }],
      }),
      this.prisma.payrollAdjustment.findMany({
        where: { runId },
        include: {
          employee: { select: { id: true, employeeNo: true, name: true, departmentId: true } },
        },
        orderBy: [{ employeeId: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    // IDOR fix: filter details/adjustments by data scope
    const isEmployeeVisible = (emp: { id: number; departmentId?: number | null }) => {
      if (scope.all) return true;
      if (scope.selfEmployeeId) return emp.id === scope.selfEmployeeId;
      if (scope.ids.length > 0) return emp.departmentId != null && scope.ids.includes(emp.departmentId);
      return false;
    };

    const visibleDetails = details.filter((d) => isEmployeeVisible(d.employee));
    const visibleAdjustments = adjustments.filter((a) => isEmployeeVisible(a.employee));

    // 批次级 fail-closed：非全量用户若在该批次里看不到任何明细/调整项，说明这个批次
    // 与他毫无关系（例如传他人 runId 探路），此时不得返回批次记录本身
    // （totalAmount / totalEmployees 属于批次汇总）。这与「部分可见则按范围过滤」并存：
    // 部门主管仍能查看自己部门员工所在的批次，只是看不到范围外的明细。
    if (scopeIsEmpty(scope) || (!scope.all && visibleDetails.length === 0 && visibleAdjustments.length === 0)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看该算薪批次' });
    }

    const grouped = new Map<number, { employee: any; items: any[]; adjustments: any[]; totalCents: number }>();
    for (const d of visibleDetails) {
      if (!grouped.has(d.employeeId)) {
        grouped.set(d.employeeId, { employee: d.employee, items: [], adjustments: [], totalCents: 0 });
      }
      const g = grouped.get(d.employeeId)!;
      g.items.push({ code: d.itemCode, name: d.itemName, amount: Number(d.amount) });
      // 定点累加：先转整数分再相加，避免逐笔浮点累加漂移
      g.totalCents += toCents(Number(d.amount));
    }

    for (const a of visibleAdjustments) {
      if (!grouped.has(a.employeeId)) {
        grouped.set(a.employeeId, { employee: a.employee, items: [], adjustments: [], totalCents: 0 });
      }
      const g = grouped.get(a.employeeId)!;
      g.adjustments.push({
        id: a.id,
        itemCode: a.itemCode,
        amount: Number(a.amount),
        reason: a.reason,
        createdAt: a.createdAt,
      });
      g.totalCents += toCents(Number(a.amount));
    }

    const employees = Array.from(grouped.values()).map(({ totalCents, ...g }) => ({
      ...g,
      total: fromCents(totalCents),
    }));

    return { run, employees };
  }

  async confirmRun(runId: number, userId: number, checkedEmployeeIds?: number[]) {
    return this.lockService.withLock(`payroll:confirm:${runId}`, LOCK_TTL_MS, async () => {
      if (!checkedEmployeeIds || checkedEmployeeIds.length < 3) {
        throw new BadRequestException({ code: ERROR_CODES.PAYROLL_CHECK_INSUFFICIENT, message: '确认前必须抽检至少3名员工对账' });
      }

      const validCount = await this.prisma.payrollDetail.groupBy({
        by: ['employeeId'],
        where: { runId, employeeId: { in: checkedEmployeeIds } },
      });
      if (validCount.length !== checkedEmployeeIds.length) {
        throw new BadRequestException({ code: ERROR_CODES.PAYROLL_CHECK_EMPLOYEE_INVALID, message: '抽检员工ID不在本批次薪资明细中' });
      }

      await this.assertRunInScope(runId, userId);

      const updated = await this.prisma.payrollRun.updateMany({
        where: { id: runId, status: 'draft' },
        data: {
          status: 'confirmed',
          checkedEmployeeIds: checkedEmployeeIds,
          checkedBy: userId,
          checkedAt: new Date(),
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
        if (!run) {
          throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
        }
        throw new ConflictException({ code: ERROR_CODES.PAYROLL_STATUS_INVALID, message: '仅草稿状态可确认' });
      }
      const confirmedRun = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
      if (confirmedRun) {
        this.emitPayrollStatusChanged(confirmedRun, 'draft');
      }
      return confirmedRun;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  async publishRun(runId: number, userId: number) {
    return this.lockService.withLock(`payroll:publish:${runId}`, LOCK_TTL_MS, async () => {
      await this.assertRunInScope(runId, userId);

      let run: any;
      const updated = await this.prisma.$transaction(async (tx) => {
        const runResult = await tx.payrollRun.updateMany({
          where: { id: runId, status: 'confirmed' },
          data: { status: 'published', publishedBy: userId, publishedAt: new Date() },
        });
        if (runResult.count === 0) {
          const existing = await tx.payrollRun.findUnique({ where: { id: runId } });
          if (!existing) {
            throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
          }
          throw new ConflictException({ code: ERROR_CODES.PAYROLL_STATUS_INVALID, message: '仅已确认状态可发布' });
        }
        const r = await tx.payrollRun.findUnique({ where: { id: runId } });
        if (r) run = r;
        await this.payslipService.generateFromRun(runId, tx);
        return r;
      });

      setImmediate(async () => {
        try {
          const payslips = await this.prisma.payslip.findMany({
            where: { runId },
            select: { employee: { select: { userId: true } } },
          });
          for (const p of payslips) {
            const userId = p.employee?.userId;
            if (!userId) continue;
            // C8：单条通知投递失败重试，全部失败只留痕，不拖垮整批发布
            await this.deliverWithRetry(
              `工资条发布通知 run=${runId} userId=${userId}`,
              () =>
                this.notificationService.create({
                  userId,
                  title: '工资条已发布',
                  content: `您${run.month}月的工资条已发布，请前往工资条页面查看`,
                  type: 'payslip',
                  relatedId: runId,
                  relatedType: 'payroll_run',
                }),
            );
          }
        } catch (err) {
          this.logger.error(
            `Failed to create payslip-published notifications for run ${runId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });

      if (run) {
        this.emitPayrollStatusChanged(run, 'confirmed');
      }

      return updated;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  async recallRun(runId: number, userId: number) {
    return this.lockService.withLock(`payroll:recall:${runId}`, LOCK_TTL_MS, async () => {
      const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
      }

      await this.assertRunInScope(runId, userId);

      if (run.status !== 'published') {
        throw new ConflictException({ code: ERROR_CODES.PAYROLL_STATUS_INVALID, message: '仅已发布状态可撤回' });
      }

      // B7：状态变更、viewed 复查与工资条删除必须同事务提交（与 publishRun 对称）：
      // - viewed 复查若留在事务外，员工在「count 之后、update 之前」查看工资条会被漏判，
      //   撤回后已查看的工资条被删，审计口径直接失真；
      // - 删条失败时也不能留下「批次已 recalled、工资条仍在库」的错账。
      const updated = await this.prisma.$transaction(async (tx) => {
        const viewedCount = await tx.payslip.count({ where: { runId, status: 'viewed' } });
        if (viewedCount > 0) {
          // 「已查看工资条不可撤回」是撤回策略的专属失败原因，不能复用 3005
          // （EMPLOYEE_NO_SALARY 员工无工资配置），否则前端无法据此给出正确提示。
          throw new UnprocessableEntityException({ code: ERROR_CODES.PAYROLL_RECALL_VIEWED, message: '存在已查看的工资条，不可撤回' });
        }

        // 条件更新：状态在此期间被他人改变时 count=0，不再无条件覆盖
        const stateResult = await tx.payrollRun.updateMany({
          where: { id: runId, status: 'published' },
          data: { status: 'recalled', recalledBy: userId, recalledAt: new Date() },
        });
        if (stateResult.count === 0) {
          const existing = await tx.payrollRun.findUnique({ where: { id: runId } });
          if (!existing) {
            throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
          }
          throw new ConflictException({ code: ERROR_CODES.PAYROLL_STATUS_INVALID, message: '仅已发布状态可撤回' });
        }

        // 事务内已复查过 viewed，此处可全删
        await tx.payslip.deleteMany({ where: { runId } });

        return tx.payrollRun.findUnique({ where: { id: runId } });
      });

      // 工资条已删除，发布时发出的「工资条已发布」通知必须同步清理，
      // 否则用户点开通知会落到已不存在的单据（C8：清理失败重试，最终只留痕）
      await this.deliverWithRetry(
        `撤回批次通知清理 run=${runId}`,
        () => this.notificationService.removeByRelated('payroll_run', runId),
      );

      if (updated) {
        this.emitPayrollStatusChanged(updated, 'published');
      }

      return updated;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
    });
  }

  /**
   * C5（决策 D6①）：在职员工必须都有当月已确认的考勤月报。
   * 缺月报的员工会被算薪静默漏发（名单里查无此人，工资条也不会生成），
   * 因此在创建批次前阻断并回传缺失名单（工号+姓名，最多 5 人）。
   *
   * 「在职」口径：Employee.status = active（probation/resigned/retired 不计）；
   * Employee 无软删列（schema 未定义 deletedAt），故不需额外的软删过滤。
   */
  private async assertAllActiveEmployeesCovered(monthlyEmployeeIds: number[]) {
    const activeEmployees = await this.prisma.employee.findMany({
      where: { status: 'active' },
      select: { id: true, employeeNo: true, name: true },
    });
    const covered = new Set(monthlyEmployeeIds);
    const missing = activeEmployees.filter((e) => !covered.has(e.id));
    if (missing.length === 0) return;

    const shown = missing
      .slice(0, MISSING_EMPLOYEE_DETAIL_LIMIT)
      .map((e) => `${e.employeeNo} ${e.name}`)
      .join('、');
    const detail =
      missing.length > MISSING_EMPLOYEE_DETAIL_LIMIT
        ? `${shown} 等 ${missing.length} 人`
        : shown;

    throw new UnprocessableEntityException({
      code: ERROR_CODES.PAYROLL_MONTHLY_EMPLOYEE_MISSING,
      message: '部分在职员工缺少已确认的考勤月报，无法生成工资批次',
      // detail 由全局过滤器拼在中央文案之后，供 HR 直接定位补确认对象
      detail,
    });
  }

  /**
   * Scope 校验：验证算薪批次中的所有员工在调用者数据范围内
   * - scope.all → 直接通过
   * - scope.selfEmployeeId → 批次中不得包含非本人员工
   * - scope.ids (部门列表) → 批次中不得包含非范围内部门的员工
   */
  private async assertRunInScope(runId: number, userId: number) {
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.all) return;

    // fail-closed：无任何可见范围的用户不得操作/查看任何批次
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作该算薪批次' });
    }

    const employees = await this.prisma.payrollDetail.findMany({
      where: { runId },
      select: { employeeId: true, employee: { select: { departmentId: true } } },
      distinct: ['employeeId'],
    });

    if (scope.selfEmployeeId) {
      const hasOthers = employees.some((e) => e.employeeId !== scope.selfEmployeeId);
      if (hasOthers) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作包含非本人员工的算薪批次' });
      }
    } else if (scope.ids.length > 0) {
      const hasOutOfScope = employees.some(
        (e) => !e.employee?.departmentId || !scope.ids.includes(e.employee.departmentId),
      );
      if (hasOutOfScope) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作包含非本部门员工的算薪批次' });
      }
    }
  }

  /**
   * 批次状态发生可作为薪资核算结果的变更后，广播事件以清除人力成本报表缓存。
   * @param from 变更前状态
   */
  private emitPayrollStatusChanged(run: { id: number; month: string; status: string }, from: string) {
    this.eventEmitter.emit(EVENT_PAYROLL_STATUS_CHANGED, {
      runId: run.id,
      month: run.month,
      status: run.status,
      from,
      to: run.status,
    });
  }

  /**
   * 通知投递有限重试（C8）：最多 3 次，失败按 1s / 2s 退避。
   * 不引入 outbox 表，全部失败仅 logger.error 留痕；调用方在 setImmediate 内，
   * 因此退避不会阻塞主请求。
   */
  private async deliverWithRetry<T>(label: string, deliver: () => Promise<T>): Promise<T | undefined> {
    for (let attempt = 1; attempt <= NOTIFY_MAX_ATTEMPTS; attempt++) {
      try {
        return await deliver();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        if (attempt >= NOTIFY_MAX_ATTEMPTS) {
          this.logger.error(`通知投递失败（已重试 ${attempt} 次）：${label}：${reason}`);
          return undefined;
        }
        this.logger.warn(`通知投递失败，${NOTIFY_RETRY_DELAYS_MS[attempt - 1]}ms 后重试：${label}：${reason}`);
        await new Promise((resolve) => setTimeout(resolve, NOTIFY_RETRY_DELAYS_MS[attempt - 1]));
      }
    }
    return undefined;
  }

  /**
   * 薪资项目列表：统一分页信封 { list, total, page, pageSize }
   * （前端按 ListResult.data.list 读取，此前返回裸数组导致调整项入口恒为空）。
   * status=active → 只返回启用项；其它值按「未指定」处理（不下发条件），
   * 与工资条列表的容错口径一致：脏值不应把列表筛成空。
   */
  async listSalaryItems(params: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = params;
    const where: Prisma.SalaryItemWhereInput = status === 'active' ? { enabled: true } : {};

    const [list, total] = await Promise.all([
      this.prisma.salaryItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salaryItem.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createSalaryItem(data: {
    code: string;
    name: string;
    type: string;
    amount?: number;
    rate?: number;
    formula?: string;
    sortOrder?: number;
  }) {
    const existing = await this.prisma.salaryItem.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException({ code: ERROR_CODES.SALARY_ITEM_DUPLICATE, message: '薪资项目编码已存在' });
    }
    if (data.amount !== undefined && data.amount < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '薪资项目金额不能为负' });
    }
    if (data.rate !== undefined && data.rate < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '薪资项目比例不能为负' });
    }
    return this.prisma.salaryItem.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
        rate: data.rate !== undefined ? new Prisma.Decimal(data.rate) : undefined,
        formula: data.formula,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateSalaryItem(id: number, data: {
    name?: string;
    type?: string;
    amount?: number;
    rate?: number;
    formula?: string;
    sortOrder?: number;
  }) {
    const item = await this.prisma.salaryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException({ code: ERROR_CODES.SALARY_ITEM_NOT_FOUND, message: '薪资项目不存在' });
    }
    if (data.amount !== undefined && data.amount < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '薪资项目金额不能为负' });
    }
    if (data.rate !== undefined && data.rate < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '薪资项目比例不能为负' });
    }
    return this.prisma.salaryItem.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
        rate: data.rate !== undefined ? new Prisma.Decimal(data.rate) : undefined,
        formula: data.formula,
        sortOrder: data.sortOrder,
      },
    });
  }

  async toggleSalaryItem(id: number, enabled: boolean) {
    const item = await this.prisma.salaryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException({ code: ERROR_CODES.SALARY_ITEM_NOT_FOUND, message: '薪资项目不存在' });
    }
    return this.prisma.salaryItem.update({
      where: { id },
      data: { enabled },
    });
  }

  async addAdjustment(runId: number, data: {
    employeeId: number;
    itemCode: string;
    itemName?: string;
    amount: number;
    reason: string;
  }, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
    }
    if (run.status !== 'draft') {
      throw new UnprocessableEntityException({ code: ERROR_CODES.PAYROLL_STATUS_INVALID, message: '仅草稿状态可添加调整项' });
    }

    // IDOR fix: verify the employee is in the caller's data scope
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== data.employeeId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工添加调整项' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工添加调整项' });
      }
    }
    // 既无 admin/hr 全量权限、又无部门范围、又未关联员工 → 该用户无任何数据可见范围，
    // 不应静默放行为任意员工添加调整项（否则可为他人工资加钱，构成横向越权）。
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工添加调整项' });
    }

    const adjustment = await this.prisma.payrollAdjustment.create({
      data: {
        runId,
        employeeId: data.employeeId,
        itemCode: data.itemCode,
        amount: new Prisma.Decimal(data.amount),
        reason: data.reason,
        createdBy: userId,
      },
    });

    return adjustment;
  }
}
