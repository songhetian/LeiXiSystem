import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceLocationsService } from './attendance-locations.service';

// 打卡定位校验
const locationSchema = z.object({
  name: z.string().min(1, '定位名称必填').max(100),
  address: z.string().max(255).optional(),
  latitude: z.number({ invalid_type_error: '纬度必填', required_error: '纬度必填' }),
  longitude: z.number({ invalid_type_error: '经度必填', required_error: '经度必填' }),
  radius: z.number().int().min(0).optional(),
  workType: z.string().max(20).optional(),
  enabled: z.boolean().optional(),
});
const updateLocationSchema = locationSchema.partial();

@Controller('attendance-locations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceLocationsController {
  constructor(private readonly attendanceLocationsService: AttendanceLocationsService) {}

  @Get()
  @RequirePermission('employee:view')
  async list() {
    const result = await this.attendanceLocationsService.list();
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:location:manage')
  async create(@Body() body: unknown) {
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const location = await this.attendanceLocationsService.create(parsed.data);
    return { code: 0, message: 'ok', data: location };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:location:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const location = await this.attendanceLocationsService.update(id, parsed.data);
    return { code: 0, message: 'ok', data: location };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:location:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.attendanceLocationsService.remove(id);
    return { code: 0, message: 'ok', data: result };
  }
}