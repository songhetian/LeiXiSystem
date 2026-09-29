import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  Req,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PunchMakeupService } from './punch-makeup.service';
import { parsePagination } from '../common/pagination.util';
import { PUNCH_MAKEUP_TYPES } from './punch-makeup-type';
import { ERROR_CODES } from '../common/error-codes';
import type { RequestContext } from '../types/fastify';

// 入参校验：补卡类型必须落在全链路共用值域内，时间/日期必须是规范格式，
// 否则 400 而不是把脏值写进 punch_makeups（脏值会让审批监听器写卡静默失效）。
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '补卡日期格式应为 YYYY-MM-DD');
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, '时间格式应为 HH:mm 或 HH:mm:ss');
const punchTypeSchema = z.enum(PUNCH_MAKEUP_TYPES);

const makeupCreateSchema = z.object({
  punchDate: dateSchema,
  punchType: punchTypeSchema,
  originalTime: timeSchema.optional(),
  makeupTime: timeSchema.optional(),
  reason: z.string().trim().min(1, '补卡原因必填').max(500),
});

const makeupUpdateSchema = z.object({
  punchDate: dateSchema.optional(),
  punchType: punchTypeSchema.optional(),
  originalTime: timeSchema.nullable().optional(),
  makeupTime: timeSchema.nullable().optional(),
  reason: z.string().trim().min(1, '补卡原因不能为空').max(500).optional(),
});

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: ERROR_CODES.PARAM_INVALID,
      message: parsed.error.issues[0]?.message ?? '参数校验失败',
    });
  }
  return parsed.data;
}

@Controller('attendance/punch/makeup')
@UseGuards(JwtAuthGuard)
export class PunchMakeupController {
  constructor(private readonly punchMakeupService: PunchMakeupService) {}

  @Get()
  @HttpCode(200)
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.punchMakeupService.list({
      page: pageNum,
      pageSize: pageSizeNum,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      startDate,
      endDate,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Get(':id')
  @HttpCode(200)
  async detail(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.punchMakeupService.detail(id, req!.user.id);
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  async create(@Body() body: unknown, @Req() req: RequestContext) {
    const parsed = parseBody(makeupCreateSchema, body);
    const data = await this.punchMakeupService.create({
      ...parsed,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: RequestContext,
  ) {
    const parsed = parseBody(makeupUpdateSchema, body);
    const data = await this.punchMakeupService.update(id, req!.user.id, parsed);
    return { code: 0, data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.punchMakeupService.remove(id, req!.user.id);
    return { code: 0, data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.punchMakeupService.submit(id, req!.user.id);
    return { code: 0, data };
  }
}
