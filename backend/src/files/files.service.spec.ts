import { existsSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { BadRequestException } from '@nestjs/common';
import { FilesService } from './files.service';
import { messageOf } from '../common/error-messages';

/** 取出异常响应体，便于断言业务错误码 */
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

// 切换 OSS 驱动时避免真实实例化阿里云客户端
jest.mock('ali-oss', () => ({
  __esModule: true,
  default: jest.fn(() => ({ put: jest.fn(), get: jest.fn() })),
}));

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

describe('FilesService - 通用文件上传（本地磁盘）', () => {
  let service: FilesService;
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'lei-upload-test-'));
    service = new FilesService(baseDir);
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  describe('save - 保存文件到本地 uploads 目录', () => {
    it('写入 bizType 子目录并生成随机文件名（保留原扩展名）', async () => {
      const buffer = Buffer.from('invoice-content');
      const result = await service.save(buffer, '发票.pdf', 'reimbursement');

      expect(result.fileName).toBe('发票.pdf');
      // url 形如 /uploads/reimbursement/{时间戳}-{随机}.pdf
      expect(result.url).toMatch(/^\/uploads\/reimbursement\/\d+-\w+\.pdf$/);

      const savedPath = join(baseDir, 'reimbursement', result.url.split('/').pop()!);
      expect(existsSync(savedPath)).toBe(true);
      expect(readFileSync(savedPath).toString()).toBe('invoice-content');
    });

    it('bizType 缺省时存到 common 目录', async () => {
      const result = await service.save(Buffer.from('x'), 'a.txt');
      expect(result.url).toMatch(/^\/uploads\/common\/.+\.txt$/);
    });

    it('无扩展名文件使用默认无末尾扩展名的随机名', async () => {
      const result = await service.save(Buffer.from('x'), 'noext');
      expect(result.url).toMatch(/^\/uploads\/common\/\d+-[\w]+$/);
    });
  });

  describe('save - 安全防护', () => {
    it('拒绝 bizType 含路径穿越（../）', async () => {
      await expect(
        service.save(Buffer.from('x'), 'a.txt', '../../etc'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolveDiskPath - 供静态读取的安全解析', () => {
    it('解析相对上传路径并保证落在 uploads 目录内', () => {
      const relative = 'reimbursement/123-abc.png';
      const abs = service.resolveDiskPath(relative);
      expect(abs.startsWith(baseDir)).toBe(true);
      expect(existsSync(abs) || join(baseDir, relative) === abs).toBe(true);
    });

    it('拒绝目录穿越路径', () => {
      expect(() => service.resolveDiskPath('../secret.txt')).toThrow(BadRequestException);
    });
  });

  describe('openStream - 按存储驱动读取文件流（本地磁盘）', () => {
    it('返回可读流，内容与保存时一致', async () => {
      const { url } = await service.save(Buffer.from('stream-content'), '读取.pdf', 'reimbursement');
      const { stream } = await service.openStream(url);
      expect(await streamToString(stream)).toBe('stream-content');
    });

    it('带 /uploads/ 前缀的入库 URL 亦可读取', async () => {
      const { url } = await service.save(Buffer.from('abc'), 'a.txt');
      const { stream } = await service.openStream(`/uploads/common/${url.split('/').pop()}`);
      expect(await streamToString(stream)).toBe('abc');
    });

    it('文件不存在时抛 FILE_NOT_FOUND(5018)，不得复用 5003（前端对 5003 不弹 toast，会造成静默失败）', async () => {
      const payload = await catchPayload(() =>
        service.openStream('/uploads/reimbursement/nonexist.pdf'),
      );

      expect(payload.code).not.toBe(5003);
      expect(payload.code).toBe(5018);
      expect(messageOf(payload.code)).toBe('文件不存在或已被删除');
    });

    it('拒绝目录穿越路径', async () => {
      await expect(service.openStream('/uploads/../secret.txt')).rejects.toThrow(BadRequestException);
    });
  });

  describe('FilesService - 按 FILE_STORAGE 切换存储驱动', () => {
    const prevEnv = process.env.FILE_STORAGE;
    afterEach(() => {
      if (prevEnv === undefined) delete process.env.FILE_STORAGE;
      else process.env.FILE_STORAGE = prevEnv;
    });

    it('FILE_STORAGE=oss 时注入 OssStorageDriver 并无参构造走 env 配置', () => {
      process.env.FILE_STORAGE = 'oss';
      process.env.OSS_REGION = 'oss-cn-hangzhou';
      process.env.OSS_BUCKET = 'b';
      process.env.OSS_ACCESS_KEY = 'ak';
      process.env.OSS_ACCESS_SECRET = 'sk';
      const svc = new FilesService(baseDir);
      expect((svc as any).driver).toBeInstanceOf(
        require('./oss-storage.driver').OssStorageDriver,
      );
    });

    it('缺省 / local 时使用本地磁盘驱动', () => {
      process.env.FILE_STORAGE = 'local';
      const svc = new FilesService(baseDir);
      expect((svc as any).driver).toBeInstanceOf(
        require('./local-storage.driver').LocalStorageDriver,
      );
    });
  });
});