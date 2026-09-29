import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BroadcastService } from './broadcast.service';
import { parsePagination } from '../common/pagination.util';
import type { RequestContext } from '../types/fastify';

@Controller('broadcasts')
@UseGuards(JwtAuthGuard)
export class BroadcastPublicController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get()
  @HttpCode(200)
  async listPublished(
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.broadcastService.list({
      type,
      page: pageNum,
      pageSize: pageSizeNum,
      onlyPublished: true,
      userId: req?.user?.id,
    });
    return { code: 0, data };
  }

  @Get('unread-count')
  @HttpCode(200)
  async unreadCount(@Req() req: RequestContext) {
    const data = await this.broadcastService.unreadCount(req!.user.id);
    return { code: 0, data };
  }

  @Get(':id')
  @HttpCode(200)
  async getDetail(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.broadcastService.getPublicDetail(id, req!.user.id);
    return { code: 0, data };
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@Param('id', ParseIntPipe) id: number, @Req() req: RequestContext) {
    const data = await this.broadcastService.markRead(id, req!.user.id);
    return { code: 0, data };
  }
}
