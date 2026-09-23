import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type MakeupRepo, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { MakeupView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const MAKEUP_CODES = ['dashboard_view', 'user_view', 'makeup_view', 'makeup_create', 'makeup_approve'];

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
    makeup?: Partial<MakeupRepo>;
    dept?: Partial<DepartmentRepo>;
    notify?: any;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = MAKEUP_CODES } = opts;
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
    overtimeRepo: {
      listOvertimes: vi.fn(async () => []),
      createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      getStats: vi.fn(async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
    },
    makeupRepo: {
      listMakeups: vi.fn(async () => []),
      createMakeup: vi.fn(async () => ({ id: 1 })),
      getMakeupById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      ...opts.makeup,
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

describe('补卡路由（审批流 + 部门数据隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/makeups 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/makeups' });
    expect(res.statusCode).toBe(401);
  });

  it('无 makeup_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/makeups', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('有 makeup_view：listMakeups 收到「本部门+下属部门」scope', async () => {
    const listMakeups = vi.fn(async (): Promise<MakeupView[]> => [
      { id: 1, recordDate: '2026-09-20', clockType: 'check_in', clockTime: '09:30', reason: '忘打卡', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, makeup: { listMakeups } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/makeups', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listMakeups).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
  });

  it('无 makeup_create 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['makeup_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/makeups',
      payload: { recordDate: '2026-09-20', clockType: 'check_in', clockTime: '09:30', reason: '忘打卡' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 makeup_create：createMakeup 强制写入当前用户 departmentId', async () => {
    const createMakeup = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, makeup: { createMakeup } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/makeups',
      payload: { recordDate: '2026-09-20', clockType: 'check_out', clockTime: '18:30', reason: '忘签退' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createMakeup).toHaveBeenCalledWith(expect.objectContaining({ applicantId: 1, departmentId: 2, recordDate: '2026-09-20', clockType: 'check_out' }));
  });

  it('clockType 非法返回 400', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/makeups',
      payload: { recordDate: '2026-09-20', clockType: 'break', clockTime: '09:30', reason: 'x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('无部门用户 POST 返回 409', async () => {
    const app = buildApp(makeDeps({ hash, departmentId: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/makeups',
      payload: { recordDate: '2026-09-20', clockType: 'check_in', clockTime: '09:30', reason: 'x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('审批越权部门：scope 外返回 403', async () => {
    const getMakeupById = vi.fn(async (): Promise<MakeupView> => ({ id: 1, recordDate: '2026-09-20', clockType: 'check_in', clockTime: '09:30', reason: 'r', status: 'pending', applicantId: 3, departmentId: 6, applicantName: '李四', departmentName: '市场部' }));
    const app = buildApp(makeDeps({ hash, makeup: { getMakeupById } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/makeups/1/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('审批成功：setStatus 收到审批状态，且给申请人发通知', async () => {
    const getMakeupById = vi.fn(async (): Promise<MakeupView> => ({ id: 1, recordDate: '2026-09-20', clockType: 'check_in', clockTime: '09:30', reason: 'r', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' }));
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn(async () => {});
    const app = buildApp(makeDeps({ hash, makeup: { getMakeupById, setStatus }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/makeups/1/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(1, 'approved');
    expect(notify).toHaveBeenCalledWith({ userId: 3 }, 'notification', expect.objectContaining({ title: '审批通知' }));
  });
});