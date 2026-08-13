import { Controller, Get, Post, HttpCode, Query, Req, Res, Body, Param, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { createReadStream } from 'fs';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance-monthly')
  @HttpCode(200)
  @RequirePermission('reports:view')
  async attendanceMonthly(@Query('month') month: string, @Req() req: any) {
    const data = await this.reportsService.attendanceMonthly({
      month,
      userId: req.user.id,
    });
    return { code: 0, message: 'ok', data };
  }

  @Get('labor-cost')
  @HttpCode(200)
  @RequirePermission('reports:view')
  async laborCost(@Query('month') month: string, @Req() req: any) {
    const data = await this.reportsService.laborCost({
      month,
      userId: req.user.id,
    });
    return { code: 0, message: 'ok', data };
  }

  @Get('attendance-monthly/export')
  @RequirePermission('reports:view')
  async exportAttendanceMonthly(@Query('month') month: string, @Req() req: any, @Res() res: any) {
    const csv = await this.reportsService.exportAttendanceMonthlyCsv({
      month,
      userId: req.user.id,
    });
    const filename = `attendance-monthly-${month}.csv`;
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('labor-cost/export')
  @RequirePermission('reports:view')
  async exportLaborCost(@Query('month') month: string, @Req() req: any, @Res() res: any) {
    const csv = await this.reportsService.exportLaborCostCsv({
      month,
      userId: req.user.id,
    });
    const filename = `labor-cost-${month}.csv`;
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission('reports:view')
  async createExportTask(@Body() body: any, @Req() req: any) {
    const data = await this.reportsService.createExportTask({
      type: body.type,
      format: body.format,
      month: body.month,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('export/tasks')
  @HttpCode(200)
  @RequirePermission('reports:view')
  async listExportTasks(@Req() req: any) {
    const data = await this.reportsService.listTasks(req.user.id);
    return { code: 0, data };
  }

  @Get('export/:id/status')
  @HttpCode(200)
  @RequirePermission('reports:view')
  async getExportStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.reportsService.getTaskStatus(parseInt(id), req.user.id);
    return { code: 0, data };
  }

  @Get('export/:id/download')
  @RequirePermission('reports:view')
  async downloadExport(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const { filePath, fileName } = await this.reportsService.getTaskFilePath(parseInt(id), req.user.id);
    const stream = createReadStream(filePath);
    res.header('Content-Disposition', `attachment; filename="${fileName}"`);
    res.type(fileName.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8');
    res.send(stream);
  }
}
