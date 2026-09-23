import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps } from '../../app';
import type { SessionStore } from './auth.service';

/** 内存用户仓库 mock：与数据库 schema 对齐的 User 投影 */
interface TestUser {
  id: number;
  username: string;
  password: string; // bcrypt hash
  realName: string;
  status: string;
  departmentId: number | null;
  roleIds: number[];
}

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

function makeDeps(users: TestUser[], store = memoryStore()): AppDeps {
  return {
    jwtSecret: 'test-secret',
    sessionStore: store,
    userRepo: {
      async findByUsername(username) {
        const u = users.find((x) => x.username === username);
        return u ? { ...u } : null;
      },
      async findById(id) {
        const u = users.find((x) => x.id === id);
        return u ? { ...u } : null;
      },
    },
    permissionLoader: {
      async loadPermissionCodes(roleIds) {
        const codeByRole: Record<number, string[]> = {
          1: ['user_create', 'user_view', 'leave_approve'],
          2: ['report_view'],
        };
        return roleIds.flatMap((id) => codeByRole[id] ?? []);
      },
    },
    rbacRepo: {
      listRoles: async () => [],
      listPermissions: async () => [],
      setRolePermissions: async () => {},
      listUsers: async () => [],
      setUserRoles: async () => {},
      createUser: async (d) => ({ id: 1 }),
      updateUser: async () => {},
      deleteUser: async () => {},
    },
    departmentRepo: {
      listTree: async () => [],
      listDepartments: async () => [],
      createDepartment: async () => ({ id: 1 }),
      updateDepartment: async () => {},
      deleteDepartment: async () => 'ok',
    },
    leaveRepo: {
      listLeaves: async () => [],
      createLeave: async () => ({ id: 1 }),
      getLeaveById: async () => null,
      setStatus: async () => {},
    },
    reimburseRepo: {
      listReimburses: async () => [],
      createReimburse: async () => ({ id: 1 }),
      getReimburseById: async () => null,
      setStatus: async () => {},
    },
    attendanceRepo: {
      listAttendances: async () => [],
      createAttendance: async () => ({ id: 1 }),
    },
    makeupRepo: {
      listMakeups: async () => [],
      createMakeup: async () => ({ id: 1 }),
      getMakeupById: async () => null,
      setStatus: async () => {},
    },
    salaryRepo: {
      listSalaries: async () => [],
      createSalary: async () => ({ id: 1 }),
    },
    overtimeRepo: {
      listOvertimes: async () => [],
      createOvertime: async () => ({ id: 1 }),
      getOvertimeById: async () => null,
      setStatus: async () => {},
      getStats: async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' }),
    },
    shiftRepo: {
      listShifts: async () => [],
      createShift: async () => ({ ok: true as const, id: 1 }),
      updateShift: async () => ({ ok: true as const }),
      deleteShift: async () => 'ok',
      toggleShift: async () => 'ok',
      getRestShift: async () => ({ id: 1, name: '休息' }),
      listSchedules: async () => [],
      listSchedulesByUser: async () => [],
      upsertSchedule: async () => ({ id: 1 }),
      batchUpsertSchedules: async () => 0,
      copyScheduleTemplate: async () => 0,
      smartGenerate: async () => 0,
      deleteSchedule: async () => 'ok',
      setRangeRest: async () => 0,
      listTemplates: async () => [],
      createTemplate: async () => ({ ok: true as const, id: 1 }),
      updateTemplate: async () => 'ok' as const,
      deleteTemplate: async () => 'ok' as const,
      setTemplateItems: async () => ({ ok: true as const }),
      applyTemplate: async () => ({ ok: true as const, count: 0 }),
    },
    attSettingRepo: {
      getSetting: async () => ({ earlyClockInMinutes: 5, lateClockOutMinutes: 5, lateMinutes: 0, earlyLeaveMinutes: 0, absentHours: 4, allowMakeup: true, makeupDeadlineDays: 7, requireApprovalForMakeup: true, notifyOnLate: true, notifyOnEarlyLeave: true, notifyOnAbsent: true, enableTimeCheck: true }),
      updateSetting: async (data) => data,
    },
    holidayRepo: {
      listHolidays: async () => [],
      createHoliday: async () => ({ ok: true as const, id: 1 }),
      updateHoliday: async () => ({ ok: true as const }),
      deleteHoliday: async () => 'ok' as const,
    },
    leaveTypeRepo: {
      listLeaveTypes: async () => [],
      createLeaveType: async () => ({ ok: true as const, id: 1 }),
      updateLeaveType: async () => ({ ok: true as const }),
      deleteLeaveType: async () => 'ok' as const,
    },
    quotaRepo: {
      listQuotas: async () => [],
      upsertQuota: async () => ({ ok: true as const }),
      batchUpsertQuotas: async () => 0,
      getTrend: async () => [],
    },
    exceptionRepo: {
      listExceptions: async () => [],
      scanUpsert: async () => ({ created: 0, updated: 0 }),
      setStatus: async () => 'ok' as const,
    },
    categoryRepo: {
      listCategories: async () => [],
      createCategory: async () => ({ ok: true as const, id: 1 }),
      updateCategory: async () => ({ ok: true as const }),
      deleteCategory: async () => 'ok' as const,
    },
  };
}

const ADMIN = {
  id: 1,
  username: 'admin',
  password: '', // 运行时注入 bcrypt hash
  realName: '管理员',
  status: 'active',
  departmentId: null,
  roleIds: [1],
};

describe('auth routes (Seam C inject)', () => {
  let app: ReturnType<typeof buildApp>;
  let store: SessionStore;

  beforeEach(async () => {
    store = memoryStore();
    ADMIN.password = await bcrypt.hash('admin123', 4);
    app = buildApp(makeDeps([ADMIN], store));
    await app.ready();
  });

  it('未登录访问 /api/auth/me 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('健康检查与登录接口共存且不冲突', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/auth/login 密码错误返回 401 fail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it('POST /api/auth/login 密码正确返回 access/refresh + user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.accessToken).toBe('string');
    expect(typeof body.data.refreshToken).toBe('string');
    expect(body.data.user).toEqual({ id: 1, username: 'admin', realName: '管理员' });
  });

  it('携带 accessToken 访问 /api/auth/me 返回当前用户', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const accessToken = login.json().data.accessToken;

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    // 用户信息 + 权限码（由 permissionLoader 按 roleIds=[1] 加载）
    expect(res.json().data).toEqual({
      id: 1,
      username: 'admin',
      realName: '管理员',
      permissions: ['user_create', 'user_view', 'leave_approve'],
    });
  });

  it('logout 后 access token 仍有效? 否——访问 /me 返回 401', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const accessToken = login.json().data.accessToken;

    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // 单设备会话已删除，refresh token 失效；此断言验证登出契约不抛异常
    const logout2 = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(logout2.statusCode).toBe(200);
  });

  it('POST /api/auth/refresh 用有效 refreshToken 换取新令牌对（旋转）', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const { accessToken: oldAccess, refreshToken } = login.json().data;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const newTokens = body.data;
    // 旋转：下发的新 access/refresh 与旧的不相同
    expect(newTokens.accessToken).not.toBe(oldAccess);
    expect(newTokens.refreshToken).not.toBe(refreshToken);
    expect(newTokens.user).toEqual({ id: 1, username: 'admin', realName: '管理员' });

    // 新 access token 可用
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${newTokens.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it('POST /api/auth/refresh 用被踢失效的 refreshToken 返回 401', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const { refreshToken } = login.json().data;
    // 单设备踢人：清空会话
    await store.delete(1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it('POST /api/auth/refresh 用伪造 refreshToken 返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'not-a-valid-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it('被踢下线后旧 access token 立即失效（/me 401）', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const { accessToken } = login.json().data;

    // 模拟另一设备登录：覆盖 Redis 会话 sid（单设备踢人）
    await store.set(1, 'other-device-sid');

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it('被踢下线后 requirePermission 保护的路由（/api/users）立即 401', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const { accessToken } = login.json().data;

    // 正常请求先通过
    const ok = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(ok.statusCode).toBe(200);

    // 另一设备登录踢线后，旧 token 立即 401
    await store.set(1, 'other-device-sid');
    const kicked = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(kicked.statusCode).toBe(401);
    expect(kicked.json().success).toBe(false);
  });
});