import { Injectable, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { calculatePayroll, type PayrollConfig } from './engine/payroll-engine';
import { PayslipService } from './payslip.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private payslipService: PayslipService,
  ) {}

  private readonly payrollConfig: PayrollConfig = {
    fullAttendanceBonus: 200,
    mealAllowancePerDay: 10,
    socialSecurity: 500,
  };

  async createRun(month: string, userId: number) {
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

    const run = await this.prisma.payrollRun.create({
      data: { month, status: 'draft' },
    });

    let totalAmount = 0;
    for (const m of confirmedMonthlies) {
      const basicSalary = Number(m.employee.salary);
      const result = calculatePayroll(
        { name: m.employee.name, basicSalary },
        {
          workDays: Number(m.workDays),
          scheduledDays: Number(m.workDays) + Number(m.absentDays),
          absentDays: Number(m.absentDays),
          lateCount: m.lateCount,
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
        await this.prisma.payrollDetail.create({
          data: {
            runId: run.id,
            employeeId: m.employeeId,
            itemCode: item.code,
            itemName: item.name,
            amount: item.amount,
          },
        });
      }
      totalAmount += result.total;
    }

    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalEmployees: confirmedMonthlies.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
      },
    });

    return run;
  }

  async listRuns(params: { userId: number; page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const [list, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        orderBy: { month: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payrollRun.count(),
    ]);
    return { list, total, page, pageSize };
  }

  async getRunDetails(runId: number, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
    }

    const [details, adjustments] = await Promise.all([
      this.prisma.payrollDetail.findMany({
        where: { runId },
        include: {
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: [{ employeeId: 'asc' }, { itemCode: 'asc' }],
      }),
      this.prisma.payrollAdjustment.findMany({
        where: { runId },
        include: {
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: [{ employeeId: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const grouped = new Map<number, { employee: any; items: any[]; adjustments: any[]; total: number }>();
    for (const d of details) {
      if (!grouped.has(d.employeeId)) {
        grouped.set(d.employeeId, { employee: d.employee, items: [], adjustments: [], total: 0 });
      }
      const g = grouped.get(d.employeeId)!;
      g.items.push({ code: d.itemCode, name: d.itemName, amount: Number(d.amount) });
      g.total += Number(d.amount);
    }

    for (const a of adjustments) {
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

  async confirmRun(runId: number, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
    }
    if (run.status !== 'draft') {
      throw new ConflictException({ code: 3003, message: '仅草稿状态可确认' });
    }
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'confirmed', confirmedBy: userId, confirmedAt: new Date() },
    });
  }

  async publishRun(runId: number, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
    }
    if (run.status !== 'confirmed') {
      throw new ConflictException({ code: 3003, message: '仅已确认状态可发布' });
    }
    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'published', publishedBy: userId, publishedAt: new Date() },
    });
    await this.payslipService.generateFromRun(runId);
    return updated;
  }

  async recallRun(runId: number, userId: number) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: 3004, message: '算薪批次不存在' });
    }
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

    return updated;
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
