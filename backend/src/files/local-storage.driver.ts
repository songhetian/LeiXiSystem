import { BadRequestException } from '@nestjs/common';
import { mkdirSync, writeFileSync, createReadStream, existsSync } from 'fs';
import { join, resolve, extname, basename, sep } from 'path';
import { randomBytes } from 'crypto';
import { StorageDriver } from './storage-driver.interface';

const SAFE_BIZ_TYPE = /^[\w-]{1,50}$/;

/**
 * 本地磁盘存储驱动（开发/默认）：写入 uploads/{bizType}/ 目录。
 * 上线接 OSS 时，以 OssStorageDriver 实现 StorageDriver 并切换注入即可。
 */
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly baseDir: string = resolve(process.cwd(), 'uploads')) {}

  async save(
    buffer: Buffer,
    originalName: string,
    bizType: string = 'common',
  ): Promise<{ url: string; fileName: string }> {
    if (!SAFE_BIZ_TYPE.test(bizType)) {
      throw new BadRequestException({ code: 4000, message: '非法的业务目录' });
    }

    const ext = extname(basename(originalName)).toLowerCase();
    const timestamp = new Date()
      .toISOString()
      .replace(/\D/g, '')
      .slice(0, 14);
    const random = randomBytes(4).toString('hex');
    const randomName = `${timestamp}-${random}${ext}`;

    const targetDir = join(this.baseDir, bizType);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, randomName), buffer);

    return { url: `/uploads/${bizType}/${randomName}`, fileName: basename(originalName) };
  }

  /** 本地磁盘读取：将入库 URL 规范化为 uploads 内绝对路径，防目录穿越。 */
  async readStream(fileUrl: string): Promise<{ stream: import('stream').Readable }> {
    const cleaned = String(fileUrl).replace(/^\/+/, '').replace(/^uploads\//, '');
    const abs = resolve(this.baseDir, cleaned);
    const baseWithSep = resolve(this.baseDir) + sep;
    if (abs !== resolve(this.baseDir) && !abs.startsWith(baseWithSep)) {
      throw new BadRequestException({ code: 4000, message: '非法的文件路径' });
    }
    if (!existsSync(abs)) {
      throw new BadRequestException({ code: 5003, message: '文件不存在或已被删除' });
    }
    return { stream: createReadStream(abs) as import('stream').Readable };
  }
}