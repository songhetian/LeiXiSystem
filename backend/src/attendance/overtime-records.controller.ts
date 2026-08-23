import { Controller, Get, Query, Post, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';
import { CreateOvertimeDto, OvertimeActionDto } from './dto/overtime-record.dto';

@Controller('overtime-records')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OvertimeRecordsController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async listMine(@Req() req?: any) {
    const data = await this.vacationService.listMyOvertime(req.user.id);
    return { code: 0, data };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const data = await this.vacationService.listOvertime({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async create(@Body() body: CreateOvertimeDto, @Req() req: any) {
    const record = await this.vacationService.createOvertime({
      employeeId: body.employeeId,
      overtimeDate: body.overtimeDate,
      startTime: body.startTime,
      endTime: body.endTime,
      hours: Number(body.hours),
      reason: body.reason,
    }, req.user.id);
    return { code: 0, data: record };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async submit(@Param('id') id: string, @Req() req: any) {
    const data = await this.vacationService.submitOvertime(parseInt(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async approve(@Param('id') id: string, @Body() body: OvertimeActionDto, @Req() req: any) {
    const data = await this.vacationService.approveOvertime(parseInt(id), req.user.id, body.comment);
    return { code: 0, data };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async reject(@Param('id') id: string, @Body() body: OvertimeActionDto, @Req() req: any) {
    const data = await this.vacationService.rejectOvertime(parseInt(id), req.user.id, body.comment);
    return { code: 0, data };
  }
}
