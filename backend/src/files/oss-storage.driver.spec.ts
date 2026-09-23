import { OssStorageDriver } from './oss-storage.driver';

/**
 * mock ali-oss：不在单测中发起真实 OSS 请求。
 * default 构造返回固定的 { put, get } 桩，用于断言 key / buffer 与读取结果。
 */
jest.mock('ali-oss', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    put: jest.fn(),
    get: jest.fn(),
  })),
}));

import OSS from 'ali-oss';
const OSSMock = OSS as unknown as jest.Mock;

const OSS_CONFIG = {
  region: 'oss-cn-hangzhou',
  bucket: 'leixi-files',
  accessKeyId: 'ak',
  accessKeySecret: 'sk',
  endpoint: 'oss-cn-hangzhou.aliyuncs.com',
};

function clientOf(driver: OssStorageDriver): any {
  return (driver as any).client;
}

describe('OssStorageDriver - 阿里云 OSS 存储', () => {
  let driver: OssStorageDriver;

  beforeEach(() => {
    OSSMock.mockClear();
    driver = new OssStorageDriver(OSS_CONFIG);
  });

  it('用传入配置创建阿里云 OSS 客户端', () => {
    expect(OSSMock).toHaveBeenCalledTimes(1);
    expect(OSSMock).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'leixi-files', accessKeyId: 'ak' }),
    );
  });

  it('save 上传到 OSS uploads/bizType/ 目录并返回相对 URL', async () => {
    const client = clientOf(driver);
    client.put.mockResolvedValue({});
    const buffer = Buffer.from('oss-content');
    const result = await driver.save(buffer, '合同.docx', 'knowledge');

    expect(result.url).toMatch(/^\/uploads\/knowledge\/\d+-\w+\.docx$/);
    expect(result.fileName).toBe('合同.docx');
    const key = result.url.replace(/^\//, '');
    expect(client.put).toHaveBeenCalledWith(key, buffer);
  });

  it('save 拒绝非法 bizType（路径穿越）', async () => {
    await expect(driver.save(Buffer.from('x'), 'a.txt', '../../etc')).rejects.toThrow();
    expect(clientOf(driver).put).not.toHaveBeenCalled();
  });

  it('readStream 从 OSS 读取对象，返回流，key 去除前导斜杠', async () => {
    const client = clientOf(driver);
    const fakeStream = { read: true };
    client.get.mockResolvedValue({ stream: fakeStream });
    const res = await driver.readStream('/uploads/knowledge/2026xyz.pdf');
    expect(client.get).toHaveBeenCalledWith('uploads/knowledge/2026xyz.pdf');
    expect(res.stream).toBe(fakeStream);
  });
});