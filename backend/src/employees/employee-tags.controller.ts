import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { EmployeeTagsService } from './employee-tags.service';

// 员工标签校验
const tagSchema = z.object({
  name: z.string().min(1, '标签名称必填').max(50),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const updateTagSchema = tagSchema.partial();

@Controller('employee-tags')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeTagsController {
  constructor(private readonly employeeTagsService: EmployeeTagsService) {}

  @Get()
  @RequirePermission('employee:view')
  async list() {
    const result = await this.employeeTagsService.list();
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('employee:tag:manage')
  async create(@Body() body: unknown) {
    const parsed = tagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const tag = await this.employeeTagsService.create(parsed.data);
    return { code: 0, message: 'ok', data: tag };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('employee:tag:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateTagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const tag = await this.employeeTagsService.update(id, parsed.data);
    return { code: 0, message: 'ok', data: tag };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('employee:tag:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.employeeTagsService.remove(id);
    return { code: 0, message: 'ok', data: result };
  }
}