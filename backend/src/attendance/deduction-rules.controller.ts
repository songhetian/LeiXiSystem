import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { DeductionRulesService } from './deduction-rules.service';

// 扣款规则校验
const deductionRuleSchema = z.object({
  name: z.string().min(1, '规则名称必填').max(100),
  type: z.string().min(1, '规则类型必填').max(50),
  method: z.string().min(1, '扣款方式必填').max(20),
  amount: z.number().nonnegative('扣款金额不能为负').nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  multiplier: z.number().nonnegative().nullable().optional(),
  leaveType: z.string().max(20).nullable().optional(),
  enabled: z.boolean().optional(),
  description: z.string().max(500).optional(),
});
const updateRuleSchema = deductionRuleSchema.partial();

// 扣款规则接口：= /attendance/deduction-rules
@Controller('deduction-rules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeductionRulesController {
  constructor(private readonly deductionRulesService: DeductionRulesService) {}

  @Get()
  @RequirePermission('attendance:deduction:view')
  async list() {
    const result = await this.deductionRulesService.list();
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:deduction:manage')
  async create(@Body() body: unknown) {
    const parsed = deductionRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.deductionRulesService.create(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:deduction:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.deductionRulesService.update(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:deduction:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.deductionRulesService.remove(id);
    return { code: 0, message: 'ok', data };
  }
}