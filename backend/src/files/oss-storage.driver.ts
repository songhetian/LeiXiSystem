import { BadRequestException } from '@nestjs/common';
import { extname, basename } from 'path';
import { randomBytes } from 'crypto';
import { StorageDriver } from './storage-driver.interface';
import OSS from 'ali-oss';

const SAFE_BIZ_TYPE = /^[\w-]{1,50}$/;

export interface OssConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
}

/**
 * 阿里云 OSS 存储驱动（生产）：上传写 OSS uploads/{bizType}/，读取走 OSS get。
 * 与 LocalStorageDriver 共享 StorageDriver 契约，按 FILE_STORAGE 环境变量在 FilesService 切换。
 */
export class OssStorageDriver implements StorageDriver {
  private readonly client: any;

  constructor(config?: OssConfig) {
    const bucket = config?.bucket ?? process.env.OSS_BUCKET ?? '';
    const region = config?.region ?? process.env.OSS_REGION ?? '';
    const accessKeyId = config?.accessKeyId ?? process.env.OSS_ACCESS_KEY ?? '';
    const accessKeySecret = config?.accessKeySecret ?? process.env.OSS_ACCESS_SECRET ?? '';
    const endpoint = config?.endpoint ?? process.env.OSS_ENDPOINT;

    if (!bucket || !region || !accessKeyId || !accessKeySecret) {
      throw new BadRequestException({
        code: 4000,
        message:
          'OSS 未配置：请设置 OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY/OSS_ACCESS_SECRET',
      });
    }

    this.client = new (OSS as any)({
      region,
      bucket,
      accessKeyId,
      accessKeySecret,
      ...(endpoint ? { endpoint } : {}),
    });
  }

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
    const name = `${timestamp}-${random}${ext}`;
    const key = `uploads/${bizType}/${name}`;

    await this.client.put(key, buffer);
    return { url: `/${key}`, fileName: basename(originalName) };
  }

  async readStream(fileUrl: string): Promise<{ stream: import('stream').Readable }> {
    const key = String(fileUrl).replace(/^\/+/, '');
    const result = await this.client.get(key);
    if (!result?.stream) {
      throw new BadRequestException({ code: 5003, message: '文件不存在或已被删除' });
    }
    return { stream: result.stream as import('stream').Readable };
  }
}