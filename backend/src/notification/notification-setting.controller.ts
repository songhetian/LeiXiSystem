import { Controller, Get, Put, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { NotificationSettingService } from './notification-setting.service';

@Controller('notification-settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationSettingController {
  constructor(private readonly settingService: NotificationSettingService) {}

  // 全部事件的通知推送目标配置
  @Get()
  @HttpCode(200)
  @RequirePermission('system:notification:settings')
  async list() {
    return { code: 0, data: await this.settingService.list() };
  }

  // 可选的推送目标（伪角色 + 系统角色）
  @Get('roles')
  @HttpCode(200)
  @RequirePermission('system:notification:settings')
  async listRoles() {
    return { code: 0, data: await this.settingService.listRoles() };
  }

  // 更新/新建某事件的通知策略
  @Put(':eventType')
  @HttpCode(200)
  @RequirePermission('system:notification:settings')
  async setTargets(
    @Param('eventType') eventType: string,
    @Body() body: { targetRoles?: string[]; targetNodes?: string[] },
  ) {
    const data = await this.settingService.setTargets(eventType, body ?? {});
    return { code: 0, data };
  }
}