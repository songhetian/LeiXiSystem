import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type AttendanceRepo, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { AttendanceView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const ATTENDANCE_CODES = ['dashboard_view', 'user_view', 'attendance_view', 'attendance_punch'];

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
    attendance?: Partial<AttendanceRepo>;
    dept?: Partial<DepartmentRepo>;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = ATTENDANCE_CODES } = opts;
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
      ...opts.attendance,
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

describe('考勤路由（部门数据隔离，无审批流）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/attendance 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/attendance' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 attendance_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 attendance_view：listAttendances 收到“本部门+下属部门”scope，跨部门不可见', async () => {
    const listAttendances = vi.fn(async (): Promise<AttendanceView[]> => [
      { id: 1, date: '2026-09-22', checkIn: '09:00', checkOut: '18:30', note: '正常', userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, attendance: { listAttendances } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listAttendances).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const items = res.json().data.attendance as AttendanceView[];
    expect(items.every((l) => [2, 3, 4, 5].includes(l.departmentId))).toBe(true);
  });

  it('无部门用户 → scope 为 all（系统级）', async () => {
    const listAttendances = vi.fn(async () => []);
    const app = buildApp(makeDeps({ hash, departmentId: null, attendance: { listAttendances } }));
    await app.ready();
    const token = await login(app);
    await app.inject({
      method: 'GET',
      url: '/api/attendance',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listAttendances).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('无 attendance_punch 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['attendance_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance',
      payload: { date: '2026-09-22', checkIn: '09:00', note: '上班打卡' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 attendance_punch：createAttendance 强制写入当前用户 departmentId（不信任前端）', async () => {
    const createAttendance = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, attendance: { createAttendance } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance',
      payload: { date: '2026-09-22', checkIn: '09:00', note: '上班打卡' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, departmentId: 2, checkIn: '09:00', date: '2026-09-22' }),
    );
  });

  it('无部门用户 POST 返回 409', async () => {
    const app = buildApp(makeDeps({ hash, departmentId: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance',
      payload: { date: '2026-09-22', checkIn: '09:00', note: 'x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('createAttendance 支持可选的 checkOut（下班打卡）', async () => {
    const createAttendance = vi.fn(async () => ({ id: 10 }));
    const app = buildApp(makeDeps({ hash, attendance: { createAttendance } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance',
      payload: { date: '2026-09-22', checkOut: '18:30', note: '下班打卡' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ checkOut: '18:30', checkIn: null }),
    );
  });
});

describe('考勤统计报表 GET /api/attendance/stats', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('无 attendance_view 权限返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/stats?month=2026-09',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有权限：按当前用户 scope 拉取记录并用纯函数聚合成行级统计', async () => {
    const listAttendances = vi.fn(async (): Promise<AttendanceView[]> => [
      {
        id: 1, date: '2026-09-02', checkIn: '09:00', checkOut: '18:00', note: '',
        userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组',
      },
      {
        id: 2, date: '2026-09-03', checkIn: '09:05', checkOut: '18:00', note: '',
        userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组',
      },
      {
        id: 3, date: '2026-08-30', checkIn: '09:00', checkOut: '18:00', note: '',
        userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组',
      },
    ]);
    const app = buildApp(makeDeps({ hash, attendance: { listAttendances } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/stats?month=2026-09',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listAttendances).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const stats = res.json().data.stats;
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      userName: '张三',
      presentDays: 2,
      normalDays: 1,
      lateCount: 1,
      month: '2026-09',
    });
  });

  it('month 缺失返回 400', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/stats',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});