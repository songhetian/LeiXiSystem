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
  Res,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { OperationLogService } from './operation-log.service';
import { BroadcastService } from './broadcast.service';
import { SystemUserService } from './system-user.service';
import { DictService } from './dict.service';
import { DataCleanupService } from './data-cleanup.service';
import { CreateBroadcastDto, UpdateBroadcastDto } from './dto/broadcast.dto';
import { CreateUserDto, UpdateUserDto, AssignUserRolesDto } from './dto/user.dto';
import { CreateRoleDto, UpdateRoleDto, AssignRolePermissionsDto } from './dto/role.dto';
import { parsePagination } from '../common/pagination.util';

@ApiTags('系统管理')
@Controller('system')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemController {
  constructor(
    private readonly operationLogService: OperationLogService,
    private readonly broadcastService: BroadcastService,
    private readonly systemUserService: SystemUserService,
    private readonly dictService: DictService,
    private readonly dataCleanupService: DataCleanupService,
  ) {}

  // ===== 操作日志 =====
  @Get('logs')
  @HttpCode(200)
  @RequirePermission('system:log:view')
  async listLogs(
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('ip') ip?: string,
    @Query('keyword') keyword?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.operationLogService.listLogs({
      userId: userId ? parseInt(userId) : undefined,
      module,
      action,
      status,
      ip,
      keyword,
      startDate,
      endDate,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Get('logs/modules')
  @HttpCode(200)
  @RequirePermission('system:log:view')
  async getLogModules() {
    const data = await this.operationLogService.getModules();
    return { code: 0, data };
  }

  @Get('logs/actions')
  @HttpCode(200)
  @RequirePermission('system:log:view')
  async getLogActions(@Query('module') module?: string) {
    const data = await this.operationLogService.getActions(module);
    return { code: 0, data };
  }

  @Get('logs/stats')
  @HttpCode(200)
  @RequirePermission('system:log:view')
  async getLogStats() {
    const data = await this.operationLogService.getStats();
    return { code: 0, data };
  }

  @Get('logs/export')
  @RequirePermission('system:log:view')
  async exportLogs(
    @Res() res: FastifyReply,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('module') module?: string,
    @Query('operatorId') operatorId?: string,
    @Query('action') action?: string,
    @Query('statusCode') statusCode?: string,
    @Query('ip') ip?: string,
    @Query('keyword') keyword?: string,
  ) {
    const buffer = await this.operationLogService.exportExcel({
      startDate,
      endDate,
      module,
      operatorId: operatorId ? parseInt(operatorId) : undefined,
      action,
      statusCode,
      ip,
      keyword,
    });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="operation_logs_${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  // ===== 公告管理 =====
  @Get('broadcasts')
  @HttpCode(200)
  @RequirePermission('system:broadcast:manage')
  async listBroadcasts(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.broadcastService.list({
      status,
      type,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Get('broadcasts/:id')
  @HttpCode(200)
  @RequirePermission('system:broadcast:manage')
  async getBroadcast(@Param('id', ParseIntPipe) id: number) {
    const data = await this.broadcastService.getDetail(id, undefined, true);
    return { code: 0, data };
  }

  @Post('broadcasts')
  @HttpCode(200)
  @RequirePermission('system:broadcast:manage')
  async createBroadcast(@Body() body: CreateBroadcastDto, @Req() req: any) {
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
  @RequirePermission('system:broadcast:manage')
  async updateBroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBroadcastDto,
  ) {
    const data = await this.broadcastService.update(id, body);
    return { code: 0, data };
  }

  @Post('broadcasts/:id/publish')
  @HttpCode(200)
  @RequirePermission('system:broadcast:manage')
  async publishBroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const data = await this.broadcastService.publish(id, req.user.id);
    return { code: 0, data };
  }

  @Delete('broadcasts/:id')
  @HttpCode(200)
  @RequirePermission('system:broadcast:manage')
  async deleteBroadcast(@Param('id', ParseIntPipe) id: number) {
    const data = await this.broadcastService.delete(id);
    return { code: 0, data };
  }

  // ===== 用户管理 =====
  @Get('users')
  @HttpCode(200)
  @RequirePermission('system:user:view')
  async listUsers(
    @Query('keyword') keyword?: string,
    @Query('roleId') roleId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.systemUserService.listUsers({
      keyword,
      roleId: roleId ? parseInt(roleId) : undefined,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Post('users')
  @HttpCode(200)
  @RequirePermission('system:user:manage')
  async createUser(@Body() body: CreateUserDto) {
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
  @RequirePermission('system:user:manage')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ) {
    const data = await this.systemUserService.updateUser(id, body);
    return { code: 0, data };
  }

  @Post('users/:id/roles')
  @HttpCode(200)
  @RequirePermission('system:user:manage')
  async assignUserRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignUserRolesDto,
  ) {
    const data = await this.systemUserService.assignRoles(id, body.roleIds || []);
    return { code: 0, data };
  }

  // ===== 角色管理 =====
  @Get('roles')
  @HttpCode(200)
  @RequirePermission('system:role:view')
  async listRoles() {
    const data = await this.systemUserService.listRoles();
    return { code: 0, data };
  }

  @Get('permissions')
  @HttpCode(200)
  @RequirePermission('system:role:view')
  async listPermissions() {
    const data = await this.systemUserService.listPermissions();
    return { code: 0, data };
  }

  @Post('roles')
  @HttpCode(200)
  @RequirePermission('system:role:manage')
  async createRole(@Body() body: CreateRoleDto) {
    const data = await this.systemUserService.createRole({
      code: body.code,
      name: body.name,
      description: body.description,
    });
    return { code: 0, data };
  }

  @Post('roles/:id/permissions')
  @HttpCode(200)
  @RequirePermission('system:role:manage')
  async assignRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignRolePermissionsDto,
  ) {
    const data = await this.systemUserService.assignPermissions(id, body.permissionIds || []);
    return { code: 0, data };
  }

  @Delete('users/:id')
  @HttpCode(200)
  @RequirePermission('system:user:manage')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.deleteUser(id);
    return { code: 0, data };
  }

  @Post('users/:id/restore')
  @HttpCode(200)
  @RequirePermission('system:user:manage')
  async restoreUser(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.restoreUser(id);
    return { code: 0, data };
  }

  @Put('roles/:id')
  @HttpCode(200)
  @RequirePermission('system:role:manage')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRoleDto,
  ) {
    const data = await this.systemUserService.updateRole(id, {
      name: body.name,
      description: body.description,
    });
    return { code: 0, data };
  }

  @Delete('roles/:id')
  @HttpCode(200)
  @RequirePermission('system:role:manage')
  async deleteRole(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.deleteRole(id);
    return { code: 0, data };
  }

  @Get('departments')
  @HttpCode(200)
  @RequirePermission('department:manage')
  async listDepartments() {
    const data = await this.systemUserService.listDepartments();
    return { code: 0, data };
  }

  @Post('departments')
  @HttpCode(200)
  @RequirePermission('department:manage')
  async createDepartment(@Body() body: { name: string; parentId?: number; managerId?: number }) {
    const data = await this.systemUserService.createDepartment(body);
    return { code: 0, data };
  }

  @Put('departments/:id')
  @HttpCode(200)
  @RequirePermission('department:manage')
  async updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; parentId?: number | null; managerId?: number | null },
  ) {
    const data = await this.systemUserService.updateDepartment(id, body);
    return { code: 0, data };
  }

  @Delete('departments/:id')
  @HttpCode(200)
  @RequirePermission('department:manage')
  async deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.deleteDepartment(id);
    return { code: 0, data };
  }

  @Post('departments/:id/restore')
  @HttpCode(200)
  @RequirePermission('department:manage')
  async restoreDepartment(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.restoreDepartment(id);
    return { code: 0, data };
  }

  @Get('positions')
  @HttpCode(200)
  @RequirePermission('position:manage')
  async listPositions() {
    const data = await this.systemUserService.listPositions();
    return { code: 0, data };
  }

  @Post('positions')
  @HttpCode(200)
  @RequirePermission('position:manage')
  async createPosition(@Body() body: { name: string }) {
    const data = await this.systemUserService.createPosition(body);
    return { code: 0, data };
  }

  @Put('positions/:id')
  @HttpCode(200)
  @RequirePermission('position:manage')
  async updatePosition(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string },
  ) {
    const data = await this.systemUserService.updatePosition(id, body);
    return { code: 0, data };
  }

  @Delete('positions/:id')
  @HttpCode(200)
  @RequirePermission('position:manage')
  async deletePosition(@Param('id', ParseIntPipe) id: number) {
    const data = await this.systemUserService.deletePosition(id);
    return { code: 0, data };
  }

  // ===== 字典管理 =====
  @Get('dict/types')
  @HttpCode(200)
  @RequirePermission('dict:view')
  async listDictTypes(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.dictService.listTypes({
      page: pageNum,
      pageSize: pageSizeNum,
      keyword,
    });
    return { code: 0, data };
  }

  @Get('dict/types/all')
  @HttpCode(200)
  async allDictTypes() {
    const data = await this.dictService.allTypes();
    return { code: 0, data };
  }

  @Post('dict/types')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async createDictType(@Body() body: { code: string; name: string; description?: string; status?: string }) {
    const data = await this.dictService.createType(body);
    return { code: 0, data };
  }

  @Put('dict/types/:id')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async updateDictType(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string; status?: string },
  ) {
    const data = await this.dictService.updateType(id, body);
    return { code: 0, data };
  }

  @Delete('dict/types/:id')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async deleteDictType(@Param('id', ParseIntPipe) id: number) {
    const data = await this.dictService.deleteType(id);
    return { code: 0, data };
  }

  @Get('dict/types/:id/items')
  @HttpCode(200)
  @RequirePermission('dict:view')
  async listDictItems(@Param('id', ParseIntPipe) id: number) {
    const data = await this.dictService.listItems(id);
    return { code: 0, data };
  }

  @Get('dict/by-code/:code')
  @HttpCode(200)
  async getDictByCode(@Param('code') code: string) {
    const data = await this.dictService.listItemsByCode(code);
    return { code: 0, data };
  }

  @Post('dict/items')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async createDictItem(@Body() body: { typeId: number; label: string; value: string; sort?: number; status?: string; remark?: string }) {
    const data = await this.dictService.createItem(body);
    return { code: 0, data };
  }

  @Put('dict/items/:id')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async updateDictItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { label?: string; value?: string; sort?: number; status?: string; remark?: string },
  ) {
    const data = await this.dictService.updateItem(id, body);
    return { code: 0, data };
  }

  @Delete('dict/items/:id')
  @HttpCode(200)
  @RequirePermission('dict:manage')
  async deleteDictItem(@Param('id', ParseIntPipe) id: number) {
    const data = await this.dictService.deleteItem(id);
    return { code: 0, data };
  }

  // ===== 数据清理 =====
  @Post('cleanup/trigger')
  @HttpCode(200)
  @RequirePermission('system:config:edit')
  async triggerCleanup() {
    const data = await this.dataCleanupService.cleanAll();
    return { code: 0, data };
  }
}
