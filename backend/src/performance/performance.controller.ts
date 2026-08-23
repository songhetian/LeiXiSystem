import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PerformanceService } from './performance.service';

// 绩效周期状态校验
const cycleStatusSchema = z.enum(['draft', 'active', 'closed']);
const cycleSchema = z.object({
  name: z.string().min(1, '周期名称必填'),
  type: z.string().min(1, '周期类型必填'),
  startDate: z.string().min(1, '开始日期必填'),
  endDate: z.string().min(1, '结束日期必填'),
  selfReviewDeadline: z.string().optional(),
  managerReviewDeadline: z.string().optional(),
  calibrationDeadline: z.string().optional(),
  status: cycleStatusSchema.optional(),
});
const updateCycleSchema = cycleSchema.partial();

// 绩效目标校验
const goalSchema = z.object({
  cycleId: z.number().int().positive('周期ID非法'),
  employeeId: z.number().int().positive('员工ID非法'),
  title: z.string().min(1, '目标标题必填'),
  description: z.string().optional(),
  weight: z.number().min(0).max(100).optional(),
  targetValue: z.string().optional(),
  actualValue: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
});
const updateGoalSchema = goalSchema.partial();

// 绩效评估校验
const reviewSchema = z.object({
  cycleId: z.number().int().positive('周期ID非法'),
  employeeId: z.number().int().positive('员工ID非法'),
  reviewerId: z.number().int().positive().optional(),
  status: z.string().optional(),
});
const updateReviewSchema = z.object({
  cycleId: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  reviewerId: z.number().int().positive().nullable().optional(),
  selfScore: z.number().min(0).max(100).optional(),
  managerScore: z.number().min(0).max(100).optional(),
  finalScore: z.number().min(0).max(100).optional(),
  rating: z.string().optional(),
  status: z.string().optional(),
  selfComment: z.string().optional(),
  managerComment: z.string().optional(),
  comment: z.string().optional(),
  developmentPlan: z.string().optional(),
  promotionRecommendation: z.boolean().optional(),
});

@Controller('performance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // ===== 绩效周期 =====

  @Get('cycles')
  @RequirePermission('performance:view')
  async listCycles() {
    const result = await this.performanceService.listCycles();
    return { code: 0, message: 'ok', data: result };
  }

  @Post('cycles')
  @HttpCode(200)
  @RequirePermission('performance:cycle:manage')
  async createCycle(@Body() body: unknown) {
    const parsed = cycleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.createCycle(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Put('cycles/:id')
  @HttpCode(200)
  @RequirePermission('performance:cycle:manage')
  async updateCycle(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateCycleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.updateCycle(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete('cycles/:id')
  @HttpCode(200)
  @RequirePermission('performance:cycle:manage')
  async removeCycle(@Param('id', ParseIntPipe) id: number) {
    const result = await this.performanceService.removeCycle(id);
    return { code: 0, message: 'ok', data: result };
  }

  // ===== 绩效目标 =====

  @Post('goals')
  @HttpCode(200)
  @RequirePermission('performance:goal:manage')
  async createGoal(@Body() body: unknown) {
    const parsed = goalSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.createGoal(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Get('goals')
  @RequirePermission('performance:view')
  async listGoals(@Query('cycleId') cycleId?: string, @Query('employeeId') employeeId?: string) {
    const result = await this.performanceService.listGoals(
      cycleId !== undefined ? Number(cycleId) : undefined,
      employeeId !== undefined ? Number(employeeId) : undefined,
    );
    return { code: 0, message: 'ok', data: result };
  }

  @Put('goals/:id')
  @HttpCode(200)
  @RequirePermission('performance:goal:manage')
  async updateGoal(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateGoalSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.updateGoal(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete('goals/:id')
  @HttpCode(200)
  @RequirePermission('performance:goal:manage')
  async removeGoal(@Param('id', ParseIntPipe) id: number) {
    const result = await this.performanceService.removeGoal(id);
    return { code: 0, message: 'ok', data: result };
  }

  // ===== 绩效评估 =====

  @Post('reviews')
  @HttpCode(200)
  @RequirePermission('performance:review:manage')
  async createReview(@Body() body: unknown) {
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.createReview(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Get('reviews')
  @RequirePermission('performance:view')
  async listReviews(@Query('cycleId') cycleId?: string, @Query('employeeId') employeeId?: string) {
    const result = await this.performanceService.listReviews(
      cycleId !== undefined ? Number(cycleId) : undefined,
      employeeId !== undefined ? Number(employeeId) : undefined,
    );
    return { code: 0, message: 'ok', data: result };
  }

  @Put('reviews/:id')
  @HttpCode(200)
  @RequirePermission('performance:review:manage')
  async updateReview(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateReviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.performanceService.updateReview(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete('reviews/:id')
  @HttpCode(200)
  @RequirePermission('performance:review:manage')
  async removeReview(@Param('id', ParseIntPipe) id: number) {
    const result = await this.performanceService.removeReview(id);
    return { code: 0, message: 'ok', data: result };
  }
}