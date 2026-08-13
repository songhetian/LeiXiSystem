import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  Req,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PunchDeviceService } from './punch-device.service';

const createSchema = z.object({
  name: z.string().min(1, '设备名必填'),
  deviceNo: z.string().min(1, '设备编号必填'),
  ipAddress: z.string().min(1, 'IP 地址必填'),
  port: z.number().int().min(1).max(65535).optional(),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

@Controller('attendance/punch/devices')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PunchDeviceController {
  constructor(private readonly punchDeviceService: PunchDeviceService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async create(@Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2007, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const device = await this.punchDeviceService.create(parsed.data);
    return { code: 0, message: 'ok', data: device };
  }

  @Get()
  @RequirePermission('attendance:manage')
  async list() {
    const result = await this.punchDeviceService.list();
    return { code: 0, message: 'ok', data: result };
  }

  @Get(':id')
  @RequirePermission('attendance:manage')
  async get(@Param('id', ParseIntPipe) id: number) {
    const device = await this.punchDeviceService.get(id);
    return { code: 0, message: 'ok', data: device };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2007, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const device = await this.punchDeviceService.update(id, parsed.data);
    return { code: 0, message: 'ok', data: device };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.punchDeviceService.remove(id);
    return { code: 0, message: 'ok', data: result };
  }
}
