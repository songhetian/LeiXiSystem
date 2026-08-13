import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(200)
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('read') read?: string,
    @Query('type') type?: string,
    @Req() req?: any,
  ) {
    const data = await this.notificationService.list(req.user.id, {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      read: read === undefined ? undefined : read === 'true',
      type,
    });
    return { code: 0, data };
  }

  @Get('unread-count')
  @HttpCode(200)
  async unreadCount(@Req() req: any) {
    const data = await this.notificationService.unreadCount(req.user.id);
    return { code: 0, data };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@Param('id') id: string, @Req() req: any) {
    const data = await this.notificationService.markRead(parseInt(id), req.user.id);
    return { code: 0, data };
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@Req() req: any) {
    const data = await this.notificationService.markAllRead(req.user.id);
    return { code: 0, data };
  }
}
