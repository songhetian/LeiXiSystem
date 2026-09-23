import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type LeaveRepo, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { NotifyFn } from '../notify/socket';
import type { DepartmentNode } from './department-scope';
import type { LeaveView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const LEAVE_CODES = ['dashboard_view', 'user_view', 'leave_view', 'leave_create', 'leave_approve'];

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
    leave?: Partial<LeaveRepo>;
    shift?: Partial<AppDeps['shiftRepo']>;
    dept?: Partial<DepartmentRepo>;
    notify?: NotifyFn;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = LEAVE_CODES } = opts;
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
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
      ...opts.leave,
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
      ...opts.shift,
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
    notify: opts.notify ?? vi.fn(),
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

describe('请假路由（部门数据隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/leaves 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/leaves' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 leave_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaves',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 leave_view：listLeaves 收到“本部门+下属部门”scope，跨部门数据不可见', async () => {
    const listLeaves = vi.fn(async (): Promise<LeaveView[]> => [
      // 研发部(2) 下属 前端组(3) 的后端拉取结果——隔离由 scope 拦截
      { id: 1, type: '年假', reason: '前端组年假', startAt: '2026-10-01T00:00:00.000Z', endAt: '2026-10-02T00:00:00.000Z', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, leave: { listLeaves } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaves',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // 用户归属 研发部(2) → scope 限定为本部门+下属 [2,3,4,5]，不包含市场部(6)
    expect(listLeaves).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const leaves = res.json().data.leaves as LeaveView[];
    expect(leaves.length).toBe(1);
    expect(leaves.every((l) => [2, 3, 4, 5].includes(l.departmentId))).toBe(true);
  });

  it('无部门用户（departmentId null）→ scope 为 all（系统级）', async () => {
    const listLeaves = vi.fn(async () => []);
    const app = buildApp(makeDeps({ hash, departmentId: null, leave: { listLeaves } }));
    await app.ready();
    const token = await login(app);
    await app.inject({
      method: 'GET',
      url: '/api/leaves',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listLeaves).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('无 leave_create 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['leave_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      payload: { type: '事假', reason: '家中有事', startAt: '2026-10-01', endAt: '2026-10-02' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 leave_create：createLeave 强制写入当前用户 departmentId（不信任前端）', async () => {
    const createLeave = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, leave: { createLeave } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      payload: { type: '事假', reason: '家中有事', startAt: '2026-10-01T00:00:00.000Z', endAt: '2026-10-02T00:00:00.000Z' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createLeave).toHaveBeenCalledWith(
      expect.objectContaining({ applicantId: 1, departmentId: 2 }),
    );
  });

  it('可发起请假：无部门用户 POST 返回 409', async () => {
    const app = buildApp(makeDeps({ hash, departmentId: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/leaves',
      payload: { type: '事假', reason: '家中有事', startAt: '2026-10-01', endAt: '2026-10-02' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('无 leave_approve 时 PUT 审批返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['leave_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 leave_approve：可审批作用域内(研发部 5)请假单 → setStatus approved', async () => {
    const setStatus = vi.fn(async () => {});
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 5,
      type: '事假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 3,
      departmentId: 5, // 在用户(研发部2)的 subtree [2,3,4,5] 内
      applicantName: '张三',
      departmentName: '平台组',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(5, 'approved');
  });

  it('审批通过后通过统一 notify 定向通知申请人', async () => {
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn();
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 5,
      type: '事假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 3,
      departmentId: 5,
      applicantName: '张三',
      departmentName: '平台组',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(5, 'approved');
    expect(notify).toHaveBeenCalledWith(
      { userId: 3 },
      'notification',
      expect.objectContaining({ message: '你的请假单已被批准' }),
    );
  });

  it('驳回后通过统一 notify 定向通知申请人', async () => {
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn();
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 7,
      type: '年假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 4,
      departmentId: 5,
      applicantName: '王五',
      departmentName: '平台组',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/7/status',
      payload: { status: 'rejected' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(7, 'rejected');
    expect(notify).toHaveBeenCalledWith(
      { userId: 4 },
      'notification',
      expect.objectContaining({ message: '你的请假单已被驳回' }),
    );
  });

  it('跨部门(市场部 6)请假单不可审批 → 403', async () => {
    const setStatus = vi.fn(async () => {});
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 6,
      type: '年假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 9,
      departmentId: 6, // 市场部，在用户(研发部2)作用域之外
      applicantName: '李四',
      departmentName: '市场部',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/6/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('审批通过后自动将申请人请假日期区间置为休息，并通知申请人', async () => {
    const setStatus = vi.fn(async () => {});
    const setRangeRest = vi.fn(async () => 0);
    const notify = vi.fn();
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 5,
      type: '事假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 3,
      departmentId: 5,
      applicantName: '张三',
      departmentName: '平台组',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById }, shift: { setRangeRest }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(5, 'approved');
    expect(setRangeRest).toHaveBeenCalledWith({
      userId: 3,
      departmentId: 5,
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });
    expect(notify).toHaveBeenCalledWith(
      { userId: 3 },
      'notification',
      expect.objectContaining({ message: '你的请假单已被批准' }),
    );
  });

  it('驳回请假单不触发自动置休', async () => {
    const setStatus = vi.fn(async () => {});
    const setRangeRest = vi.fn(async () => 0);
    const getLeaveById = vi.fn(async (): Promise<LeaveView> => ({
      id: 7,
      type: '年假',
      reason: 'x',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      status: 'pending',
      applicantId: 4,
      departmentId: 5,
      applicantName: '王五',
      departmentName: '平台组',
    }));
    const app = buildApp(makeDeps({ hash, leave: { setStatus, getLeaveById }, shift: { setRangeRest } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/leaves/7/status',
      payload: { status: 'rejected' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setRangeRest).not.toHaveBeenCalled();
  });
});