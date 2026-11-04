// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：files 端点此前无权限点（当时 file:upload
// 未注册）。seed 已定义并给 staff 绑定 file:upload / file:view，按语义收口；
// 前端 /files/serve 均为同源 <img>/<a> 引用，JWT 走 httpOnly cookie 自动携带，不受影响。
import { Reflector } from '@nestjs/core';
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
