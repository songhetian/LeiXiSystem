import { Controller, Get, Post, Param, Query, Req, UseGuards, HttpCode, ParseIntPipe, BadRequestException, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PayslipService } from './payslip.service';
import { verifyPayslipPasswordSchema, type VerifyPayslipPasswordDto } from './dto/verify-password.dto';
import { parsePagination } from '../common/pagination.util';
import { ERROR_CODES } from '../common/error-codes';
import type { RequestContext } from '../types/fastify';

@Controller('payslips')
@UseGuards(JwtAuthGuard)
export class PayslipController {
  constructor(private readonly payslipService: PayslipService) {}

  /** 工资条二级密码验证：通过后 5 分钟内可连续查看明细 */
  @Post('me/verify-password')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:my:view')
  async verifyPassword(@Body() body: VerifyPayslipPasswordDto, @Req() req?: RequestContext) {
    const parsed = verifyPayslipPasswordSchema.safeParse(body);
    if (!parsed.success) {
      // 不能用 3013（PAYSLIP_PASSWORD_REQUIRED）：那个码会被中央文案改写成
      // 「查看工资条需先完成二级密码验证」，且前端把它当预期内联错误吞掉，
      // 用户会看到自相矛盾、也无法感知格式错误的提示。
      throw new BadRequestException({
        code: ERROR_CODES.PAYSLIP_PASSWORD_FORMAT_INVALID,
        message: parsed.error.issues[0]?.message || '二级密码格式不正确',
      });
    }
    const data = await this.payslipService.verifyPassword(req!.user.id, parsed.data.password);
    return { code: 0, data };
  }

  @Get('me')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:my:view')
  async myPayslips(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('month') month?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.payslipService.getMyPayslips(
      req!.user.id,
      pageNum,
      pageSizeNum,
      month,
    );
    return { code: 0, data };
  }

  /**
   * 我的年度累计（应发/扣款/实发三项合计 + 月份数）。
   * 必须声明在 `me/:id` 之前，否则 `summary` 会被 ParseIntPipe 当成 id 拦下。
   */
  @Get('me/summary')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:my:view')
  async myYearSummary(@Query('year') year?: string, @Req() req?: RequestContext) {
    const normalized = (year ?? '').trim();
    if (!/^\d{4}$/.test(normalized)) {
      throw new BadRequestException({
        code: ERROR_CODES.PAYSLIP_YEAR_INVALID,
        message: '年份参数不合法',
      });
    }
    const data = await this.payslipService.getMyYearSummary(req!.user.id, normalized);
    return { code: 0, data };
  }

  @Get('me/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:my:view')
  async myPayslipDetail(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.payslipService.getMyPayslipDetail(req!.user.id, id);
    return { code: 0, data };
  }

  @Post('me/:id/view')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:my:view')
  async markViewed(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.payslipService.markAsViewed(req!.user.id, id);
    return { code: 0, data };
  }

  /** 管理端工资条详情（受数据权限约束），HR 核对明细用 */
  @Get(':id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:view')
  async detail(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.payslipService.getPayslipDetail(req!.user.id, id);
    return { code: 0, data };
  }

  @Get()
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('payroll:view')
  async list(
    @Query('runId') runId?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.payslipService.listPayslips({
      userId: req!.user.id,
      runId: runId ? parseInt(runId) : undefined,
      month,
      status,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }
}
