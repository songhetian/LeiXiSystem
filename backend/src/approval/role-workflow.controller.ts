import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RoleWorkflowService } from './role-workflow.service';

@Controller('approval')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleWorkflowController {
  constructor(private readonly roleWorkflowService: RoleWorkflowService) {}

  // 职责授权：角色 + 绑定流程列表
  @Get('roles/workflows')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async listRoleWorkflows() {
    const data = await this.roleWorkflowService.listRoleWorkflows();
    return { code: 0, data };
  }

  // 职责授权：绑定/解除角色流程（workflowId = null 解除）
  @Put('roles/:roleId/workflow')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async setRoleWorkflow(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() body: { workflowId?: number | null },
  ) {
    const data = await this.roleWorkflowService.setRoleWorkflow(
      roleId,
      body.workflowId ?? null,
    );
    return { code: 0, data };
  }
}