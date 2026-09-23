import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type RbacRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { PermissionPoint, RoleWithPermissions, UserWithRoles } from '@leixi/shared';

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

const ALL_CODES = ['role_view', 'role_update', 'user_view', 'role_assign', 'user_create', 'user_update', 'user_delete'];

function makeDeps(rbac: Partial<RbacRepo> = {}, passwordHash = ''): AppDeps {
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    userRepo: {
      async findByUsername(username) {
        return {
          id: username === 'admin' ? 1 : 2,
          username,
          password: passwordHash,
          realName: username === 'admin' ? '管理员' : '访客',
          status: 'active',
          departmentId: null,
          roleIds: username === 'admin' ? [1] : [2],
        };
      },
      async findById(id) {
        return {
          id,
          username: id === 1 ? 'admin' : 'guest',
          password: passwordHash,
          realName: id === 1 ? '管理员' : '访客',
          status: 'active',
          departmentId: null,
          roleIds: id === 1 ? [1] : [2],
        };
      },
    },
    permissionLoader: {
      async loadPermissionCodes(roleIds) {
        // 角色 1=管理员（全部），角色 2=访客（无 role_view/role_update）
        return roleIds.includes(1) ? ALL_CODES : [];
      },
    },
    rbacRepo: {
      listRoles: vi.fn(async () => []),
      listPermissions: vi.fn(async () => []),
      setRolePermissions: vi.fn(async () => {}),
      listUsers: vi.fn(async () => []),
      setUserRoles: vi.fn(async () => {}),
      createUser: vi.fn(async (d) => ({ id: 99 })),
      updateUser: vi.fn(async () => {}),
      deleteUser: vi.fn(async () => {}),
      ...rbac,
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
      listOvertimes: vi.fn(async () => []),
      createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      getStats: vi.fn(async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
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

async function login(app: ReturnType<typeof buildApp>, username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password: 'x' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('RBAC 路由（Seam E 权限守卫）', () => {
  let hash: string;

  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录访问 /api/roles 返回 401', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/roles' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 role_view 权限访问 /api/roles 返回 403', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const token = await login(app, 'guest');
    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 role_view 时 GET /api/roles 返回 roles+permissions', async () => {
    const listRoles = vi.fn(async (): Promise<RoleWithPermissions[]> => [
      { id: 1, name: 'admin', description: null, isSystem: true, permissionIds: [10, 11] },
      { id: 2, name: 'guest', description: null, isSystem: false, permissionIds: [] },
    ]);
    const listPermissions = vi.fn(async (): Promise<PermissionPoint[]> => [
      { id: 10, code: 'user_view', name: '查看用户', type: 'menu', module: 'user' },
    ]);
    const app = buildApp(makeDeps({ listRoles, listPermissions }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({
      roles: [
        { id: 1, name: 'admin', description: null, isSystem: true, permissionIds: [10, 11] },
        { id: 2, name: 'guest', description: null, isSystem: false, permissionIds: [] },
      ],
      permissions: [{ id: 10, code: 'user_view', name: '查看用户', type: 'menu', module: 'user' }],
    });
  });

  it('无 role_update 时 PUT 权限返回 403', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const token = await login(app, 'guest');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/roles/1/permissions',
      payload: { permissionIds: [10] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 role_update 时 PUT 权限会调用 setRolePermissions', async () => {
    const setRolePermissions = vi.fn(async () => {});
    const app = buildApp(makeDeps({ setRolePermissions }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/roles/1/permissions',
      payload: { permissionIds: [10, 11] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setRolePermissions).toHaveBeenCalledWith(1, [10, 11]);
  });

  it('有 user_view 时 GET /api/users 返回带 roleIds 的用户', async () => {
    const listUsers = vi.fn(async (): Promise<UserWithRoles[]> => [
      { id: 1, username: 'admin', realName: '管理员', status: 'active', roleIds: [1], departmentId: 2 },
      { id: 2, username: 'guest', realName: '访客', status: 'active', roleIds: [2], departmentId: 6 },
    ]);
    const app = buildApp(makeDeps({ listUsers }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.users[0]).toEqual({
      id: 1,
      username: 'admin',
      realName: '管理员',
      status: 'active',
      roleIds: [1],
      departmentId: 2,
    });
  });

  it('无 role_assign 时 PUT 用户角色返回 403', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const token = await login(app, 'guest');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/2/roles',
      payload: { roleIds: [1] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 role_assign 时 PUT 用户角色会调用 setUserRoles', async () => {
    const setUserRoles = vi.fn(async () => {});
    const app = buildApp(makeDeps({ setUserRoles }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/2/roles',
      payload: { roleIds: [1, 3] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setUserRoles).toHaveBeenCalledWith(2, [1, 3]);
  });

  it('无 user_create 时 POST /api/users 返回 403', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const token = await login(app, 'guest');
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { username: 'neo', password: 'secret123', realName: '新用户', roleIds: [] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 user_create 时 POST /api/users 会哈希密码并创建（201）', async () => {
    const createUser = vi.fn(async (d: { password: string }) => ({ id: 42 }));
    const app = buildApp(makeDeps({ createUser }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { username: 'neo', password: 'secret123', realName: '新用户', roleIds: [2] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const [args] = createUser.mock.calls[0] as [{ password: string }];
    expect(args.password).not.toBe('secret123'); // 落库的是哈希而非明文
  });

  it('有 user_update 时 PUT /api/users/:id 更新不传 password 则不哈希', async () => {
    const updateUser = vi.fn(async (_id: number, _data: Record<string, unknown>) => {});
    const app = buildApp(makeDeps({ updateUser }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/42',
      payload: { realName: '改名', status: 'disabled', roleIds: [1] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const [id, body] = updateUser.mock.calls[0] ?? [undefined, undefined];
    expect(id).toBe(42);
    expect(body).toMatchObject({ realName: '改名', status: 'disabled', roleIds: [1] });
    expect((body as { password?: string }).password).toBeUndefined();
  });

  it('无 user_delete 时 DELETE /api/users/:id 返回 403', async () => {
    const app = buildApp(makeDeps({}, hash));
    await app.ready();
    const token = await login(app, 'guest');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/42',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 user_delete 时 DELETE 会调用 deleteUser', async () => {
    const deleteUser = vi.fn(async () => {});
    const app = buildApp(makeDeps({ deleteUser }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/42',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(42);
  });

  it('重置密码会把新密码哈希后写入 updateUser', async () => {
    const updateUser = vi.fn(async (_id: number, _data: Record<string, unknown>) => {});
    const app = buildApp(makeDeps({ updateUser }, hash));
    await app.ready();
    const token = await login(app, 'admin');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/42/password',
      payload: { newPassword: 'reset123' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const [, data] = updateUser.mock.calls[0] ?? [undefined, undefined];
    const pw = (data as { password: string }).password;
    expect(pw).toBeTruthy();
    expect(pw).not.toBe('reset123'); // 落库为哈希
  });
});