import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ApprovalService } from './approval.service';

@Controller('approval')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  // ===== 审批流配置 =====
  @Get('workflows')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async listWorkflows(@Query('module') module?: string) {
    const data = await this.approvalService.listWorkflows(module);
    return { code: 0, data };
  }

  @Post('workflows')
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async createWorkflow(@Body() body: any) {
    const data = await this.approvalService.createWorkflow({
      code: body.code,
      name: body.name,
      module: body.module,
      status: body.status,
      nodes: body.nodes || [],
    });
    return { code: 0, data };
  }

  // ===== 发起审批 =====
  @Post('instances')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async startInstance(@Body() body: any, @Req() req: any) {
    const data = await this.approvalService.startInstance({
      workflowCode: body.workflowCode,
      title: body.title,
      formData: body.formData,
      userId: req.user.id,
      userName: req.user.name,
      departmentId: body.departmentId,
    });
    return { code: 0, data };
  }

  @Get('instances/:id')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async getInstance(@Param('id', ParseIntPipe) id: number) {
    const data = await this.approvalService.getInstanceDetail(id);
    return { code: 0, data };
  }

  // ===== 审批处理 =====
  @Post('instances/:id/approve')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const data = await this.approvalService.approve({
      instanceId: id,
      userId: req.user.id,
      userName: req.user.name,
      comment: body.comment,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/reject')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const data = await this.approvalService.reject({
      instanceId: id,
      userId: req.user.id,
      userName: req.user.name,
      comment: body.comment,
    });
    return { code: 0, data };
  }

  // ===== 待办中心 =====
  @Get('todos')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async listTodos(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.approvalService.listTodos(req.user.id, {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }

  // ===== 我的申请 =====
  @Get('my-submissions')
  @HttpCode(200)
  @RequirePermission('approval:use')
  async listMySubmissions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.approvalService.listMySubmissions(req.user.id, {
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }
}
