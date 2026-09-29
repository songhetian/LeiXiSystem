import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DataScopeService } from '../common/data-scope.service';
import { fromCents, sumCents } from '../common/money.util';
import { ERROR_CODES } from '../common/error-codes';

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
      include: { details: true, adjustments: true },
    });
    if (!run) {
      throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
    }

    // 工资条 = 计算值 + 调整值（CONTEXT.md 业务规则）。
    // 调整项必须与明细一并汇总，只取 details 会漏掉调整金额，导致工资条总额与批次明细对不上。
    const detailMap = new Map<number, any[]>();
    for (const d of run.details) {
      if (!detailMap.has(d.employeeId)) {
        detailMap.set(d.employeeId, []);
      }
      detailMap.get(d.employeeId)!.push({
        code: d.itemCode,
        name: d.itemName,
        amount: Number(d.amount),
        // 供工资条前端按收入/扣款分组展示
        type: Number(d.amount) < 0 ? 'deduction' : 'income',
      });
    }
    for (const a of run.adjustments ?? []) {
      if (!detailMap.has(a.employeeId)) {
        detailMap.set(a.employeeId, []);
      }
      detailMap.get(a.employeeId)!.push({
        code: a.itemCode,
        name: a.reason || a.itemCode,
        amount: Number(a.amount),
        type: 'adjustment',
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
      totalAmount: Prisma.Decimal;
      itemsJson: string;
    }> = [];
    for (const [employeeId, items] of detailMap) {
      if (existingIds.has(employeeId)) continue;
      // 定点累加：先转整数分再相加，写库边界统一转 Prisma.Decimal
      const totalCents = sumCents(items.map((i) => i.amount));
      payslipData.push({
        runId,
        employeeId,
        month: run.month,
        totalAmount: new Prisma.Decimal(fromCents(totalCents).toFixed(2)),
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
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const items = JSON.parse(payslip.itemsJson);
    return {
      ...payslip,
      items,
      // 调整项单独返回，供工资条页面独立区块展示（items 中仍保留，type=adjustment）
      adjustments: items.filter((i: any) => i?.type === 'adjustment'),
    };
  }

  async markAsViewed(userId: number, payslipId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
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
