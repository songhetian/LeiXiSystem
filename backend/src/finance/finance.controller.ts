import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, HttpCode, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceService } from './finance.service';

// 预算校验：departmentId 为空时视为公司年度总预算
const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2100, '年份不合法'),
  departmentId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  category: z.string().min(1, '预算类别必填').max(50),
  amount: z.number().min(0, '预算金额不能为负数'),
  note: z.string().max(500).optional(),
});
const updateBudgetSchema = budgetSchema.partial();

// 费用标准校验
const expenseStandardSchema = z.object({
  name: z.string().min(1, '名称必填').max(100),
  category: z.string().min(1, '类别必填').max(50),
  amount: z.number().min(0, '金额不能为负数'),
  unit: z.string().max(20).nullable().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});
const updateExpenseStandardSchema = expenseStandardSchema.partial();

// 通用：尝试解析失败时抛出参数校验错误
function fail(message: string): never {
  throw new BadRequestException({ code: 2001, message });
}

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ============ 预算 ============

  @Get('budgets')
  @RequirePermission('finance:budget:view')
  async listBudgets(
    @Query('year') year?: string,
    @Query('departmentId') departmentId?: string,
    @Query('category') category?: string,
  ) {
    const where: { year?: number; departmentId?: number; category?: string } = {};
    if (year !== undefined && year !== '') {
      const y = Number(year);
      if (!Number.isInteger(y)) fail('年份参数不合法');
      where.year = y;
    }
    if (departmentId !== undefined && departmentId !== '') {
      const id = Number(departmentId);
      if (!Number.isInteger(id)) fail('部门 ID 参数不合法');
      where.departmentId = id;
    }
    if (category !== undefined && category !== '') {
      where.category = category;
    }
    const result = await this.financeService.listBudgets(where);
    return { code: 0, message: 'ok', data: result };
  }

  @Post('budgets')
  @HttpCode(200)
  @RequirePermission('finance:budget:manage')
  async createBudget(@Body() body: unknown) {
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const budget = await this.financeService.createBudget(parsed.data);
    return { code: 0, message: 'ok', data: budget };
  }

  @Put('budgets/:id')
  @HttpCode(200)
  @RequirePermission('finance:budget:manage')
  async updateBudget(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateBudgetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const budget = await this.financeService.updateBudget(id, parsed.data);
    return { code: 0, message: 'ok', data: budget };
  }

  @Delete('budgets/:id')
  @HttpCode(200)
  @RequirePermission('finance:budget:manage')
  async removeBudget(@Param('id', ParseIntPipe) id: number) {
    const result = await this.financeService.removeBudget(id);
    return { code: 0, message: 'ok', data: result };
  }

  // ============ 费用标准 ============

  @Get('expense-standards')
  @RequirePermission('finance:expense-standard:view')
  async listExpenseStandards(@Query('category') category?: string, @Query('status') status?: string) {
    const where: { category?: string; status?: string } = {};
    if (category !== undefined && category !== '') where.category = category;
    if (status !== undefined && status !== '') {
      if (status !== 'enabled' && status !== 'disabled') fail('status 参数不合法');
      where.status = status;
    }
    const result = await this.financeService.listExpenseStandards(where);
    return { code: 0, message: 'ok', data: result };
  }

  @Post('expense-standards')
  @HttpCode(200)
  @RequirePermission('finance:expense-standard:manage')
  async createExpenseStandard(@Body() body: unknown) {
    const parsed = expenseStandardSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const item = await this.financeService.createExpenseStandard(parsed.data);
    return { code: 0, message: 'ok', data: item };
  }

  @Put('expense-standards/:id')
  @HttpCode(200)
  @RequirePermission('finance:expense-standard:manage')
  async updateExpenseStandard(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateExpenseStandardSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const item = await this.financeService.updateExpenseStandard(id, parsed.data);
    return { code: 0, message: 'ok', data: item };
  }

  @Patch('expense-standards/:id/toggle')
  @HttpCode(200)
  @RequirePermission('finance:expense-standard:manage')
  async toggleExpenseStandard(@Param('id', ParseIntPipe) id: number) {
    const item = await this.financeService.toggleExpenseStandard(id);
    return { code: 0, message: 'ok', data: item };
  }

  @Delete('expense-standards/:id')
  @HttpCode(200)
  @RequirePermission('finance:expense-standard:manage')
  async removeExpenseStandard(@Param('id', ParseIntPipe) id: number) {
    const result = await this.financeService.removeExpenseStandard(id);
    return { code: 0, message: 'ok', data: result };
  }
}