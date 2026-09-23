import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type OvertimeRepo, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { OvertimeStats, OvertimeView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const OVERTIME_CODES = ['dashboard_view', 'user_view', 'overtime_view', 'overtime_create', 'overtime_approve'];

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
    overtime?: Partial<OvertimeRepo>;
    dept?: Partial<DepartmentRepo>;
    notify?: any;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = OVERTIME_CODES } = opts;
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    notify: opts.notify,
    userRepo: {
      async findByUsername(username) {
        return {
          id: username === 'admin' ? 1 : 2,
          username,
          password: opts.hash ?? '',
          realName: username === 'admin' ? '管理员' : '访客',
          status: 'active',
          departmentId,
          roleIds: username === 'admin' ? [1] : [2],
        };
      },
      async findById(id) {
        return {
          id,
          username: id === 1 ? 'admin' : 'guest',
          password: opts.hash ?? '',
          realName: id === 1 ? '管理员' : '访客',
          status: 'active',
          departmentId,
          roleIds: id === 1 ? [1] : [2],
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
    overtimeRepo: {
      listOvertimes: vi.fn(async () => []),
      createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      getStats: vi.fn(async (): Promise<OvertimeStats> => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
      ...opts.overtime,
    },
    salaryRepo: {
      listSalaries: vi.fn(async () => []),
      createSalary: vi.fn(async () => ({ id: 1 })),
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

describe('加班路由（审批流 + 部门数据隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/overtimes 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/overtimes' });
    expect(res.statusCode).toBe(401);
  });

  it('无 overtime_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/overtimes', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('有 overtime_view：listOvertimes 收到「本部门+下属部门」scope', async () => {
    const listOvertimes = vi.fn(async (): Promise<OvertimeView[]> => [
      { id: 1, date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: '发版', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, overtime: { listOvertimes } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/overtimes', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listOvertimes).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
  });

  it('无 overtime_create 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['overtime_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/overtimes',
      payload: { date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: '发版' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 overtime_create：createOvertime 强制写入当前用户 departmentId', async () => {
    const createOvertime = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, overtime: { createOvertime } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/overtimes',
      payload: { date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: '发版' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createOvertime).toHaveBeenCalledWith(expect.objectContaining({ applicantId: 1, departmentId: 2, hours: 2, date: '2026-09-20' }));
  });

  it('无部门用户 POST 返回 409', async () => {
    const app = buildApp(makeDeps({ hash, departmentId: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/overtimes',
      payload: { date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: '发版' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('无 overtime_approve 时 PUT 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['overtime_view', 'overtime_create'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/overtimes/1/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('审批越权部门：scope 外返回 403', async () => {
    const getOvertimeById = vi.fn(async (): Promise<OvertimeView> => ({ id: 1, date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: 'r', status: 'pending', applicantId: 3, departmentId: 6, applicantName: '李四', departmentName: '市场部' }));
    const app = buildApp(makeDeps({ hash, overtime: { getOvertimeById } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/overtimes/1/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('审批成功：setStatus 收到审批状态，且给申请人发通知', async () => {
    const getOvertimeById = vi.fn(async (): Promise<OvertimeView> => ({ id: 1, date: '2026-09-20', startTime: '19:00', endTime: '21:00', hours: 2, reason: 'r', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' }));
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn(async () => {});
    const app = buildApp(makeDeps({ hash, overtime: { getOvertimeById, setStatus }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/overtimes/1/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(1, 'approved');
    expect(notify).toHaveBeenCalledWith({ userId: 3 }, 'notification', expect.objectContaining({ title: '审批通知' }));
  });

  it('GET /api/overtimes/stats 无权限 403；有权限传 month 调 getStats', async () => {
    const getStats = vi.fn(async (): Promise<OvertimeStats> => ({ totalHours: 4, approvedCount: 2, pendingCount: 1, month: '2026-09' }));
    const app = buildApp(makeDeps({ hash, overtime: { getStats } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/overtimes/stats?month=2026-09', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(getStats).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] }, '2026-09');
    expect(res.json().data.stats).toMatchObject({ totalHours: 4, month: '2026-09' });
  });
});