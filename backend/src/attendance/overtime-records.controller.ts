import { Controller, Get, Query, Post, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';
import { CreateOvertimeDto, OvertimeActionDto } from './dto/overtime-record.dto';
import type { RequestContext } from '../types/fastify';

@Controller('overtime-records')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OvertimeRecordsController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async listMine(@Req() req?: RequestContext) {
    const data = await this.vacationService.listMyOvertime(req!.user.id);
    return { code: 0, data };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Req() req?: RequestContext,
  ) {
    const data = await this.vacationService.listOvertime({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  // 员工自助发起加班：同请假，挂个人自助权限点（staff 未绑 attendance:manage）。
  // service 层按数据范围限制只能为本人建单。
  @RequirePermission(['personal:overtime:apply', 'attendance:manage'])
  async create(@Body() body: CreateOvertimeDto, @Req() req: RequestContext) {
    const record = await this.vacationService.createOvertime({
      employeeId: body.employeeId,
      overtimeDate: body.overtimeDate,
      startTime: body.startTime,
      endTime: body.endTime,
      hours: Number(body.hours),
      reason: body.reason,
    }, req!.user.id);
    return { code: 0, data: record };
  }

  @Post(':id/submit')
  @HttpCode(200)
  // 同请假：提交只能本人（service 校验 emp.userId === userId），
  // 挂 attendance:manage 是走不通的死分支，代录单由员工本人提交。
  @RequirePermission('personal:overtime:apply')
  async submit(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.vacationService.submitOvertime(parseInt(id), req!.user.id);
    return { code: 0, data };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async approve(@Param('id') id: string, @Body() body: OvertimeActionDto, @Req() req: RequestContext) {
    const data = await this.vacationService.approveOvertime(parseInt(id), req!.user.id, body.comment);
    return { code: 0, data };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async reject(@Param('id') id: string, @Body() body: OvertimeActionDto, @Req() req: RequestContext) {
    const data = await this.vacationService.rejectOvertime(parseInt(id), req!.user.id, body.comment);
    return { code: 0, data };
  }
}
