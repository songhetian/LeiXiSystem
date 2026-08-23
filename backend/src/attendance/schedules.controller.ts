import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, Req, UseGuards, UnprocessableEntityException, ParseIntPipe } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SchedulesService } from './schedules.service';
import { parsePagination } from '../common/pagination.util';

const scheduleItemSchema = z.object({
  employeeId: z.number().int().positive(),
  shiftId: z.number().int().positive(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式错误'),
});
const createSchema = scheduleItemSchema;
const updateSchema = scheduleItemSchema.partial();
const batchSchema = z.object({ items: z.array(scheduleItemSchema).min(1, '至少一条排班') });

@Controller('schedules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async create(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({ code: 2001, message: '参数校验失败' });
    }
    const schedule = await this.schedulesService.create(parsed.data, (req as any).user.id);
    return { code: 0, message: 'ok', data: schedule };
  }

  @Post('batch')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async batch(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({ code: 2001, message: '参数校验失败' });
    }
    const result = await this.schedulesService.batch(parsed.data.items, (req as any).user.id);
    return { code: 0, message: 'ok', data: result };
  }

  @Get()
  @RequirePermission('attendance:manage')
  async list(
    @Req() req: FastifyRequest,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize }, { defaultPageSize: 100, maxPageSize: 200 });
    const result = await this.schedulesService.list((req as any).user.id, {
      employeeId: employeeId ? Number(employeeId) : undefined,
      startDate,
      endDate,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, message: 'ok', data: result };
  }

  @Get('my')
  @RequirePermission('attendance:view')
  async my(
    @Req() req: FastifyRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize }, { defaultPageSize: 200, maxPageSize: 400 });
    const result = await this.schedulesService.mySchedule((req as any).user.id, {
      startDate,
      endDate,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, message: 'ok', data: result };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({ code: 2001, message: '参数校验失败' });
    }
    const schedule = await this.schedulesService.update(id, parsed.data, (req as any).user.id);
    return { code: 0, message: 'ok', data: schedule };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const result = await this.schedulesService.remove(id, (req as any).user.id);
    return { code: 0, message: 'ok', data: result };
  }
}
