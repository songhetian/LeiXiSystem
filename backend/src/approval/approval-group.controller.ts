import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, HttpCode, Req } from '@nestjs/common';
import { ApprovalGroupService } from './approval-group.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { parsePagination } from '../common/pagination.util';

@Controller('approval/groups')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalGroupController {
  constructor(private readonly approvalGroupService: ApprovalGroupService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.approvalGroupService.list({
      page: pageNum,
      pageSize: pageSizeNum,
      keyword,
      status: status !== undefined ? parseInt(status) : undefined,
    });
    return { code: 0, data };
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async detail(@Param('id') id: string) {
    const data = await this.approvalGroupService.detail(parseInt(id));
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async create(
    @Body() body: { name: string; code: string; description?: string; memberIds?: number[] },
    @Req() req: any,
  ) {
    const data = await this.approvalGroupService.create({
      ...body,
      createdBy: req.user.id,
    });
    return { code: 0, data };
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; memberIds?: number[]; status?: number },
  ) {
    const data = await this.approvalGroupService.update(parseInt(id), body);
    return { code: 0, data };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('approval:manage')
  async remove(@Param('id') id: string) {
    const data = await this.approvalGroupService.remove(parseInt(id));
    return { code: 0, data };
  }
}
