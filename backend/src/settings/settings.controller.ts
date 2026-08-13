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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @HttpCode(200)
  async list(@Query('group') group?: string) {
    return { code: 0, data: await this.settings.list(group) };
  }

  @Get(':key')
  @HttpCode(200)
  async get(@Param('key') key: string) {
    return { code: 0, data: await this.settings.get(key) };
  }

  @Put(':key')
  @HttpCode(200)
  @RequirePermission('system:setting:update')
  async upsert(
    @Param('key') key: string,
    @Body() body: { value: string; label?: string; description?: string; group?: string },
    @Req() req: any,
  ) {
    const updated = await this.settings.upsert(
      key,
      { value: body.value, label: body.label, description: body.description, group: body.group },
      req.user?.id,
    );
    return { code: 0, data: updated };
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('system:setting:update')
  async bulkUpsert(
    @Body() body: { items: Array<{ key: string; value: string; label?: string; description?: string; group?: string }> },
    @Req() req: any,
  ) {
    const updated = await this.settings.bulkUpsert(body.items ?? [], req.user?.id);
    return { code: 0, data: updated };
  }

  @Delete(':key')
  @HttpCode(200)
  @RequirePermission('system:setting:update')
  async remove(@Param('key') key: string) {
    await this.settings.remove(key);
    return { code: 0, data: null };
  }
}
