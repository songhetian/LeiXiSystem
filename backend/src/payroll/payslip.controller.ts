import { Controller, Get, Post, Param, Query, Req, UseGuards, HttpCode, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PayslipService } from './payslip.service';
import { parsePagination } from '../common/pagination.util';

@Controller('payslips')
@UseGuards(JwtAuthGuard)
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  @Get('me')
  @HttpCode(200)
  async myPayslips(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.payslipService.getMyPayslips(
      req.user.id,
      pageNum,
      pageSizeNum,
    );
    return { code: 0, data };
  }

  @Get('me/:id')
  @HttpCode(200)
  async myPayslipDetail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.payslipService.getMyPayslipDetail(req.user.id, id);
    return { code: 0, data };
  }

  @Post('me/:id/view')
  @HttpCode(200)
  async markViewed(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.payslipService.markAsViewed(req.user.id, id);
    return { code: 0, data };
  }

  @Get()
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:view')
  async list(
    @Query('runId') runId?: string,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.payslipService.listPayslips({
      userId: req.user.id,
      runId: runId ? parseInt(runId) : undefined,
      month,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }
}
