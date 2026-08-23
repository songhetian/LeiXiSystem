import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DataScopeService } from '../common/data-scope.service';

type TxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PayslipService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
  ) {}

  async generateFromRun(runId: number, tx?: TxClient) {
    const db = tx || this.prisma;
    const run = await db.payrollRun.findUnique({
      where: { id: runId },
      include: { details: true },
    });
    if (!run) {
      throw new NotFoundException({ code: 4001, message: '算薪批次不存在' });
    }

    const detailMap = new Map<number, any[]>();
    for (const d of run.details) {
      if (!detailMap.has(d.employeeId)) {
        detailMap.set(d.employeeId, []);
      }
      detailMap.get(d.employeeId)!.push({
        code: d.itemCode,
        name: d.itemName,
        amount: Number(d.amount),
      });
    }

    const existingPayslips = await db.payslip.findMany({
      where: { runId },
      select: { employeeId: true },
    });
    const existingIds = new Set(existingPayslips.map((p) => p.employeeId));

    const payslipData: Array<{
      runId: number;
      employeeId: number;
      month: string;
      totalAmount: number;
      itemsJson: string;
    }> = [];
    for (const [employeeId, items] of detailMap) {
      if (existingIds.has(employeeId)) continue;
      const total = items.reduce((s, i) => s + i.amount, 0);
      payslipData.push({
        runId,
        employeeId,
        month: run.month,
        totalAmount: Math.round(total * 100) / 100,
        itemsJson: JSON.stringify(items),
      });
    }
    if (payslipData.length > 0) {
      await db.payslip.createMany({ data: payslipData });
    }
  }

  async getMyPayslips(userId: number, page: number, pageSize: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      return { list: [], total: 0, page, pageSize };
    }

    const [list, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where: { employeeId: employee.id },
        orderBy: { month: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payslip.count({ where: { employeeId: employee.id } }),
    ]);

    return { list, total, page, pageSize };
  }

  async getMyPayslipDetail(userId: number, payslipId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException({ code: 4004, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: 4004, message: '工资条不存在' });
    }

    return {
      ...payslip,
      items: JSON.parse(payslip.itemsJson),
    };
  }

  async markAsViewed(userId: number, payslipId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException({ code: 4004, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: 4004, message: '工资条不存在' });
    }

    if (payslip.status === 'viewed') {
      return payslip;
    }

    return this.prisma.payslip.update({
      where: { id: payslipId },
      data: { status: 'viewed', viewedAt: new Date() },
    });
  }

  async listPayslips(params: {
    userId: number;
    runId?: number;
    month?: string;
    page: number;
    pageSize: number;
  }) {
    const { userId, runId, month, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: any = {};
    if (runId) where.runId = runId;
    if (month) where.month = month;
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }

    const [list, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNo: true, name: true, department: true } },
        },
        orderBy: [{ month: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }
}
