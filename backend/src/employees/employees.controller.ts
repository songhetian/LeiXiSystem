import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { employeeNoSchema } from '@lei/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { EmployeesService } from './employees.service';
import { ERROR_CODES } from '../common/error-codes';
import { parsePagination } from '../common/pagination.util';

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

const updateMyProfileSchema = z.object({
  phone: phoneSchema,
  address: z.string().optional(),
  email: z.string().email('邮箱格式错误').optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

@ApiTags('员工')
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('me')
  async getMyProfile(@Req() req: FastifyRequest) {
    const employee = await this.employeesService.getMyInfo((req as any).user.id);
    return { code: 0, data: employee };
  }

  @Patch('me/profile')
  async updateMyProfile(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = updateMyProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '参数校验失败' });
    }
    const employee = await this.employeesService.updateMyProfile(
      (req as any).user.id,
      parsed.data,
    );
    return { code: 0, message: 'ok', data: employee };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('employee:manage')
  async create(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'phone') {
        throw new UnprocessableEntityException({ code: 1003, message: '手机号格式错误' });
      }
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: issue?.message ?? '参数校验失败' });
    }
    const data = { ...parsed.data, phone: parsed.data.phone ?? null };
    const employee = await this.employeesService.create(data);
    return { code: 0, message: 'ok', data: employee };
  }

  @Get()
  @RequirePermission('employee:view')
  async list(@Req() req: FastifyRequest, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const result = await this.employeesService.list((req as any).user.id, {
      page: pageNum,
      pageSize: pageSizeNum,
      keyword,
    });
    return { code: 0, message: 'ok', data: result };
  }

  @Get(':id')
  @RequirePermission('employee:view')
  async detail(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
    const employee = await this.employeesService.detail((req as any).user.id, id);
    return { code: 0, message: 'ok', data: employee };
  }

  @Get(':id/change-logs')
  @RequirePermission('employee:view')
  async getChangeLogs(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
    const logs = await this.employeesService.getChangeLogs((req as any).user.id, id);
    return { code: 0, message: 'ok', data: logs };
  }

  @Patch(':id')
  @RequirePermission('employee:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '参数校验失败' });
    }
    const employee = await this.employeesService.update(id, parsed.data, (req as any).user.id);
    return { code: 0, message: 'ok', data: employee };
  }

  @Post(':id/resign')
  @HttpCode(200)
  @RequirePermission('employee:manage')
  async resign(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const employee = await this.employeesService.resign(id, (req as any).user.id);
    return { code: 0, message: 'ok', data: employee };
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermission('employee:manage')
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const employee = await this.employeesService.restore(id, (req as any).user.id);
    return { code: 0, message: 'ok', data: employee };
  }

  @Get('export')
  @RequirePermission('employee:manage')
  async exportExcel(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const buffer = await this.employeesService.exportExcel((req as any).user.id);
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="employees_${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  @Get('import/template')
  @RequirePermission('employee:manage')
  async downloadImportTemplate(@Res() res: FastifyReply) {
    const buffer = await this.employeesService.generateImportTemplate();
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @HttpCode(200)
  @RequirePermission('employee:manage')
  async importExcel(@Req() req: FastifyRequest) {
    const parts = (req as any).files();
    let buffer: Buffer | null = null;
    if (parts) {
      for await (const part of parts) {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
        break;
      }
    }
    if (!buffer) throw new BadRequestException({ code: 4000, message: '请上传文件' });
    const result = await this.employeesService.importExcel((req as any).user.id, buffer);
    return { code: 0, message: '导入完成', data: result };
  }
}
