import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  buildApp,
  type AppDeps,
  type ExceptionRepo,
  type AttendanceRepo,
  type ShiftRepo,
  type AttSettingRepo,
  type DepartmentRepo,
} from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { NotifyFn } from '../notify/socket';
import type { DepartmentNode } from '../leave/department-scope';
import type { AttendanceView, AttendanceExceptionView, ScheduleView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
];

const EXCEPTION_CODES = ['dashboard_view', 'user_view', 'att_exception_view', 'att_exception_manage'];

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
    exception?: Partial<ExceptionRepo>;
    attendance?: Partial<AttendanceRepo>;
    shift?: Partial<ShiftRepo>;
    attSetting?: Partial<AttSettingRepo>;
    dept?: Partial<DepartmentRepo>;
    notify?: NotifyFn;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = EXCEPTION_CODES } = opts;
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
      ...opts.shift,
    },
    attSettingRepo: {
      getSetting: vi.fn(async () => ({ earlyClockInMinutes: 5, lateClockOutMinutes: 5, lateMinutes: 0, earlyLeaveMinutes: 0, absentHours: 4, allowMakeup: true, makeupDeadlineDays: 7, requireApprovalForMakeup: true, notifyOnLate: true, notifyOnEarlyLeave: true, notifyOnAbsent: true, enableTimeCheck: true })),
      updateSetting: vi.fn(async (data) => data),
      ...opts.attSetting,
    },
    holidayRepo: {
      listHolidays: vi.fn(async () => []),
      createHoliday: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateHoliday: vi.fn(async () => ({ ok: true as const })),
      deleteHoliday: vi.fn(async () => 'ok' as const),
    },
    exceptionRepo: {
      listExceptions: vi.fn(async () => [] as AttendanceExceptionView[]),
      scanUpsert: vi.fn(async () => ({ created: 0, updated: 0 })),
      setStatus: vi.fn(async () => 'ok' as const),
      ...opts.exception,
    },
    categoryRepo: {
      listCategories: vi.fn(async () => []),
      createCategory: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateCategory: vi.fn(async () => ({ ok: true as const })),
      deleteCategory: vi.fn(async () => 'ok' as const),
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

const EXCEPTION_VIEW: AttendanceExceptionView = {
  id: 1,
  type: 'late',
  date: '2026-09-22',
  minutes: 30,
  status: 'pending',
  remark: null,
  userId: 3,
  departmentId: 3,
  userName: '张三',
  departmentName: '前端组',
  updatedAt: '2026-09-22T00:00:00.000Z',
};

describe('考勤异常路由（扫描判定 + 部门隔离 + 人工确认/驳回）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/attendance/exceptions 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/attendance/exceptions' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 att_exception_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/exceptions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 att_exception_view：listExceptions 收到 subtree scope，跨部门不可见', async () => {
    const listExceptions = vi.fn(async (): Promise<AttendanceExceptionView[]> => [EXCEPTION_VIEW]);
    const app = buildApp(makeDeps({ hash, exception: { listExceptions } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/exceptions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listExceptions).toHaveBeenCalledWith(
      { kind: 'subtree', departmentIds: [2, 3, 4, 5] },
      expect.objectContaining({}),
    );
    const items = res.json().data.exceptions as AttendanceExceptionView[];
    expect(items[0]?.id).toBe(1);
  });

  it('GET 可传 status/type 筛选', async () => {
    const listExceptions = vi.fn(async (): Promise<AttendanceExceptionView[]> => []);
    const app = buildApp(makeDeps({ hash, exception: { listExceptions } }));
    await app.ready();
    const token = await login(app);
    await app.inject({
      method: 'GET',
      url: '/api/attendance/exceptions?status=pending&type=late',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listExceptions).toHaveBeenCalledWith(expect.anything(), { status: 'pending', type: 'late' });
  });

  it('无 att_exception_manage 时 POST scan 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['att_exception_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/exceptions/scan',
      payload: { startDate: '2026-09-01', endDate: '2026-09-30' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('scan：基于排班预期时间判定异常并落库，返回 created/updated', async () => {
    const schedules: ScheduleView[] = [
      {
        id: 1, scheduleDate: '2026-09-22', isRestDay: false, userId: 3, userName: '张三',
        departmentId: 3, departmentName: '前端组', shiftId: 9, shiftName: '白班', startTime: '09:00', endTime: '18:00', color: '#3B82F6', workHours: 9,
      },
      {
        id: 2, scheduleDate: '2026-09-22', isRestDay: true, userId: 4, userName: '李四',
        departmentId: 4, departmentName: '后端组', shiftId: null, shiftName: null, startTime: null, endTime: null, color: null, workHours: 0,
      },
    ];
    const listAttendances = vi.fn(async (): Promise<AttendanceView[]> => [
      { id: 1, date: '2026-09-22', checkIn: '09:30', checkOut: '18:00', note: '', userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const scanUpsert = vi.fn(async () => ({ created: 1, updated: 0 }));
    const listSchedules = vi.fn(async () => schedules);
    const app = buildApp(
      makeDeps({
        hash,
        shift: { listSchedules },
        attendance: { listAttendances },
        exception: { scanUpsert },
      }),
    );
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/exceptions/scan',
      payload: { startDate: '2026-09-22', endDate: '2026-09-22' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // 张三迟到(避开休息日李四)
    expect(scanUpsert).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'late', minutes: 30, userId: 3, date: '2026-09-22' }),
    ]);
    expect(res.json().data).toEqual({ created: 1, updated: 0 });
  });

  it('PUT status：未找到 → 404', async () => {
    const setStatus = vi.fn(async () => 'not_found' as const);
    const app = buildApp(makeDeps({ hash, exception: { setStatus } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/attendance/exceptions/999/status',
      payload: { status: 'confirmed' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT status：越权（非本 scope 部门）→ 403', async () => {
    const setStatus = vi.fn(async () => 'out_of_scope' as const);
    const app = buildApp(makeDeps({ hash, exception: { setStatus } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/attendance/exceptions/1/status',
      payload: { status: 'confirmed' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PUT status 成功：setStatus 收到 scope+id+status，且通知对应员工', async () => {
    const setStatus = vi.fn(async () => 'ok' as const);
    const listExceptions = vi.fn(async (): Promise<AttendanceExceptionView[]> => [EXCEPTION_VIEW]);
    const notify = vi.fn();
    const app = buildApp(
      makeDeps({ hash, exception: { setStatus, listExceptions }, notify }),
    );
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/attendance/exceptions/1/status',
      payload: { status: 'confirmed', remark: '属实' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(
      { kind: 'subtree', departmentIds: [2, 3, 4, 5] },
      1,
      'confirmed',
      '属实',
    );
    expect(notify).toHaveBeenCalledWith(
      { userId: 3 },
      'notification',
      expect.objectContaining({ title: '考勤异常通知' }),
    );
  });
});