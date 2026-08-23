import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, Req, UseGuards, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { HelpdeskService } from './helpdesk.service';

// 工单创建校验
const ticketCreateSchema = z.object({
  title: z.string().min(1, '工单标题必填').max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
});

// 工单更新校验（状态 / 指派等）
const ticketUpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    category: z.string().max(50).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.string().max(20).optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
  })
  .partial();

// SLA 创建校验
const slaSchema = z.object({
  name: z.string().min(1, 'SLA 名称必填').max(100),
  priority: z.string().min(1).max(20),
  firstResponseMinutes: z.number().int().min(0).optional(),
  resolutionMinutes: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});
const updateSlaSchema = slaSchema.partial();

// 工单列表筛选参数校验
const ticketListSchema = z.object({
  status: z.string().max(20).optional(),
  priority: z.string().max(20).optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
});

// ===== 工单路由 =====
@Controller('helpdesk/tickets')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HelpdeskTicketsController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Get()
  @RequirePermission('helpdesk:view')
  async list(@Query() query: unknown) {
    const parsed = ticketListSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const result = await this.helpdeskService.listTickets(parsed.data);
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('helpdesk:manage')
  async create(@Body() body: unknown, @Req() req: any) {
    const parsed = ticketCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const ticket = await this.helpdeskService.createTicket({
      ...parsed.data,
      requesterId: req.user?.id,
    });
    return { code: 0, message: 'ok', data: ticket };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('helpdesk:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = ticketUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const ticket = await this.helpdeskService.updateTicket(id, parsed.data);
    return { code: 0, message: 'ok', data: ticket };
  }

  @Put(':id/resolve')
  @HttpCode(200)
  @RequirePermission('helpdesk:manage')
  async resolve(@Param('id', ParseIntPipe) id: number) {
    const ticket = await this.helpdeskService.resolveTicket(id);
    return { code: 0, message: 'ok', data: ticket };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('helpdesk:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.helpdeskService.removeTicket(id);
    return { code: 0, message: 'ok', data: result };
  }
}

// ===== SLA 路由 =====
@Controller('helpdesk/slas')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HelpdeskSlasController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Get()
  @RequirePermission('helpdesk:view')
  async list() {
    const result = await this.helpdeskService.listSlas();
    return { code: 0, message: 'ok', data: result };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('helpdesk:sla:manage')
  async create(@Body() body: unknown) {
    const parsed = slaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const sla = await this.helpdeskService.createSla(parsed.data);
    return { code: 0, message: 'ok', data: sla };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('helpdesk:sla:manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = updateSlaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: parsed.error.issues[0]?.message ?? '参数校验失败' });
    }
    const sla = await this.helpdeskService.updateSla(id, parsed.data);
    return { code: 0, message: 'ok', data: sla };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('helpdesk:sla:manage')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.helpdeskService.removeSla(id);
    return { code: 0, message: 'ok', data: result };
  }
}