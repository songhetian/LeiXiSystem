import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationTypeService } from './vacation-type.service';
import { ERROR_CODES } from '../common/error-codes';

const seniorityRuleSchema = z.array(
  z.object({
    minYears: z.number().min(0).optional(),
    maxYears: z.number().min(0).optional(),
    days: z.number().positive(),
  }),
);

const typeSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  baseDays: z.number().finite().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  carryOverRatio: z.number().min(0).max(1).nullable().optional(),
  carryOverMaxDays: z.number().finite().min(0).nullable().optional(),
  seniorityRule: z.union([seniorityRuleSchema, z.null()]).optional(),
  // 月假额度：12 元素数组（1~12 月每天额度，单位天），月假类型必填，非月假为 null/缺省
  monthlyDays: z.union([z.array(z.number().min(0)).length(12), z.null()]).optional(),
});

const updateSchema = typeSchema.partial();

@Controller('vacation/types')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class VacationTypeController {
  constructor(private readonly vacationTypeService: VacationTypeService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list() {
    const data = await this.vacationTypeService.list();
    return { code: 0, message: 'ok', data };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('vacation:manage')
  async create(@Body() body: unknown) {
    const parsed = typeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: parsed.error.issues[0]?.message ?? '参数校验失败',
      });
    }
    const data = await this.vacationTypeService.create(parsed.data);
    return { code: 0, message: 'ok', data };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('vacation:manage')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: parsed.error.issues[0]?.message ?? '参数校验失败',
      });
    }
    const data = await this.vacationTypeService.update(Number(id), parsed.data as any);
    return { code: 0, message: 'ok', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('vacation:manage')
  async remove(@Param('id') id: string) {
    const data = await this.vacationTypeService.remove(Number(id));
    return { code: 0, message: 'ok', data };
  }
}