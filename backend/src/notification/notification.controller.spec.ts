// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：通知个人端点（列表/未读数/标记已读）
// 此前仅登录即可访问；统一按 seed 中的 personal:notification:view（我的通知查看）收口。
import { Reflector } from '@nestjs/core';
import { NotificationController } from './notification.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof NotificationController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, NotificationController.prototype[method]);

describe('NotificationController — 端点权限矩阵', () => {
  it('个人通知端点全部挂 personal:notification:view（此前无守卫）', () => {
    expect(permOf('list')).toBe('personal:notification:view');
    expect(permOf('unreadCount')).toBe('personal:notification:view');
    expect(permOf('markRead')).toBe('personal:notification:view');
    expect(permOf('readAll')).toBe('personal:notification:view');
  });

  it('管理发送保持 system:notification:send（回归保护）', () => {
    expect(permOf('send')).toBe('system:notification:send');
  });
});
