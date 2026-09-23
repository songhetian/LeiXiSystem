import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type HolidayRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { HolidayView } from '@leixi/shared';

const TREE: DepartmentNode[] = [{ id: 1, parentId: null }];

// 节假日是系统级单例配置，只需 holiday_view（查看）/ holiday_manage（管理）
const HOLIDAY_CODES = ['holiday_view', 'holiday_manage'];

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
    holiday?: Partial<HolidayRepo>;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 1, permissions = HOLIDAY_CODES } = opts;
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
      ...opts.holiday,
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

async function login(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'x' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('节假日路由（系统级配置，按年 CRUD，无部门隔离/审批流）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/holidays 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/holidays' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 holiday_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/holidays',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET 按年份筛选调用 listHolidays(year)；不传 year 返回全部', async () => {
    const listHolidays = vi.fn(async (year?: number): Promise<HolidayView[]> =>
      [{ id: 1, year: 2026, date: '2026-10-01', name: '国庆节', type: 'national' }],
    );
    const app = buildApp(makeDeps({ hash, holiday: { listHolidays } }));
    await app.ready();
    const token = await login(app);
    // 按年
    const resY = await app.inject({
      method: 'GET',
      url: '/api/holidays?year=2026',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resY.statusCode).toBe(200);
    expect(listHolidays).toHaveBeenCalledWith(2026);
    const items = resY.json().data.holidays as HolidayView[];
    expect(items[0]?.date).toBe('2026-10-01');
    // 不传 year
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/holidays',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(resAll.statusCode).toBe(200);
    expect(listHolidays).toHaveBeenCalledWith(undefined);
  });

  it('无 holiday_manage 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['holiday_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      payload: { date: '2026-10-01', name: '国庆节', type: 'national' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST 时 year 由 date 推导传参，201 返回 id', async () => {
    const createHoliday = vi.fn(async () => ({ ok: true as const, id: 9 }));
    const app = buildApp(makeDeps({ hash, holiday: { createHoliday } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      payload: { date: '2026-10-01', name: '国庆节', type: 'national' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createHoliday).toHaveBeenCalledWith({ year: 2026, date: '2026-10-01', name: '国庆节', type: 'national' });
    expect(res.json().data.id).toBe(9);
  });

  it('POST 重复日期 → 409', async () => {
    const createHoliday = vi.fn(async () => ({ ok: false as const, reason: 'dup' as const }));
    const app = buildApp(makeDeps({ hash, holiday: { createHoliday } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      payload: { date: '2026-10-01', name: '国庆', type: 'national' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PUT 更新名称，date 变更时推导新 year', async () => {
    const updateHoliday = vi.fn(async () => ({ ok: true as const }));
    const app = buildApp(makeDeps({ hash, holiday: { updateHoliday } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/holidays/1',
      payload: { name: '国庆假期', date: '2026-10-02', type: 'national' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(updateHoliday).toHaveBeenCalledWith(1, { name: '国庆假期', date: '2026-10-02', type: 'national', year: 2026 });
  });

  it('PUT 未找到 → 404；唯一冲突 → 409', async () => {
    const app = buildApp(
      makeDeps({ hash, holiday: { updateHoliday: vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const })) } }),
    );
    await app.ready();
    const token = await login(app);
    const res404 = await app.inject({
      method: 'PUT',
      url: '/api/holidays/999',
      payload: { name: 'x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res404.statusCode).toBe(404);

    const dupApp = buildApp(
      makeDeps({ hash, holiday: { updateHoliday: vi.fn(async () => ({ ok: false as const, reason: 'dup' as const })) } }),
    );
    await dupApp.ready();
    const tokenDup = await login(dupApp);
    const res409 = await dupApp.inject({
      method: 'PUT',
      url: '/api/holidays/1',
      payload: { date: '2026-10-01' },
      headers: { authorization: `Bearer ${tokenDup}` },
    });
    expect(res409.statusCode).toBe(409);
  });

  it('DELETE 未找到 → 404；成功 → 200', async () => {
    const okApp = buildApp(makeDeps({ hash }));
    await okApp.ready();
    const tokenOk = await login(okApp);
    const resOk = await okApp.inject({
      method: 'DELETE',
      url: '/api/holidays/1',
      headers: { authorization: `Bearer ${tokenOk}` },
    });
    expect(resOk.statusCode).toBe(200);

    const nfApp = buildApp(makeDeps({ hash, holiday: { deleteHoliday: vi.fn(async () => 'not_found' as const) } }));
    await nfApp.ready();
    const tokenNf = await login(nfApp);
    const resNf = await nfApp.inject({
      method: 'DELETE',
      url: '/api/holidays/999',
      headers: { authorization: `Bearer ${tokenNf}` },
    });
    expect(resNf.statusCode).toBe(404);
  });
});