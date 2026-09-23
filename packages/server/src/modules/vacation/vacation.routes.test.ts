import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type LeaveTypeRepo, type QuotaRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { LeaveTypeView } from '@leixi/shared';

const TREE: DepartmentNode[] = [{ id: 1, parentId: null }];

// 请假类型（系统级）+ 年度额度（部门隔离按员工 scope）查看/管理权限
const PERMS = ['leave_type_view', 'leave_type_manage', 'quota_view', 'quota_manage'];

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

function makeDeps(
  opts: {
    departmentId?: number | null;
    permissions?: string[];
    leaveType?: Partial<LeaveTypeRepo>;
    quota?: Partial<QuotaRepo>;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 1, permissions = PERMS } = opts;
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
          departmentId,
          roleIds: [1],
        };
      },
      async findById(id) {
        if (id === 1) {
          return {
            id,
            username: 'admin',
            password: opts.hash ?? '',
            realName: '管理员',
            status: 'active',
            departmentId,
            roleIds: [1],
          };
        }
        return null;
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
      listUsers: vi.fn(async () => [
        { id: 1, username: 'admin', realName: '管理员', status: 'active', roleIds: [1], departmentId },
      ]),
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
    salaryRepo: {
      listSalaries: vi.fn(async () => []),
      createSalary: vi.fn(async () => ({ id: 1 })),
    },
    makeupRepo: {
      listMakeups: vi.fn(async () => []),
      createMakeup: vi.fn(async () => ({ id: 1 })),
      getMakeupById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
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
      getSetting: vi.fn(async () => ({
        earlyClockInMinutes: 5, lateClockOutMinutes: 5, lateMinutes: 0, earlyLeaveMinutes: 0, absentHours: 4,
        allowMakeup: true, makeupDeadlineDays: 7, requireApprovalForMakeup: true,
        notifyOnLate: true, notifyOnEarlyLeave: true, notifyOnAbsent: true, enableTimeCheck: true,
      })),
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
      ...opts.leaveType,
    },
    quotaRepo: {
      listQuotas: vi.fn(async () => []),
      upsertQuota: vi.fn(async () => ({ ok: true as const })),
      batchUpsertQuotas: vi.fn(async () => 0),
      getTrend: vi.fn(async () => []),
      ...opts.quota,
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

async function login(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'x' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

const AUTH = { authorization: 'Bearer ' };
const EXAMPLE_TYPE: LeaveTypeView = {
  id: 1, name: '年假', unit: 'day', allowance: 10, isActive: true, description: null,
};

describe('请假类型路由（系统级配置 CRUD）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('无 leave_type_view 时 GET /api/leave-types 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave-types', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('有权限：GET 返回请假类型列表', async () => {
    const listLeaveTypes = vi.fn(async (): Promise<LeaveTypeView[]> => [{ ...EXAMPLE_TYPE }]);
    const app = buildApp(makeDeps({ hash, leaveType: { listLeaveTypes } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave-types', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.leaveTypes as LeaveTypeView[];
    expect(items[0]?.name).toBe('年假');
    expect(listLeaveTypes).toHaveBeenCalledTimes(1);
  });

  it('POST 创建请假类型：传 name/unit/allowance/description', async () => {
    const createLeaveType = vi.fn(async () => ({ ok: true as const, id: 7 }));
    const app = buildApp(makeDeps({ hash, leaveType: { createLeaveType } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leave-types',
      payload: { name: '病假', unit: 'day', allowance: 5, description: '带薪病假' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createLeaveType).toHaveBeenCalledWith({ name: '病假', unit: 'day', allowance: 5, description: '带薪病假' });
    expect(res.json().data.id).toBe(7);
  });

  it('POST 重名 → 409', async () => {
    const createLeaveType = vi.fn(async () => ({ ok: false as const, reason: 'dup' as const }));
    const app = buildApp(makeDeps({ hash, leaveType: { createLeaveType } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leave-types',
      payload: { name: '事假', unit: 'day', allowance: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PUT 更新：传名称/单位/额度/启用', async () => {
    const updateLeaveType = vi.fn(async () => ({ ok: true as const }));
    const app = buildApp(makeDeps({ hash, leaveType: { updateLeaveType } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leave-types/1',
      payload: { name: '年假', allowance: 12, isActive: false },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(updateLeaveType).toHaveBeenCalledWith(1, { name: '年假', allowance: 12, isActive: false });
  });

  it('PUT 未找到 → 404；重名 → 409', async () => {
    const nf = buildApp(makeDeps({ hash, leaveType: { updateLeaveType: vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const })) } }));
    await nf.ready();
    const tokenNf = await login(nf);
    const res404 = await nf.inject({ method: 'PUT', url: '/api/leave-types/999', payload: { name: 'x' }, headers: { authorization: `Bearer ${tokenNf}` } });
    expect(res404.statusCode).toBe(404);

    const dup = buildApp(makeDeps({ hash, leaveType: { updateLeaveType: vi.fn(async () => ({ ok: false as const, reason: 'dup' as const })) } }));
    await dup.ready();
    const tokenDup = await login(dup);
    const res409 = await dup.inject({ method: 'PUT', url: '/api/leave-types/1', payload: { name: '年假' }, headers: { authorization: `Bearer ${tokenDup}` } });
    expect(res409.statusCode).toBe(409);
  });

  it('DELETE：未找到 → 404；被额度占用 → 409；成功 → 200', async () => {
    const ok = buildApp(makeDeps({ hash }));
    await ok.ready();
    const tokenOk = await login(ok);
    const resOk = await ok.inject({ method: 'DELETE', url: '/api/leave-types/1', headers: { authorization: `Bearer ${tokenOk}` } });
    expect(resOk.statusCode).toBe(200);

    const inUse = buildApp(makeDeps({ hash, leaveType: { deleteLeaveType: vi.fn(async () => 'in_use' as const) } }));
    await inUse.ready();
    const tokenIu = await login(inUse);
    const res409 = await inUse.inject({ method: 'DELETE', url: '/api/leave-types/1', headers: { authorization: `Bearer ${tokenIu}` } });
    expect(res409.statusCode).toBe(409);

    const nf = buildApp(makeDeps({ hash, leaveType: { deleteLeaveType: vi.fn(async () => 'not_found' as const) } }));
    await nf.ready();
    const tokenNf = await login(nf);
    const res404 = await nf.inject({ method: 'DELETE', url: '/api/leave-types/999', headers: { authorization: `Bearer ${tokenNf}` } });
    expect(res404.statusCode).toBe(404);
  });
});

describe('年度请假额度 + 趋势路由', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('无 quota_view 时 GET /api/leave-quotas 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['leave_type_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave-quotas?year=2026', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('GET 按年查询额度：传 year，listQuotas 收到 year 且在 scope 内的 userIds', async () => {
    const listQuotas = vi.fn(async () => [
      { id: 1, userId: 1, year: 2026, leaveTypeId: 1, leaveTypeName: '年假', allowance: 10, used: 3, remaining: 7 },
    ]);
    const app = buildApp(makeDeps({ hash, quota: { listQuotas } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave-quotas?year=2026', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listQuotas).toHaveBeenCalledWith(2026, [1]);
    const rows = res.json().data.quotas as { remaining: number; used: number }[];
    expect(rows[0]?.remaining).toBe(7);
  });

  it('PUT 设置额度：校验 year/userId/leaveTypeId；传 allowance', async () => {
    const upsertQuota = vi.fn(async () => ({ ok: true as const }));
    const app = buildApp(makeDeps({ hash, quota: { upsertQuota } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leave-quotas/1/2026/1',
      payload: { allowance: 12, used: 2 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(upsertQuota).toHaveBeenCalledWith({ userId: 1, year: 2026, leaveTypeId: 1, allowance: 12, used: 2 });
  });

  it('POST /api/leave-quotas/import：解析 Excel→映射→批量落地，返回 count/skipped', async () => {
    const batchUpsertQuotas = vi.fn(async () => 2);
    const app = buildApp(makeDeps({ hash, quota: { batchUpsertQuotas } }));
    await app.ready();
    const token = await login(app);
    const file = Buffer.from('x').toString('base64');
    const res = await app.inject({
      method: 'POST',
      url: '/api/leave-quotas/import?year=2026',
      payload: { file },
      headers: { authorization: `Bearer ${token}` },
    });
    // 无有效数据 → 400
    expect(res.statusCode).toBe(400);
  });

  it('POST import 无 quota_manage 或 year → 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['quota_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leave-quotas/import',
      payload: { file: Buffer.from('x').toString('base64') },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/leave/trend?year 聚合月度趋势', async () => {
    const getTrend = vi.fn(async () => [
      { month: 3, count: 4 },
      { month: 6, count: 2 },
    ]);
    const app = buildApp(makeDeps({ hash, quota: { getTrend } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave/trend?year=2026', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(getTrend).toHaveBeenCalledWith(2026, [1]);
    const points = res.json().data.trend as { month: number; count: number }[];
    expect(points[0]?.count).toBe(4);
  });

  it('GET /api/leave/trend 无 quota_view → 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/leave/trend?year=2026', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });
});