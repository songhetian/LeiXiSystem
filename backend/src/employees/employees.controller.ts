import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { employeeNoSchema } from '@lei/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { EmployeesService } from './employees.service';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误').optional().or(z.literal('').transform(() => undefined));

const createSchema = z.object({
  employeeNo: employeeNoSchema,
  name: z.string().min(1, '姓名必填'),
  departmentId: z.number().int().positive(),
  positionId: z.number().int().positive().optional(),
  phone: phoneSchema,
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式错误'),
  salary: z.number().nonnegative('金额不能为负').optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: z.number().int().positive().optional(),
  positionId: z.number().int().positive().nullable().optional(),
  phone: phoneSchema,
  salary: z.number().nonnegative().optional(),
});

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('employee:list')
  async create(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'phone') {
        throw new UnprocessableEntityException({ code: 1003, message: '手机号格式错误' });
      }
      throw new BadRequestException({ code: 422, message: issue?.message ?? '参数校验失败' });
    }
    const data = { ...parsed.data, phone: parsed.data.phone ?? null };
    const employee = await this.employeesService.create(data);
    return { code: 0, message: 'ok', data: employee };
  }

  @Get()
  @RequirePermission('employee:list')
  async list(@Req() req: FastifyRequest, @Query('page') page = '1', @Query('pageSize') pageSize = '20', @Query('keyword') keyword?: string) {
    const result = await this.employeesService.list((req as any).user.id, {
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      keyword,
    });
    return { code: 0, message: 'ok', data: result };
  }

  @Get(':id')
  @RequirePermission('employee:list')
  async detail(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
    const employee = await this.employeesService.detail((req as any).user.id, id);
    return { code: 0, message: 'ok', data: employee };
  }

  @Patch(':id')
  @RequirePermission('employee:list')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 422, message: '参数校验失败' });
    }
    const employee = await this.employeesService.update(id, parsed.data);
    return { code: 0, message: 'ok', data: employee };
  }

  @Post(':id/resign')
  @HttpCode(200)
  @RequirePermission('employee:list')
  async resign(@Param('id', ParseIntPipe) id: number) {
    const employee = await this.employeesService.resign(id);
    return { code: 0, message: 'ok', data: employee };
  }
}
