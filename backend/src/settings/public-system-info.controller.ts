import { Controller, Get, HttpCode, Res, NotFoundException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { extname, basename } from 'path';
import { SettingsService } from './settings.service';
import { FilesService } from '../files/files.service';
import { ERROR_CODES } from '../common/error-codes';

const LOGO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * 系统公开信息（无需登录）：供登录页 / 侧边栏读取系统名称与 Logo。
 * 刻意不挂 JwtAuthGuard/PermissionGuard，仅受全局限流(ThrottlerGuard)保护。
 */
@Controller('public/system')
export class PublicSystemInfoController {
  private readonly DEFAULT_NAME = '雷犀管理系统';

  constructor(
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  @Get('info')
  @HttpCode(200)
  async info() {
    const rows = await this.settings.list('general');
    const get = (key: string, fallback = '') =>
      rows.find((r) => r.key === key)?.value ?? fallback;

    const name = get('system.name', this.DEFAULT_NAME);
    const logo = get('system.logo');

    return {
      code: 0,
      data: {
        name,
        logo, // 相对路径(/uploads/...) 或完整 URL，由前端 resolveFileUrl 处理
      },
    };
  }

  /**
   * 公开返回系统 Logo 图片流：避免登录页(未登录)请求受保护的 /files/serve 而 401。
   * 仅支持相对路径(本地磁盘)；OSS 环境留给前端拼接完整 URL 读取。
   */
  @Get('logo')
  @HttpCode(200)
  async logo(@Res() res: FastifyReply) {
    const rows = await this.settings.list('general');
    const logo = rows.find((r) => r.key === 'system.logo')?.value;

    if (!logo || /^https?:\/\//.test(logo)) {
      throw new NotFoundException({ code: ERROR_CODES.SETTING_NOT_FOUND, message: '未配置系统 Logo' });
    }

    const { stream } = await this.files.openStream(logo);
    const ext = extname(basename(logo)).toLowerCase();
    res.header('Content-Type', LOGO_MIME[ext] || 'image/png');
    res.header('Cache-Control', 'private, max-age=3600');
    res.send(stream);
  }
}