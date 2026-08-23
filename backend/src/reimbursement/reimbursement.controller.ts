import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, HttpCode, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ReimbursementService } from './reimbursement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { parsePagination } from '../common/pagination.util';

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

  @Post()
  @HttpCode(200)
  @RequirePermission('reimbursement:view')
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.reimbursementService.create({
      userId: req.user.id,
      typeCode: body.typeCode,
      title: body.title,
      description: body.description,
      totalAmount: body.totalAmount,
      items: body.items,
    });
    return { code: 0, data };
  }

  @Get('mine')
  @RequirePermission('reimbursement:view')
  async listMine(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize }, { defaultPageSize: 10 });
    const data = await this.reimbursementService.listMine(
      req.user.id,
      pageNum,
      pageSizeNum,
    );
    return { code: 0, data };
  }

  @Get('pending')
  @RequirePermission('reimbursement:view')
  async listPending(
    @Req() req: any,
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
  async getDetail(@Param('id') id: string, @Req() req: any) {
    const data = await this.reimbursementService.getDetail(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission('reimbursement:view')
  async submit(@Param('id') id: string, @Req() req: any) {
    const data = await this.reimbursementService.submit(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Get('export')
  @RequirePermission('reimbursement:view')
  async exportExcel(
    @Req() req: any,
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
