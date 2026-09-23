import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from './department-scope';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 1 },
];

const DEPT_CODES = ['dashboard_view', 'user_view', 'dept_view', 'dept_create', 'dept_update', 'dept_delete'];

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

function makeDeps(
  opts: { permissions?: string[]; dept?: Partial<DepartmentRepo>; hash?: string } = {},
): AppDeps {
  const permissions = opts.permissions ?? DEPT_CODES;
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    userRepo: {
      async findByUsername(username) {
        return {
          id: 1,
          username,
          password: opts.hash ?? '',
          realName: '管理员',
          status: 'active',
          departmentId: null,
          roleIds: [1],
        };
      },
      async findById(id) {
        return {
          id,
          username: 'admin',
          password: opts.hash ?? '',
          realName: '管理员',
          status: 'active',
          departmentId: null,
          roleIds: [1],
        };
      },
    },
    permissionLoader: {
      async loadPermissionCodes(roleIds) {
        return roleIds.includes(1) ? permissions : [];
      },
    },
    rbacRepo: {
      listRoles: vi.fn(async () => []),
      listPermissions: vi.fn(async () => []),
      setRolePermissions: vi.fn(async () => {}),
      listUsers: vi.fn(async () => []),
      setUserRoles: vi.fn(async () => {}),
      createUser: vi.fn(async () => ({ id: 1 })),
      updateUser: vi.fn(async () => {}),
      deleteUser: vi.fn(async () => {}),
    },
    departmentRepo: {
      listTree: vi.fn(async () => TREE),
      listDepartments: vi.fn(async () => []),
      createDepartment: vi.fn(async () => ({ id: 1 })),
      updateDepartment: vi.fn(async () => {}),
      deleteDepartment: vi.fn(async () => 'ok' as const),
      ...opts.dept,
    },
    leaveRepo: {
      listLeaves: vi.fn(async () => []),
      createLeave: vi.fn(async () => ({ id: 1 })),
      getLeaveById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
    },
    reimburseRepo: {
      listReimburses: vi.fn(async () => []),
      createReimburse: vi.fn(async () => ({ id: 1 })),
      getReimburseById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
    },
    attendanceRepo: {
      listAttendances: vi.fn(async () => []),
      createAttendance: vi.fn(async () => ({ id: 1 })),
    },
    makeupRepo: {
      listMakeups: vi.fn(async () => []),
      createMakeup: vi.fn(async () => ({ id: 1 })),
      getMakeupById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
    },
    salaryRepo: {
      listSalaries: vi.fn(async () => []),
      createSalary: vi.fn(async () => ({ id: 1 })),
    },
    overtimeRepo: {
      listOvertimes: vi.fn(async () => []),
      createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      getStats: vi.fn(async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
    },
    shiftRepo: {
      listShifts: vi.fn(async () => []),
      createShift: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateShift: vi.fn(async () => ({ ok: true as const })),
      deleteShift: vi.fn(async () => 'ok' as const),
      toggleShift: vi.fn(async () => 'ok' as const),
      getRestShift: vi.fn(async () => ({ id: 1, name: '休息' })),
      listSchedules: vi.fn(async () => []),
      listSchedulesByUser: vi.fn(async () => []),
      upsertSchedule: vi.fn(async () => ({ id: 1 })),
      batchUpsertSchedules: vi.fn(async () => 0),
      copyScheduleTemplate: vi.fn(async () => 0),
      smartGenerate: vi.fn(async () => 0),
      deleteSchedule: vi.fn(async () => 'ok' as const),
      setRangeRest: vi.fn(async () => 0),
      listTemplates: vi.fn(async () => []),
      createTemplate: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateTemplate: vi.fn(async () => 'ok' as const),
      deleteTemplate: vi.fn(async () => 'ok' as const),
      setTemplateItems: vi.fn(async () => ({ ok: true as const })),
      applyTemplate: vi.fn(async () => ({ ok: true as const, count: 0 })),
    },
    attSettingRepo: {
      getSetting: vi.fn(async () => ({ earlyClockInMinutes: 5, lateClockOutMinutes: 5, lateMinutes: 0, earlyLeaveMinutes: 0, absentHours: 4, allowMakeup: true, makeupDeadlineDays: 7, requireApprovalForMakeup: true, notifyOnLate: true, notifyOnEarlyLeave: true, notifyOnAbsent: true, enableTimeCheck: true })),
      updateSetting: vi.fn(async (data) => data),
    },
    holidayRepo: {
      listHolidays: vi.fn(async () => []),
      createHoliday: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateHoliday: vi.fn(async () => ({ ok: true as const })),
      deleteHoliday: vi.fn(async () => 'ok' as const),
    },
    leaveTypeRepo: {
      listLeaveTypes: vi.fn(async () => []),
      createLeaveType: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateLeaveType: vi.fn(async () => ({ ok: true as const })),
      deleteLeaveType: vi.fn(async () => 'ok' as const),
    },
    quotaRepo: {
      listQuotas: vi.fn(async () => []),
      upsertQuota: vi.fn(async () => ({ ok: true as const })),
      batchUpsertQuotas: vi.fn(async () => 0),
      getTrend: vi.fn(async () => []),
    },
    exceptionRepo: {
      listExceptions: vi.fn(async () => []),
      scanUpsert: vi.fn(async () => ({ created: 0, updated: 0 })),
      setStatus: vi.fn(async () => 'ok' as const),
    },
    categoryRepo: {
      listCategories: vi.fn(async () => []),
      createCategory: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateCategory: vi.fn(async () => ({ ok: true as const })),
      deleteCategory: vi.fn(async () => 'ok' as const),
    },
  };
}

async function login(app: ReturnType<typeof buildApp>, username = 'admin') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password: 'x' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('部门管理路由（dept_* + 删除保护）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/departments 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/departments' });
    expect(res.statusCode).toBe(401);
  });

  it('无 dept_view → GET 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/departments',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 dept_view → 返回部门列表', async () => {
    const listDepartments = vi.fn(async () => [
      { id: 1, name: '总部', parentId: null },
      { id: 2, name: '研发部', parentId: 1 },
    ]);
    const app = buildApp(makeDeps({ hash, dept: { listDepartments } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/departments',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data.departments as unknown[]).length).toBe(2);
  });

  it('有 dept_create → POST 201 并写入 parentId', async () => {
    const createDepartment = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, dept: { createDepartment } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/departments',
      payload: { name: '产品部', parentId: 1 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createDepartment).toHaveBeenCalledWith({ name: '产品部', parentId: 1 });
  });

  it('无 dept_update → PUT 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dept_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/departments/2',
      payload: { name: '研发中心' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 dept_delete 且 ok → DELETE 200', async () => {
    const deleteDepartment = vi.fn(async () => 'ok' as const);
    const app = buildApp(makeDeps({ hash, dept: { deleteDepartment } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/departments/4',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(deleteDepartment).toHaveBeenCalledWith(4);
  });

  it('有子部门时 DELETE → 409 且提示存在子部门', async () => {
    const deleteDepartment = vi.fn(async () => 'has_children' as const);
    const app = buildApp(makeDeps({ hash, dept: { deleteDepartment } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/departments/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('子部门');
  });

  it('部门不存在时 DELETE → 404', async () => {
    const deleteDepartment = vi.fn(async () => 'not_found' as const);
    const app = buildApp(makeDeps({ hash, dept: { deleteDepartment } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/departments/999',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});