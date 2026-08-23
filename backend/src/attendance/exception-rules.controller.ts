import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ExceptionRulesService } from './exception-rules.service';

// ===== 异常规则校验 =====
const exceptionRuleSchema = z.object({
  name: z.string().min(1, '规则名称必填').max(100),
  type: z.string().min(1, '异常类型必填').max(50),
  description: z.string().max(500).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  threshold: z.number().int().min(0).optional(),
  thresholdMax: z.number().int().min(0).nullable().optional(),
  autoResolve: z.boolean().optional(),
  autoResolveType: z.string().max(20).nullable().optional(),
  deductMinutes: z.number().int().optional(),
  status: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
});
const updateRuleSchema = exceptionRuleSchema.partial();

// 异常规则接口：= /attendance/exception-rules
@Controller('exception-rules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExceptionRulesController {
  constructor(private readonly exceptionRulesService: ExceptionRulesService) {}

  @Get()
  @RequirePermission('attendance:exception:view')
  async list() {
    const result = await this.exceptionRulesService.listRules();
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async create(@Body() body: unknown) {
    const parsed = exceptionRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.exceptionRulesService.createRule(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.exceptionRulesService.updateRule(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.exceptionRulesService.removeRule(id);
    return { code: 0, message: 'ok', data };
  }

  // 启停
  @Patch(':id/toggle')
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.exceptionRulesService.toggleRule(id);
    return { code: 0, message: 'ok', data };
  }
}

// ===== 异常记录校验 =====
const exceptionCreateSchema = z.object({
  employeeId: z.number().int().positive('员工ID必填'),
  workDate: z.string().min(1, '工作日期必填'),
  type: z.string().min(1, '异常类型必填').max(50),
  description: z.string().max(500).optional(),
  deductMinutes: z.number().int().min(0).optional(),
  resolveType: z.string().max(20).optional(),
});
const exceptionHandleSchema = z.object({
  status: z.string().min(1, '处理状态必填').max(20),
  remark: z.string().max(500).optional(),
  handledBy: z.number().int().positive().optional(),
});

// 异常记录接口：= /attendance/exceptions
@Controller('exceptions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExceptionsController {
  constructor(private readonly exceptionRulesService: ExceptionRulesService) {}

  @Get()
  @RequirePermission('attendance:exception:view')
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('employeeId') employeeId?: string,
    @Query('workDate') workDate?: string,
  ) {
    const result = await this.exceptionRulesService.listExceptions({ status, type, employeeId: employeeId ? Number(employeeId) : undefined, workDate });
    return { code: 0, message: 'ok', data: result };
  }

  // 生成异常记录
  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async create(@Body() body: unknown) {
    const parsed = exceptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.exceptionRulesService.createException(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  // 处理
  @Put(':id/status')
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async handle(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = exceptionHandleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.exceptionRulesService.handleException(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:exception:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.exceptionRulesService.removeException(id);
    return { code: 0, message: 'ok', data };
  }
}