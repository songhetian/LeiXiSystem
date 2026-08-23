import { Controller, Get, Query, Post, Body, Param, Req, UseGuards, HttpCode, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceMonthlyService } from './attendance-monthly.service';
import { parsePagination } from '../common/pagination.util';

@Controller('attendance/monthly')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceMonthlyController {
  constructor(private readonly monthlyService: AttendanceMonthlyService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('employeeId') employeeId?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.monthlyService.list({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      month,
      status,
      userId: req.user.id,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Post('generate')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async generate(@Body() body: any, @Req() req: any) {
    const data = await this.monthlyService.generate({
      employeeId: body.employeeId ? parseInt(body.employeeId) : undefined,
      month: body.month,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async confirm(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.monthlyService.confirm(id, req.user.id);
    return { code: 0, data };
  }

  @Post(':id/unconfirm')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async unconfirm(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.monthlyService.unconfirm(id, req.user.id);
    return { code: 0, data };
  }
}
