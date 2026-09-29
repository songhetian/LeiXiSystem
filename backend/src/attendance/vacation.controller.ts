import { Controller, Get, Query, Post, Body, Req, UseGuards, HttpCode, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';
import { parsePagination } from '../common/pagination.util';
import { beijingNow } from '../common/date.util';
import type { RequestContext } from '../types/fastify';

@Controller('vacation')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('me/balances')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async getMyBalancesSelf(@Query('year') year?: string, @Req() req?: RequestContext) {
    const y = year ? parseInt(year) : undefined;
    const data = await this.vacationService.getMyBalances(req!.user.id, y);
    return { code: 0, data };
  }

  @Get('me/leaves')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyLeaves(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('vacationType') vacationType?: string,
    @Query('status') status?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.vacationService.listMyLeaveRecords(
      req!.user.id,
      pageNum,
      pageSizeNum,
      vacationType,
      status,
    );
    return { code: 0, data };
  }

  @Get('balances/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getMyBalances(@Query('year') year?: string, @Req() req?: RequestContext) {
    const y = year ? parseInt(year) : undefined;
    const data = await this.vacationService.getMyBalances(req!.user.id, y);
    return { code: 0, data };
  }

  @Get('balances/changes/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getMyChanges(@Req() req?: RequestContext) {
    const data = await this.vacationService.listMyChanges(req!.user.id);
    return { code: 0, data };
  }

  @Get('balances')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getBalances(
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
    @Req() req?: RequestContext,
  ) {
    const y = year ? parseInt(year) : beijingNow().year;
    const data = await this.vacationService.listBalances({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      year: y,
      userId: req!.user.id,
    });
    return { code: 0, data: data.list };
  }

  @Post('convert')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async convertOvertime(@Body() body: any, @Req() req: RequestContext) {
    const data = await this.vacationService.convertOvertimeToCompensatory({
      employeeId: body.employeeId,
      overtimeId: body.overtimeId,
      vacationTypeId: body.vacationTypeId,
      hours: body.hours,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Post('convert/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async convertOvertimeMine(@Body() body: any, @Req() req: RequestContext) {
    const data = await this.vacationService.convertOvertimeToCompensatoryMine({
      overtimeId: body.overtimeId,
      vacationTypeId: body.vacationTypeId,
      hours: body.hours,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  /**
   * 手动初始化年度假期额度（幂等，已存在的额度跳过）。
   * 定时任务之外的人工入口：新部署、补录新员工、新增假期类型后立即生效。
   */
  @Post('balances/initialize')
  @HttpCode(200)
  @RequirePermission('vacation:manage')
  async initializeBalances(@Body() body: any) {
    const year = body?.year ? parseInt(String(body.year)) : beijingNow().year;
    const employeeId = body?.employeeId ? parseInt(String(body.employeeId)) : undefined;
    await this.vacationService.initializeYearBalances(year, employeeId);
    return { code: 0, data: { year, employeeId: employeeId ?? null } };
  }

  @Post('balances/adjust')
  @HttpCode(200)
  @RequirePermission('vacation:balance:adjust')
  async adjustBalance(@Body() body: any, @Req() req: RequestContext) {
    const data = await this.vacationService.adjustBalance({
      employeeId: body.employeeId,
      vacationTypeId: body.vacationTypeId,
      year: body.year,
      changeDays: body.changeDays,
      reason: body.reason,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Get('balance-changes')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getBalanceChanges(
    @Query('employeeId') employeeId?: string,
    @Query('vacationTypeId') vacationTypeId?: string,
    @Query('year') year?: string,
    @Query('changeType') changeType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.vacationService.listBalanceChanges({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      vacationTypeId: vacationTypeId ? parseInt(vacationTypeId) : undefined,
      year: year ? parseInt(year) : undefined,
      changeType,
      userId: req!.user.id,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Get('statistics')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getStatistics(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('departmentId') departmentId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('keyword') keyword?: string,
    @Req() req?: RequestContext,
  ) {
    const y = year ? parseInt(year) : beijingNow().year;
    const m = month ? parseInt(month) : beijingNow().month;
    const data = await this.vacationService.getAttendanceStatistics({
      userId: req!.user.id,
      year: y,
      month: m,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      keyword,
    });
    return { code: 0, data };
  }

  @Get('export')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async exportLeaves(
    @Req() req: RequestContext,
    @Res() res: FastifyReply,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.vacationService.exportLeaveRecords(req!.user.id, {
      status,
      type,
      startDate,
      endDate,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
    });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="vacation_${Date.now()}.xlsx"`);
    res.send(buffer);
  }
}
