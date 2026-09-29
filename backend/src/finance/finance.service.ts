import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';

// 预算创建/更新入参
export interface BudgetCreateDto {
  year: number;
  departmentId?: number | null; // 为空视为公司年度总预算
  category: string;
  amount: number;
  note?: string;
}
export interface BudgetUpdateDto extends Partial<BudgetCreateDto> {}

// 费用标准入参
export interface ExpenseStandardCreateDto {
  name: string;
  category: string;
  amount: number;
  unit?: string | null;
  description?: string;
  status?: string;
}
export interface ExpenseStandardUpdateDto extends Partial<ExpenseStandardCreateDto> {}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  // ============ 预算 ============

  // ADR-0010：预算按部门隔离。
  //   admin/hr（all）→ 不过滤；
  //   部门管理者 → 仅本部门及子部门（departmentId IN ids）；
  //   其余（无部门范围）→ 空集，且不查库。
  // 说明：departmentId 为空的公司级总预算不属于任何可见部门，故对非 all 范围一律不可见。
  async listBudgets(
    where: { year?: number; departmentId?: number; category?: string },
    userId: number,
  ) {
    const conditions: Record<string, unknown> = {};
    // 支持按 年份 / 部门 / 类别 过滤
    if (where.year !== undefined) conditions.year = where.year;
    if (where.departmentId !== undefined) conditions.departmentId = where.departmentId;
    if (where.category !== undefined) conditions.category = where.category;

    const scope = await this.dataScope.visibleScope(userId);
    if (!scope.all) {
      // 无可见部门：预算无「本人」维度，直接返回空集
      if (scope.ids.length === 0) {
        return { list: [], total: 0 };
      }
      conditions.AND = [{ departmentId: { in: scope.ids } }];
    }

    const list = await this.prisma.budget.findMany({
      where: Object.keys(conditions).length ? conditions : undefined,
      orderBy: [{ year: 'desc' }, { id: 'asc' }],
    });
    return { list, total: list.length };
  }

  async createBudget(dto: BudgetCreateDto) {
    // departmentId 为空时视为公司年度总预算（存 null）
    const data = {
      year: dto.year,
      departmentId: dto.departmentId ?? null,
      category: dto.category,
      amount: dto.amount,
      note: dto.note,
    };
    return this.prisma.budget.create({ data });
  }

  async updateBudget(id: number, dto: BudgetUpdateDto) {
    const existing = await this.prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.FINANCE_BUDGET_NOT_FOUND, message: '预算不存在' });
    }
    // 只传递显式提供的字段
    const data: Record<string, unknown> = {};
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.note !== undefined) data.note = dto.note;

    return this.prisma.budget.update({ where: { id }, data });
  }

  async removeBudget(id: number) {
    const existing = await this.prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.FINANCE_BUDGET_NOT_FOUND, message: '预算不存在' });
    }
    await this.prisma.budget.delete({ where: { id } });
    return { success: true };
  }

  // ============ 费用标准 ============

  // 费用标准为公司级全局配置：表结构无部门维度（无 department_id 字段），
  // 故不做部门隔离，凡持有 finance:expense-standard:view 权限者均可查看（ADR-0010）。
  async listExpenseStandards(where: { category?: string; status?: string }) {
    const conditions: Record<string, unknown> = {};
    if (where.category !== undefined) conditions.category = where.category;
    if (where.status !== undefined) conditions.status = where.status;

    const list = await this.prisma.expenseStandard.findMany({
      where: Object.keys(conditions).length ? conditions : undefined,
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async createExpenseStandard(dto: ExpenseStandardCreateDto) {
    const data = {
      name: dto.name,
      category: dto.category,
      amount: dto.amount,
      unit: dto.unit,
      description: dto.description,
      status: dto.status ?? 'enabled',
    };
    return this.prisma.expenseStandard.create({ data });
  }

  async updateExpenseStandard(id: number, dto: ExpenseStandardUpdateDto) {
    const existing = await this.prisma.expenseStandard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.FINANCE_EXPENSE_STANDARD_NOT_FOUND, message: '费用标准不存在' });
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.expenseStandard.update({ where: { id }, data });
  }

  // 启停切换：enabled <-> disabled
  async toggleExpenseStandard(id: number) {
    const existing = await this.prisma.expenseStandard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.FINANCE_EXPENSE_STANDARD_NOT_FOUND, message: '费用标准不存在' });
    }
    const next = existing.status === 'enabled' ? 'disabled' : 'enabled';
    return this.prisma.expenseStandard.update({ where: { id }, data: { status: next } });
  }

  async removeExpenseStandard(id: number) {
    const existing = await this.prisma.expenseStandard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.FINANCE_EXPENSE_STANDARD_NOT_FOUND, message: '费用标准不存在' });
    }
    await this.prisma.expenseStandard.delete({ where: { id } });
    return { success: true };
  }
}