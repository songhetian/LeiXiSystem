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
import { OperationLogService } from './operation-log.service';
import { BroadcastService } from './broadcast.service';
import { SystemUserService } from './system-user.service';

@Controller('system')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemController {
  constructor(
    private readonly operationLogService: OperationLogService,
    private readonly broadcastService: BroadcastService,
    private readonly systemUserService: SystemUserService,
  ) {}

  // ===== 操作日志 =====
  @Get('logs')
  @HttpCode(200)
  @RequirePermission('system:view')
  async listLogs(
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.operationLogService.listLogs({
      userId: userId ? parseInt(userId) : undefined,
      module,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }

  // ===== 公告管理 =====
  @Get('broadcasts')
  @HttpCode(200)
  @RequirePermission('system:view')
  async listBroadcasts(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.broadcastService.list({
      status,
      type,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }

  @Get('broadcasts/:id')
  @HttpCode(200)
  @RequirePermission('system:view')
  async getBroadcast(@Param('id', ParseIntPipe) id: number) {
    const data = await this.broadcastService.getDetail(id, undefined, true);
    return { code: 0, data };
  }

  @Post('broadcasts')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async createBroadcast(@Body() body: any, @Req() req: any) {
    const data = await this.broadcastService.create({
      title: body.title,
      content: body.content,
      type: body.type,
      priority: body.priority,
      userId: req.user.id,
      recipientType: body.recipientType,
      recipientDepartmentIds: body.recipientDepartmentIds,
      recipientUserIds: body.recipientUserIds,
    });
    return { code: 0, data };
  }

  @Put('broadcasts/:id')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async updateBroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const data = await this.broadcastService.update(id, body);
    return { code: 0, data };
  }

  @Post('broadcasts/:id/publish')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async publishBroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const data = await this.broadcastService.publish(id, req.user.id);
    return { code: 0, data };
  }

  @Delete('broadcasts/:id')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async deleteBroadcast(@Param('id', ParseIntPipe) id: number) {
    const data = await this.broadcastService.delete(id);
    return { code: 0, data };
  }

  // ===== 用户管理 =====
  @Get('users')
  @HttpCode(200)
  @RequirePermission('system:view')
  async listUsers(
    @Query('keyword') keyword?: string,
    @Query('roleId') roleId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.systemUserService.listUsers({
      keyword,
      roleId: roleId ? parseInt(roleId) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }

  @Post('users')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async createUser(@Body() body: any) {
    const data = await this.systemUserService.createUser({
      username: body.username,
      password: body.password,
      name: body.name,
      roleIds: body.roleIds,
    });
    return { code: 0, data };
  }

  @Put('users/:id')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const data = await this.systemUserService.updateUser(id, body);
    return { code: 0, data };
  }

  @Post('users/:id/roles')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async assignUserRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const data = await this.systemUserService.assignRoles(id, body.roleIds || []);
    return { code: 0, data };
  }

  // ===== 角色管理 =====
  @Get('roles')
  @HttpCode(200)
  @RequirePermission('system:view')
  async listRoles() {
    const data = await this.systemUserService.listRoles();
    return { code: 0, data };
  }

  @Get('permissions')
  @HttpCode(200)
  @RequirePermission('system:view')
  async listPermissions() {
    const data = await this.systemUserService.listPermissions();
    return { code: 0, data };
  }

  @Post('roles')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async createRole(@Body() body: any) {
    const data = await this.systemUserService.createRole({
      code: body.code,
      name: body.name,
      description: body.description,
    });
    return { code: 0, data };
  }

  @Post('roles/:id/permissions')
  @HttpCode(200)
  @RequirePermission('system:manage')
  async assignRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const data = await this.systemUserService.assignPermissions(id, body.permissionIds || []);
    return { code: 0, data };
  }
}
