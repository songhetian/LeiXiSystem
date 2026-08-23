import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, Req, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ShiftsService } from './shifts.service';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式 HH:mm');
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色格式 #RRGGBB');
const shiftSchema = z.object({
  name: z.string().min(1, '班次名必填'),
  startTime: timeSchema,
  endTime: timeSchema,
  isNextDay: z.boolean().default(false),
  restDuration: z.number().int().min(0).max(480).optional(),
  lateThreshold: z.number().int().min(0).max(240).optional(),
  earlyThreshold: z.number().int().min(0).max(240).optional(),
  useGlobalThreshold: z.boolean().optional(),
  color: colorSchema.optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  description: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});
const updateShiftSchema = shiftSchema.partial();

@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async create(@Body() body: unknown) {
    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const shift = await this.shiftsService.create(parsed.data);
    return { code: 0, message: 'ok', data: shift };
  }

  @Get()
  @RequirePermission('attendance:manage')
  async list() {
    const result = await this.shiftsService.list();
    return { code: 0, message: 'ok', data: result };
  }

  @Get('available')
  async availableList() {
    const result = await this.shiftsService.list();
    return { code: 0, message: 'ok', data: result.list.filter((s) => s.isActive !== false) };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateShiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const shift = await this.shiftsService.update(id, parsed.data);
    return { code: 0, message: 'ok', data: shift };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.shiftsService.remove(id);
    return { code: 0, message: 'ok', data: result };
  }
}
