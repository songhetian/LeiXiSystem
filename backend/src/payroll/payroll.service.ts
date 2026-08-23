import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException, BadRequestException, ForbiddenException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { calculatePayroll, type PayrollConfig } from './engine/payroll-engine';
import { PayslipService } from './payslip.service';
import { NotificationService } from '../notification/notification.service';
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
    private notificationService: NotificationService,
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

  async createRun(month: string, userId: number) {
    return this.lockService.withLock(`payroll:create:${month}`, LOCK_TTL_MS, async () => {
      const existing = await this.prisma.payrollRun.findUnique({ where: { month } });
      if (existing) {
        throw new ConflictException({ code: 3001, message: '该月份算薪批次已存在' });
      }

      const confirmedMonthlies = await this.prisma.attendanceMonthly.findMany({
        where: { month, status: 'confirmed' },
        include: { employee: true },
      });

      if (confirmedMonthlies.length === 0) {
        throw new ConflictException({ code: 3002, message: '该月份考勤月报尚未确认' });
      }

      let run;
      try {
        run = await this.prisma.$transaction(async (tx) => {
          const createdRun = await tx.payrollRun.create({
            data: { month, status: 'draft' },
          });

          let totalAmount = 0;
          const detailData: Array<{
            runId: number;
            employeeId: number;
            itemCode: string;
            itemName: string;
            amount: number;
          }> = [];
          for (const m of confirmedMonthlies) {
            const basicSalary = Number(m.employee.salary);
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
                amount: item.amount,
              });
            }
            totalAmount += result.total;
          }

          if (detailData.length > 0) {
            await tx.payrollDetail.createMany({ data: detailData });
          }

          const updatedRun = await tx.payrollRun.update({
            where: { id: createdRun.id },
            data: {
              totalEmployees: confirmedMonthlies.length,
              totalAmount: Math.round(totalAmount * 100) / 100,
            },
          });

          return updatedRun;
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException({ code: 3001, message: '该月份算薪批次已存在' });
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
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
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

    const grouped = new Map<number, { employee: any; items: any[]; adjustments: any[]; total: number }>();
    for (const d of visibleDetails) {
      if (!grouped.has(d.employeeId)) {
        grouped.set(d.employeeId, { employee: d.employee, items: [], adjustments: [], total: 0 });
      }
      const g = grouped.get(d.employeeId)!;
      g.items.push({ code: d.itemCode, name: d.itemName, amount: Number(d.amount) });
      g.total += Number(d.amount);
    }

    for (const a of visibleAdjustments) {
      if (!grouped.has(a.employeeId)) {
        grouped.set(a.employeeId, { employee: a.employee, items: [], adjustments: [], total: 0 });
      }
      const g = grouped.get(a.employeeId)!;
      g.adjustments.push({
        id: a.id,
        itemCode: a.itemCode,
        amount: Number(a.amount),
        reason: a.reason,
        createdAt: a.createdAt,
      });
      g.total += Number(a.amount);
    }

    const employees = Array.from(grouped.values()).map((g) => ({
      ...g,
      total: Math.round(g.total * 100) / 100,
    }));

    return { run, employees };
  }

  async confirmRun(runId: number, userId: number, checkedEmployeeIds?: number[]) {
    return this.lockService.withLock(`payroll:confirm:${runId}`, LOCK_TTL_MS, async () => {
      if (!checkedEmployeeIds || checkedEmployeeIds.length < 3) {
        throw new BadRequestException({ code: 3008, message: '确认前必须抽检至少3名员工对账' });
      }

      const validCount = await this.prisma.payrollDetail.groupBy({
        by: ['employeeId'],
        where: { runId, employeeId: { in: checkedEmployeeIds } },
      });
      if (validCount.length !== checkedEmployeeIds.length) {
        throw new BadRequestException({ code: 3009, message: '抽检员工ID不在本批次薪资明细中' });
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
          throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
        }
        throw new ConflictException({ code: 3003, message: '仅草稿状态可确认' });
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
            throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
          }
          throw new ConflictException({ code: 3003, message: '仅已确认状态可发布' });
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
        throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
      }

      await this.assertRunInScope(runId, userId);

      if (run.status !== 'published') {
        throw new ConflictException({ code: 3003, message: '仅已发布状态可撤回' });
      }

      const viewedCount = await this.prisma.payslip.count({
        where: { runId, status: 'viewed' },
      });
      if (viewedCount > 0) {
        throw new UnprocessableEntityException({ code: 3005, message: '存在已查看的工资条，不可撤回' });
      }

      const updated = await this.prisma.payrollRun.update({
        where: { id: runId },
        data: { status: 'recalled', recalledBy: userId, recalledAt: new Date() },
      });

      await this.prisma.payslip.deleteMany({ where: { runId } });

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
        throw new ForbiddenException({ code: 4030, message: '无权操作包含非本人员工的算薪批次' });
      }
    } else if (scope.ids.length > 0) {
      const hasOutOfScope = employees.some(
        (e) => !e.employee?.departmentId || !scope.ids.includes(e.employee.departmentId),
      );
      if (hasOutOfScope) {
        throw new ForbiddenException({ code: 4030, message: '无权操作包含非本部门员工的算薪批次' });
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
      throw new ConflictException({ code: 3006, message: '薪资项目编码已存在' });
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
      throw new NotFoundException({ code: 3007, message: '薪资项目不存在' });
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
      throw new NotFoundException({ code: 3007, message: '薪资项目不存在' });
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
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
    }
    if (run.status !== 'draft') {
      throw new UnprocessableEntityException({ code: 3003, message: '仅草稿状态可添加调整项' });
    }

    // IDOR fix: verify the employee is in the caller's data scope
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== data.employeeId) {
      throw new ForbiddenException({ code: 4030, message: '无权为其他员工添加调整项' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: 4030, message: '无权为其他员工添加调整项' });
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
