import { Controller, Get, Query, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceDailyService } from './attendance-daily.service';
import { AttendanceDailyRecalcService } from './attendance-daily-recalc.service';
import { parsePagination } from '../common/pagination.util';

@ApiTags('考勤日报')
@Controller('attendance/daily')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceDailyController {
  constructor(
    private readonly dailyService: AttendanceDailyService,
    private readonly recalcService: AttendanceDailyRecalcService,
  ) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.dailyService.list({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      startDate,
      endDate,
      status,
      userId: req.user.id,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Post('recalc')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async recalc(@Body() body: any, @Req() req: any) {
    const startDate = body.startDate;
    const endDate = body.endDate;
    const startTime = Date.now();

    const task = await this.recalcService.createTask({
      startDate,
      endDate,
      userId: req.user.id,
      triggerType: 'manual',
    });

    try {
      const data = await this.dailyService.recalculate({
        employeeId: body.employeeId ? parseInt(body.employeeId) : undefined,
        startDate,
        endDate,
        userId: req.user.id,
      });
      const durationMs = Date.now() - startTime;
      await this.recalcService.completeTask(task.id, true, data.count, durationMs);
      return { code: 0, data: { count: data.count, taskId: task.id } };
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      await this.recalcService.completeTask(task.id, false, 0, durationMs, e.message);
      throw e;
    }
  }

  @Get('recalc/tasks')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async recalcTasks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.recalcService.listTasks({
      page: pageNum,
      pageSize: pageSizeNum,
      status,
    });
    return { code: 0, data };
  }
}
