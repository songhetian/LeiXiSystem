import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve, basename, extname, sep } from 'path';
import { StorageDriver } from './storage-driver.interface';
import { LocalStorageDriver } from './local-storage.driver';
import { OssStorageDriver } from './oss-storage.driver';

export const FILE_STORAGE_DIR = 'FILE_STORAGE_DIR';

@Injectable()
export class FilesService {
  private readonly driver: StorageDriver;

  constructor(
    @Inject(FILE_STORAGE_DIR)
    private readonly baseDir: string = resolve(process.cwd(), 'uploads'),
  ) {
    // 按 FILE_STORAGE 切换存储驱动：开发默认 local（本地磁盘），生产 oss（阿里云 OSS）
    this.driver =
      String(process.env.FILE_STORAGE || 'local').toLowerCase() === 'oss'
        ? new OssStorageDriver()
        : new LocalStorageDriver(this.baseDir);
  }

  /**
   * 将上传缓冲保存到所选存储驱动，返回相对 URL（/uploads/{bizType}/{name}）供入库。
   */
  async save(
    buffer: Buffer,
    originalName: string,
    bizType: string = 'common',
  ): Promise<{ url: string; fileName: string }> {
    return this.driver.save(buffer, originalName, bizType);
  }

  /**
   * 将相对上传路径解析为绝对磁盘路径，并保证落在 baseDir 内（防目录穿越）。
   * 兼容带 /uploads/ 前缀的入库 URL（如 getDetail 返回的 attachmentUrl）。
   */
  resolveDiskPath(relativePath: string): string {
    const cleaned = relativePath.replace(/^\/+/, '').replace(/^uploads\//, '');
    const abs = resolve(this.baseDir, cleaned);
    const baseWithSep = resolve(this.baseDir) + sep;
    if (abs !== resolve(this.baseDir) && !abs.startsWith(baseWithSep)) {
      throw new BadRequestException({ code: 4000, message: '非法的文件路径' });
    }
    return abs;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * 入库 URL 的统一前置校验：OSS 驱动的 readStream 直接把 URL 当 object key，
   * 缺少本地驱动那层「是否落在 uploads 内」的保护，需在驱动之前拦一次穿越。
   * 只拦危险构造（空/../反斜杠/NUL），不限制业务目录与文件名字符集，
   * 避免误伤历史数据里的文件名。
   */
  private assertSafeFileUrl(fileUrl: string): void {
    const cleaned = String(fileUrl).replace(/^\/+/, '');
    if (
      !cleaned ||
      cleaned.includes('..') ||
      cleaned.includes('\\') ||
      cleaned.includes('\0')
    ) {
      throw new BadRequestException({ code: 4000, message: '非法的文件路径' });
    }
  }

  /**
   * 按入库 URL 打开文件读流（本地磁盘 / OSS 由驱动决定），供下载/预览使用。
   * serve、知识库附件、公开 Logo 三个入口共用，确保 OSS 模式均可读。
   */
  async openStream(fileUrl: string): Promise<{ stream: import('stream').Readable }> {
    this.assertSafeFileUrl(fileUrl);
    return this.driver.readStream(fileUrl);
  }
}