import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException, BadRequestException, ForbiddenException, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { calculatePayroll, assertPayrollBalanced, type PayrollConfig } from './engine/payroll-engine';
import { fromCents, toCents } from '../common/money.util';
import { PayslipService } from './payslip.service';
import { NotificationClientInterface } from '../notification/notification-client.interface';
import { ERROR_CODES } from '../common/error-codes';
import { DistributedLockService, LockAcquisitionError } from '../common/distributed-lock.service';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

const LOCK_TTL_MS = 120_000;

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
   */
  async getEffectiveSalary(
    employeeId: number,
    month: string,
    fallback: number,
  ): Promise<number> {
    try {
      const adj = await this.prisma.salaryAdjustment.findFirst({
        where: {
          employeeId,
          effectiveMonth: { lte: month },
        },
        orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
      });
      if (adj) {
        return Number(adj.amount);
      }
    } catch (err) {
      this.logger.warn(
        `读取薪资生效月失败，回退员工当前薪资：employeeId=${employeeId}, month=${month}`,
      );
    }
    return fallback;
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
            const basicSalary = await this.getEffectiveSalary(
              m.employeeId,
              month,
              Number(m.employee.salary),
            );
            const result = calculatePayroll(
              { name: m.employee.name, basicSalary },
              {
                workDays: Number(m.workDays),
                scheduledDays: Number(m.workDays) + Number(m.absentDays),
                absentDays: Number(m.absentDays),
                lateCount: m.lateCount,
                earlyCount: m.earlyCount,
                noLeave: m.leaveMinutes === 0,
                overtimeHours: {
                  weekday: Number(m.overtimeHours),
                  weekend: 0,
                  holiday: 0,
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
        });
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

  async listRuns(params: { userId: number; page: number; pageSize: number }) {
    const { userId, page, pageSize } = params;

    // IDOR fix: filter runs by data scope
    const scope = await this.dataScope.visibleScope(userId);
    let where: any = undefined;

    if (scope.selfEmployeeId) {
      // For self-only scope, only show runs where the employee has a payslip
      const payslipRuns = await this.prisma.payslip.findMany({
        where: { employeeId: scope.selfEmployeeId },
        select: { runId: true },
        distinct: ['runId'],
      });
      const runIds = payslipRuns.map((p) => p.runId);
      where = { id: { in: runIds } };
    } else if (!scope.all && scope.ids.length > 0) {
      // For manager scope, show runs where any employee in their department has a payslip
      const empRuns = await this.prisma.payslip.findMany({
        where: { employee: { departmentId: { in: scope.ids } } },
        select: { runId: true },
        distinct: ['runId'],
      });
      const runIds = empRuns.map((p) => p.runId);
      where = { id: { in: runIds } };
    }

    const [list, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        orderBy: { month: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payrollRun.count({ where }),
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
            if (!p.employee?.userId) continue;
            await this.notificationService.create({
              userId: p.employee.userId,
              title: '工资条已发布',
              content: `您${run.month}月的工资条已发布，请前往工资条页面查看`,
              type: 'payslip',
              relatedId: runId,
              relatedType: 'payroll_run',
            });
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

      const viewedCount = await this.prisma.payslip.count({
        where: { runId, status: 'viewed' },
      });
      if (viewedCount > 0) {
        // 「已查看工资条不可撤回」是撤回策略的专属失败原因，不能复用 3005
        // （EMPLOYEE_NO_SALARY 员工无工资配置），否则前端无法据此给出正确提示。
        throw new UnprocessableEntityException({ code: ERROR_CODES.PAYROLL_RECALL_VIEWED, message: '存在已查看的工资条，不可撤回' });
      }

      // 状态变更与工资条删除必须同事务提交（与 publishRun 对称）：
      // 否则删条失败时批次已成 recalled、工资条却仍在库，listPayslips 不校验批次状态，
      // 员工会继续查到一个「已撤回批次」的工资条。
      const updated = await this.prisma.$transaction(async (tx) => {
        const rec = await tx.payrollRun.update({
          where: { id: runId },
          data: { status: 'recalled', recalledBy: userId, recalledAt: new Date() },
        });

        await tx.payslip.deleteMany({ where: { runId } });

        return rec;
      });

      // 工资条已删除，发布时发出的「工资条已发布」通知必须同步清理，
      // 否则用户点开通知会落到已不存在的单据
      await this.notificationService.removeByRelated('payroll_run', runId);

      this.emitPayrollStatusChanged(updated, 'published');

      return updated;
    }).catch((err) => {
      if (err instanceof LockAcquisitionError) {
        throw new HttpException({ code: err.code, message: err.message }, HttpStatus.CONFLICT);
      }
      throw err;
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

  async listSalaryItems() {
    return this.prisma.salaryItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
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
