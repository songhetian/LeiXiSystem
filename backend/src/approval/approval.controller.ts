import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { StartInstanceDto } from './dto/start-instance.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { parsePagination } from '../common/pagination.util';

@Controller('approval')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  // ===== 审批流配置 =====
  @Get('workflows')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async listWorkflows(@Query('module') module?: string) {
    const data = await this.approvalService.listWorkflows(module);
    return { code: 0, data };
  }

  @Get('workflows/available')
  @HttpCode(200)
  @RequirePermission('approval:submitted:view')
  async listAvailableWorkflows(@Query('module') module?: string) {
    const data = await this.approvalService.listWorkflows(module, 'active');
    return { code: 0, data };
  }

  @Get('workflows/:id')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async getWorkflow(@Param('id', ParseIntPipe) id: number) {
    const data = await this.approvalService.getWorkflowDetail(id);
    return { code: 0, data };
  }

  @Post('workflows')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async createWorkflow(@Body() body: CreateWorkflowDto) {
    const data = await this.approvalService.createWorkflow({
      code: body.code,
      name: body.name,
      module: body.module,
      status: body.status,
      maxResubmits: body.maxResubmits,
      nodes: body.nodes || [],
    });
    return { code: 0, data };
  }

  @Put('workflows/:id')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async updateWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateWorkflowDto,
  ) {
    const data = await this.approvalService.updateWorkflow(id, {
      name: body.name,
      module: body.module,
      status: body.status,
      maxResubmits: body.maxResubmits,
      nodes: body.nodes,
    });
    return { code: 0, data };
  }

  @Delete('workflows/:id')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async deleteWorkflow(@Param('id', ParseIntPipe) id: number) {
    const data = await this.approvalService.deleteWorkflow(id);
    return { code: 0, data };
  }

  @Post('workflows/:id/restore')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async restoreWorkflow(@Param('id', ParseIntPipe) id: number) {
    const data = await this.approvalService.restoreWorkflow(id);
    return { code: 0, data };
  }

  // ===== 发起审批 =====
  @Post('instances')
  @HttpCode(200)
  @RequirePermission('approval:submitted:view')
  async startInstance(@Body() body: StartInstanceDto, @Req() req: any) {
    const data = await this.approvalService.startInstance({
      workflowCode: body.workflowCode,
      title: body.title,
      formData: body.formData,
      userId: req.user.id,
      userName: '',
      departmentId: body.departmentId,
    });
    return { code: 0, data };
  }

  @Get('instances/:id')
  @HttpCode(200)
  @RequirePermission('approval:submitted:view')
  async getInstance(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.approvalService.getInstanceDetail(id, req.user.id);
    return { code: 0, data };
  }

  // ===== 审批处理 =====
  @Post('instances/:id/approve')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApprovalActionDto,
    @Req() req: any,
  ) {
    const data = await this.approvalService.approve({
      instanceId: id,
      userId: req.user.id,
      userName: '',
      comment: body.comment,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/reject')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApprovalActionDto,
    @Req() req: any,
  ) {
    const data = await this.approvalService.reject({
      instanceId: id,
      userId: req.user.id,
      userName: '',
      comment: body.comment,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/withdraw')
  @HttpCode(200)
  async withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const data = await this.approvalService.withdraw({
      instanceId: id,
      userId: req.user.id,
      reason: body.reason,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/resubmit')
  @HttpCode(200)
  @RequirePermission('approval:apply')
  async resubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { formData?: Record<string, any> },
    @Req() req: any,
  ) {
    const data = await this.approvalService.resubmit({
      instanceId: id,
      userId: req.user.id,
      formData: body.formData,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/transfer')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { targetUserId: number; comment?: string },
    @Req() req: any,
  ) {
    const data = await this.approvalService.transfer({
      instanceId: id,
      userId: req.user.id,
      targetUserId: body.targetUserId,
      comment: body.comment,
    });
    return { code: 0, data };
  }

  @Post('instances/:id/add-sign')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async addSign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { targetUserId: number; position: 'before' | 'after'; comment?: string },
    @Req() req: any,
  ) {
    const data = await this.approvalService.addSign({
      instanceId: id,
      userId: req.user.id,
      targetUserId: body.targetUserId,
      position: body.position,
      comment: body.comment,
    });
    return { code: 0, data };
  }

  // ===== 待办中心 =====
  @Get('todos')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async listTodos(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.approvalService.listTodos(req.user.id, {
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  // ===== 我的申请 =====
  @Get('my-submissions')
  @HttpCode(200)
  @RequirePermission('approval:submitted:view')
  async listMySubmissions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.approvalService.listMySubmissions(req.user.id, {
      status,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  // ===== 我已审批（已办）=====
  @Get('my-approved')
  @HttpCode(200)
  @RequirePermission('approval:todo:view')
  async listMyApproved(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.approvalService.listMyApproved(req.user.id, {
      status,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  // ===== 审批意见模板 =====
  @Get('comment-templates')
  @HttpCode(200)
  async listCommentTemplates(@Query('type') type?: string) {
    const data = await this.approvalService.listCommentTemplates(type);
    return { code: 0, data };
  }

  @Post('comment-templates')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async createCommentTemplate(@Body() body: any) {
    const data = await this.approvalService.createCommentTemplate(body);
    return { code: 0, data };
  }

  @Put('comment-templates/:id')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async updateCommentTemplate(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.approvalService.updateCommentTemplate(id, body);
    return { code: 0, data };
  }

  @Delete('comment-templates/:id')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async deleteCommentTemplate(@Param('id', ParseIntPipe) id: number) {
    const data = await this.approvalService.deleteCommentTemplate(id);
    return { code: 0, data };
  }
}
