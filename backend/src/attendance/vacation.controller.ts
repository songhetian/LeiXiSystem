import { Controller, Get, Query, Post, Body, Req, UseGuards, HttpCode, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';

@Controller('vacation')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('balances/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getMyBalances(@Query('year') year?: string, @Req() req?: any) {
    const y = year ? parseInt(year) : undefined;
    const data = await this.vacationService.getMyBalances(req.user.id, y);
    return { code: 0, data };
  }

  @Get('balances/changes/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getMyChanges(@Req() req?: any) {
    const data = await this.vacationService.listMyChanges(req.user.id);
    return { code: 0, data };
  }

  @Get('balances')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async getBalances(
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.vacationService.listBalances({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      year: y,
      userId: req.user.id,
    });
    return { code: 0, data: data.list };
  }

  @Post('convert')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async convertOvertime(@Body() body: any, @Req() req: any) {
    const data = await this.vacationService.convertOvertimeToCompensatory({
      employeeId: body.employeeId,
      overtimeId: body.overtimeId,
      vacationTypeId: body.vacationTypeId,
      hours: body.hours,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('convert/mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async convertOvertimeMine(@Body() body: any, @Req() req: any) {
    const data = await this.vacationService.convertOvertimeToCompensatoryMine({
      overtimeId: body.overtimeId,
      vacationTypeId: body.vacationTypeId,
      hours: body.hours,
      userId: req.user.id,
    });
    return { code: 0, data };
  }
}
