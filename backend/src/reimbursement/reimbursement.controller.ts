import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, HttpCode, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ReimbursementService } from './reimbursement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { parsePagination } from '../common/pagination.util';
import { ApproveReimbursementDto, RejectReimbursementDto } from './dto/reimbursement-action.dto';
import type { RequestContext } from '../types/fastify';

@Controller('reimbursements')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Get('types')
  @RequirePermission('reimbursement:view')
  async listTypes() {
    const data = await this.reimbursementService.listTypes();
    return { code: 0, data };
  }

  @Get('types/all')
  @RequirePermission('reimbursement:manage')
  async listAllTypes() {
    const data = await this.reimbursementService.listAllTypes();
    return { code: 0, data };
  }

  @Post('types')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async createType(@Body() body: any) {
    const data = await this.reimbursementService.createType({
      code: body.code,
      name: body.name,
      description: body.description,
    });
    return { code: 0, data };
  }

  @Put('types/:id')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async updateType(@Param('id') id: string, @Body() body: any) {
    const data = await this.reimbursementService.updateType(parseInt(id), {
      name: body.name,
      description: body.description,
      status: body.status,
    });
    return { code: 0, data };
  }

  @Delete('types/:id')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async removeType(@Param('id') id: string) {
    const data = await this.reimbursementService.removeType(parseInt(id));
    return { code: 0, data };
  }

  // ===== 二级费用类型（对齐老项目 expense_types）=====
  @Get('expense-types')
  @RequirePermission('reimbursement:view')
  async listExpenseTypes() {
    const data = await this.reimbursementService.listExpenseTypes();
    return { code: 0, data };
  }

  @Get('expense-types/all')
  @RequirePermission('reimbursement:manage')
  async listAllExpenseTypes() {
    const data = await this.reimbursementService.listAllExpenseTypes();
    return { code: 0, data };
  }

  @Post('expense-types')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async createExpenseType(@Body() body: any) {
    const data = await this.reimbursementService.createExpenseType({
      name: body.name,
      unit: body.unit,
      sortOrder: body.sortOrder,
    });
    return { code: 0, data };
  }

  @Put('expense-types/:id')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async updateExpenseType(@Param('id') id: string, @Body() body: any) {
    const data = await this.reimbursementService.updateExpenseType(parseInt(id), {
      name: body.name,
      unit: body.unit,
      sortOrder: body.sortOrder,
      status: body.status,
    });
    return { code: 0, data };
  }

  @Delete('expense-types/:id')
  @HttpCode(200)
  @RequirePermission('reimbursement:manage')
  async removeExpenseType(@Param('id') id: string) {
    const data = await this.reimbursementService.removeExpenseType(parseInt(id));
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('reimbursement:create')
  async create(@Body() body: any, @Req() req: RequestContext) {
    const data = await this.reimbursementService.create({
      userId: req.user.id,
      typeCode: body.typeCode,
      title: body.title,
      remark: body.remark ?? body.description,
      totalAmount: body.totalAmount,
      status: body.status,
      items: body.items,
      attachments: body.attachments,
    });
    return { code: 0, data };
  }

  @Get('mine')
  @RequirePermission('reimbursement:view')
  async listMine(
    @Req() req: RequestContext,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize }, { defaultPageSize: 10 });
    const data = await this.reimbursementService.listMine(
      req.user.id,
      pageNum,
      pageSizeNum,
      status,
    );
    return { code: 0, data };
  }

  @Get('pending')
  @RequirePermission('reimbursement:view')
  async listPending(
    @Req() req: RequestContext,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize }, { defaultPageSize: 10 });
    const data = await this.reimbursementService.listPending(
      req.user.id,
      pageNum,
      pageSizeNum,
    );
    return { code: 0, data };
  }

  @Get(':id')
  @RequirePermission('reimbursement:view')
  async getDetail(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.reimbursementService.getDetail(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('reimbursement:create')
  async submit(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.reimbursementService.submit(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('reimbursement:create')
  async cancel(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.reimbursementService.cancel(Number(id), req.user.id);
    return { code: 0, data };
  }

  /**
   * 审批人通过报销单。
   * 业务状态由审批实例事件驱动（reimbursement.listener），这里只负责推进审批流，
   * 因此权限点用 reimbursement:approve 而非 reimbursement:create。
   */
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('reimbursement:approve')
  async approveForApprover(
    @Param('id') id: string,
    @Body() body: ApproveReimbursementDto,
    @Req() req: RequestContext,
  ) {
    const data = await this.reimbursementService.approveForApprover(
      Number(id),
      req.user.id,
      '',
      body?.comment,
    );
    return { code: 0, data };
  }

  /** 审批人驳回报销单：驳回原因必填由 RejectReimbursementDto 强制（400 PARAM_INVALID） */
  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('reimbursement:approve')
  async rejectForApprover(
    @Param('id') id: string,
    @Body() body: RejectReimbursementDto,
    @Req() req: RequestContext,
  ) {
    const data = await this.reimbursementService.rejectForApprover(
      Number(id),
      req.user.id,
      '',
      body?.comment,
    );
    return { code: 0, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('reimbursement:create')
  async remove(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.reimbursementService.remove(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Get('export')
  @RequirePermission('reimbursement:view')
  async exportExcel(
    @Req() req: RequestContext,
    @Res() res: FastifyReply,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.reimbursementService.exportExcel(req.user.id, {
      status,
      type,
      startDate,
      endDate,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
    });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="reimbursements_${Date.now()}.xlsx"`);
    res.send(buffer);
  }
}
