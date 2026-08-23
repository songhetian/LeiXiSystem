import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { OkrService } from './okr.service';

// OKR 目标校验
const objectiveSchema = z.object({
  title: z.string().min(1, '目标标题必填'),
  type: z.string().optional(),
  period: z.string().min(1, '目标周期必填'),
  ownerId: z.number().int().positive().nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const updateObjectiveSchema = objectiveSchema.partial();

// OKR 关键结果校验
const keyResultSchema = z.object({
  objectiveId: z.number().int().positive('OKR 目标ID非法'),
  title: z.string().min(1, '关键结果标题必填'),
  initialValue: z.number().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
});
const updateKeyResultSchema = keyResultSchema.partial();

@Controller('okr')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OkrController {
  constructor(private readonly okrService: OkrService) {}

  // ===== OKR 目标 =====

  @Post('objectives')
  @HttpCode(200)
  @RequirePermission('okr:manage')
  async createObjective(@Body() body: unknown) {
    const parsed = objectiveSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.okrService.createObjective(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Get('objectives')
  @RequirePermission('okr:view')
  async listObjectives(@Query('ownerId') ownerId?: string, @Query('type') type?: string) {
    const result = await this.okrService.listObjectives(
      ownerId !== undefined ? Number(ownerId) : undefined,
      type,
    );
    return { code: 0, message: 'ok', data: result };
  }

  @Put('objectives/:id')
  @HttpCode(200)
  @RequirePermission('okr:manage')
  async updateObjective(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateObjectiveSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.okrService.updateObjective(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Delete('objectives/:id')
  @HttpCode(200)
  @RequirePermission('okr:manage')
  async removeObjective(@Param('id', ParseIntPipe) id: number) {
    const result = await this.okrService.removeObjective(id);
    return { code: 0, message: 'ok', data: result };
  }

  // ===== OKR 关键结果 =====

  @Post('objectives/:id/key-results')
  @HttpCode(200)
  @RequirePermission('okr:manage')
  async createKeyResult(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    // 传入参数校验，objectiveId 取路径中的 id；创建时 title 必填
    const parsed = keyResultSchema.omit({ objectiveId: true }).safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.okrService.createKeyResult({ ...parsed.data, objectiveId: id });
    return { code: 0, message: 'ok', data };
  }

  @Get('objectives/:id/key-results')
  @RequirePermission('okr:view')
  async listKeyResults(@Param('id', ParseIntPipe) id: number) {
    const result = await this.okrService.listKeyResults(id);
    return { code: 0, message: 'ok', data: result };
  }

  @Put('key-results/:id')
  @HttpCode(200)
  @RequirePermission('okr:manage')
  async updateKeyResult(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateKeyResultSchema.omit({ objectiveId: true }).safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const data = await this.okrService.updateKeyResult(id, parsed.data);
    return { code: 0, message: 'ok', data };
  }
}