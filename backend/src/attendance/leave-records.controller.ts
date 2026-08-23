import { Controller, Get, Query, Post, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';
import { CreateLeaveRecordDto, LeaveActionDto } from './dto/leave-record.dto';
import { parsePagination } from '../common/pagination.util';

@Controller('leave-records')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeaveRecordsController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async listMine(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('vacationType') vacationType?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.vacationService.listMyLeaveRecords(
      req.user.id,
      pageNum,
      pageSizeNum,
      vacationType,
      status,
    );
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
    const data = await this.vacationService.listLeaveRecords({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async create(@Body() body: CreateLeaveRecordDto, @Req() req: any) {
    const record = await this.vacationService.createLeaveRecord(
      {
        employeeId: body.employeeId,
        vacationTypeId: body.vacationTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        days: Number(body.days),
        reason: body.reason,
      },
      req.user.id,
    );
    return { code: 0, data: record };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async submit(@Param('id') id: string, @Req() req: any) {
    const data = await this.vacationService.submitLeave(parseInt(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async approve(@Param('id') id: string, @Body() body: LeaveActionDto, @Req() req: any) {
    const data = await this.vacationService.approveLeave(parseInt(id), req.user.id, body.comment);
    return { code: 0, data };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async reject(@Param('id') id: string, @Body() body: LeaveActionDto, @Req() req: any) {
    const data = await this.vacationService.rejectLeave(parseInt(id), req.user.id, body.comment);
    return { code: 0, data };
  }
}
