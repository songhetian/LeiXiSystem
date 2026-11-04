import {
  Controller,
  Post,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createReadStream } from 'fs';
import { extname, basename } from 'path';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../types/fastify';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** @fastify/multipart 已在 FastifyRequest 扩展 file(): Promise<MultipartFile | undefined>，无需再定义。 */

@Controller('files')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * 通用文件上传（本地磁盘）：POST /api/v1/files/upload?bizType=xxx
   * Fastify 4 内核自带 multipart 解析，入参经权限校验。
   */
  @Post('upload')
  @HttpCode(200)
  @RequirePermission('file:upload')
  async upload(
    @Req() req: AuthenticatedRequest,
    @Query('bizType') bizType?: string,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException({ code: 4000, message: '请选择文件' });
    }
    const buffer = await file.toBuffer();
    const result = await this.filesService.save(buffer, file.filename || 'file', bizType || 'common');
    return { code: 0, message: '上传成功', data: result };
  }

  /**
   * 读取上传的静态文件：GET /api/v1/files/serve?path=reimbursement/xx.png
   * 仅返回 uploads 目录内的文件，防目录穿越。
   */
  @Get('serve')
  @RequirePermission('file:view')
  async serve(@Query('path') relativePath: string, @Res() res: FastifyReply) {
    if (!relativePath) {
      throw new BadRequestException({ code: 4000, message: '缺少文件路径' });
    }
    const absPath = this.filesService.resolveDiskPath(relativePath);
    const ext = extname(basename(relativePath)).toLowerCase();
    res.header('Content-Type', MIME_MAP[ext] || 'application/octet-stream');
    res.header('Cache-Control', 'no-store');
    res.send(createReadStream(absPath));
  }
}