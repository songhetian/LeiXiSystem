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

  // 职责授权：可分配角色（流程设置页的「按角色审批」下拉复用）
  @Get('role-options')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async listRoleOptions() {
    const data = await this.roleWorkflowService.listAssignableRoles();
    return { code: 0, data };
  }

  // 职责授权：流程 + 各自适用的角色（含可分配角色全集，供多选框使用）
  @Get('role-bindings')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async listWorkflowBindings() {
    const data = await this.roleWorkflowService.listWorkflowBindings();
    return { code: 0, data };
  }

  // 职责授权：覆盖式保存某条流程的适用角色（空数组 = 不绑定任何角色）
  @Put('role-bindings/:workflowId')
  @HttpCode(200)
  @RequirePermission('approval:workflow:manage')
  async setWorkflowRoles(
    @Param('workflowId', ParseIntPipe) workflowId: number,
    @Body() body: { roleIds?: number[] },
  ) {
    const data = await this.roleWorkflowService.setWorkflowRoles(
      workflowId,
      body.roleIds ?? [],
    );
    return { code: 0, data };
  }
}
