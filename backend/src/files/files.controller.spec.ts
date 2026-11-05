// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：files 端点此前无权限点（当时 file:upload
// 未注册）。seed 已定义并给 staff 绑定 file:upload / file:view，按语义收口；
// 前端 /files/serve 均为同源 <img>/<a> 引用，JWT 走 httpOnly cookie 自动携带，不受影响。
import { Reflector } from '@nestjs/core';
import { BadRequestException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof FilesController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, FilesController.prototype[method]);

describe('FilesController — 端点权限矩阵', () => {
  it('upload 挂 file:upload、serve 挂 file:view（此前无守卫）', () => {
    expect(permOf('upload')).toBe('file:upload');
    expect(permOf('serve')).toBe('file:view');
  });
});

/**
 * 生产回归闸门：FILE_STORAGE=oss 时，报销附件与系统 Logo 仍走 /files/serve。
 * 旧实现用 createReadStream 直读容器本地磁盘，OSS 模式必然读不到文件。
 * 这里断言 serve 把读取委托给 FilesService.openStream（由存储驱动决定来源）。
 */
describe('FilesController — serve 委托存储驱动', () => {
  function makeReply(): any {
    return { header: jest.fn().mockReturnThis(), send: jest.fn() };
  }

  it('把 path 交给 openStream，并把返回的流写给响应（OSS 可读）', async () => {
    const stream = { pipe: jest.fn() };
    const openStream = jest.fn().mockResolvedValue({ stream });
    const controller = new FilesController({ openStream } as any);
    const res = makeReply();

    await controller.serve('reimbursement/2026-invoice.png', res);

    expect(openStream).toHaveBeenCalledWith('reimbursement/2026-invoice.png');
    expect(res.send).toHaveBeenCalledWith(stream);
  });

  it('按扩展名设置 Content-Type 并禁用缓存', async () => {
    const openStream = jest.fn().mockResolvedValue({ stream: {} });
    const controller = new FilesController({ openStream } as any);
    const res = makeReply();

    await controller.serve('/uploads/system/logo.svg', res);

    expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    // .svg 未登记 MIME_MAP，回落 octet-stream
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
  });

  it('缺少 path 时直接拒绝，不触发存储读取', async () => {
    const openStream = jest.fn();
    const controller = new FilesController({ openStream } as any);

    await expect(controller.serve('', makeReply())).rejects.toBeInstanceOf(BadRequestException);
    expect(openStream).not.toHaveBeenCalled();
  });
});
