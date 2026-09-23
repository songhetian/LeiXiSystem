import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { NotifyFn } from '../notify/socket';
import type { DepartmentNode } from '../leave/department-scope';
import type { DashboardStatsView, AttendanceExceptionView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 6, parentId: 1 }, // 市场部
];

const DASHBOARD_CODES = [
  'dashboard_view',
  'user_view',
  'leave_view',
  'leave_approve',
  'overtime_view',
  'overtime_approve',
  'makeup_view',
  'makeup_approve',
  'reimburse_view',
  'reimburse_approve',
  'attendance_view',
  'att_exception_view',
  'dept_view',
];

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

function makeDeps(opts: {
  departmentId?: number;
  permissions?: string[];
  overrides?: Partial<{
    listLeaves: AppDeps['leaveRepo']['listLeaves'];
    getOvertimeStats: AppDeps['overtimeRepo']['getStats'];
    listMakeups: AppDeps['makeupRepo']['listMakeups'];
    listReimburses: AppDeps['reimburseRepo']['listReimburses'];
    listAttendances: AppDeps['attendanceRepo']['listAttendances'];
    listExceptions: AppDeps['exceptionRepo']['listExceptions'];
    listDepartments: AppDeps['departmentRepo']['listDepartments'];
    listUsers: AppDeps['rbacRepo']['listUsers'];
  }>;
  notify?: NotifyFn;
  hash?: string;
} = {}): AppDeps {
  const { departmentId = 1, permissions = DASHBOARD_CODES, overrides = {} } = opts;
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
      listUsers: overrides.listUsers ?? vi.fn(async () => []),
      setUserRoles: vi.fn(async () => {}),
      createUser: vi.fn(async () => ({ id: 1 })),
      updateUser: vi.fn(async () => {}),
      deleteUser: vi.fn(async () => {}),
    },
    departmentRepo: {
      listTree: vi.fn(async () => TREE),
      listDepartments: overrides.listDepartments ?? vi.fn(async () => []),
      createDepartment: vi.fn(async () => ({ id: 1 })),
      updateDepartment: vi.fn(async () => {}),
      deleteDepartment: vi.fn(async () => 'ok' as const),
    },
    leaveRepo: {
      listLeaves: overrides.listLeaves ?? vi.fn(async () => []),
      createLeave: vi.fn(async () => ({ id: 1 })),
      getLeaveById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
    },
    reimburseRepo: {
      listReimburses: overrides.listReimburses ?? vi.fn(async () => []),
      createReimburse: vi.fn(async () => ({ id: 1 })),
      getReimburseById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
    },
    categoryRepo: {
      listCategories: vi.fn(async () => []),
      createCategory: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateCategory: vi.fn(async () => ({ ok: true as const })),
      deleteCategory: vi.fn(async () => 'ok' as const),
    },
    attendanceRepo: {
      listAttendances: overrides.listAttendances ?? vi.fn(async () => []),
      createAttendance: vi.fn(async () => ({ id: 1 })),
    },
    overtimeRepo: {
      listOvertimes: vi.fn(async () => []),
      createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
      getStats: overrides.getOvertimeStats ?? vi.fn(async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
    },
    makeupRepo: {
      listMakeups: overrides.listMakeups ?? vi.fn(async () => []),
      createMakeup: vi.fn(async () => ({ id: 1 })),
      getMakeupById: vi.fn(async () => null),
      setStatus: vi.fn(async () => {}),
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
      listExceptions: overrides.listExceptions ?? vi.fn(async () => []),
      scanUpsert: vi.fn(async () => ({ created: 0, updated: 0 })),
      setStatus: vi.fn(async () => 'ok' as const),
    },
    notify: opts.notify ?? vi.fn(),
  };
}

async function login(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'x' } });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function zeroSkeleton(): DashboardStatsView {
  return {
    month: currentMonth(),
    approvals: { leave: 0, overtime: 0, makeup: 0, reimburse: 0, total: 0 },
    attendance: { records: 0, late: 0, earlyLeave: 0, missingPunch: 0, absent: 0 },
    trend: { leaves: 0, makeupCount: 0, overtimeHours: 0, reimburseCount: 0, reimburseAmount: 0 },
    scale: { departments: 0, employees: 0, topCategories: [] },
  };
}

describe('仪表盘聚合路由（dashboard_view 总开关 + 模块权限收敛 + 部门隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/dashboard/stats 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 dashboard_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['user_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('仅 dashboard_view（无任何模块权限）：不调用任何模块 repo，返回全 0 骨架', async () => {
    const listLeaves = vi.fn(async () => [] as never[]);
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'], overrides: { listLeaves } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listLeaves).not.toHaveBeenCalled();
    expect(res.json().data.stats).toEqual(zeroSkeleton());
  });

  it('全模块权限：按「当前用户 scope」取数并正确聚合成各块指标', async () => {
    const month = currentMonth();
    const listLeaves = vi.fn(async () => [
      { id: 1, type: '病假', reason: '', startAt: `${month}-01`, endAt: `${month}-01`, status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 2, type: '事假', reason: '', startAt: `${month}-02`, endAt: `${month}-02`, status: 'approved', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 3, type: '病假', reason: '', startAt: `${month}-03`, endAt: `${month}-03`, status: 'pending', applicantId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组' },
    ]);
    const getOvertimeStats = vi.fn(async () => ({ totalHours: 45, approvedCount: 9, pendingCount: 2, month }));
    const listMakeups = vi.fn(async () => [
      { id: 1, recordDate: `${month}-05`, clockType: 'check_in', clockTime: '09:05', reason: '', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 2, recordDate: `${month}-06`, clockType: 'check_out', clockTime: '18:05', reason: '', status: 'approved', applicantId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组' },
    ]);
    const listReimburses = vi.fn(async () => [
      { id: 1, categoryId: 1, categoryName: '餐饮', reason: '', amount: 100, status: 'pending', applicantId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组', createdAt: `${month}-01T00:00:00.000Z`, items: [{ id: 1, reimburseId: 1, categoryId: 1, categoryName: '餐饮', amount: 100, note: null }] },
      { id: 2, categoryId: 1, categoryName: '餐饮', reason: '', amount: 200, status: 'approved', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组', createdAt: `${month}-02T00:00:00.000Z`, items: [{ id: 2, reimburseId: 2, categoryId: 1, categoryName: '餐饮', amount: 200, note: null }] },
    ]);
    const listAttendances = vi.fn(async () => [
      { id: 1, date: `${month}-01`, checkIn: '09:00', checkOut: '18:00', note: '', userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 2, date: `${month}-01`, checkIn: '09:10', checkOut: '18:00', note: '', userId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组' },
    ]);
    const listExceptions = vi.fn(async (): Promise<AttendanceExceptionView[]> => [
      { id: 1, type: 'late', date: `${month}-01`, minutes: 10, status: 'pending', remark: null, userId: 4, departmentId: 4, userName: '李四', departmentName: '后端组', updatedAt: '' },
      { id: 2, type: 'missing_punch', date: `${month}-02`, minutes: null, status: 'pending', remark: null, userId: 4, departmentId: 4, userName: '李四', departmentName: '后端组', updatedAt: '' },
    ]);
    const listDepartments = vi.fn(async () => [
      { id: 1, name: '总部', parentId: null },
      { id: 2, name: '研发部', parentId: 1 },
      { id: 3, name: '前端组', parentId: 2 },
      { id: 4, name: '后端组', parentId: 2 },
      { id: 6, name: '市场部', parentId: 1 },
    ]);
    const listUsers = vi.fn(async () => [
      { id: 1, username: 'admin', realName: '管理员', status: 'active', roleIds: [1], departmentId: 1 },
      { id: 3, username: 'zhangsan', realName: '张三', status: 'active', roleIds: [2], departmentId: 3 },
      { id: 4, username: 'lisi', realName: '李四', status: 'active', roleIds: [2], departmentId: 4 },
      { id: 5, username: 'wisitor', realName: '市场', status: 'active', roleIds: [2], departmentId: 6 },
    ]);

    const app = buildApp(makeDeps({ hash, departmentId: 1, overrides: { listLeaves, getOvertimeStats, listMakeups, listReimburses, listAttendances, listExceptions, listDepartments, listUsers } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const stats: DashboardStatsView = res.json().data.stats;

    expect(stats.approvals).toEqual({ leave: 2, overtime: 2, makeup: 1, reimburse: 1, total: 6 });
    expect(stats.attendance).toEqual({ records: 2, late: 1, earlyLeave: 0, missingPunch: 1, absent: 0 });
    expect(stats.trend.leaves).toBe(3);
    expect(stats.trend.makeupCount).toBe(2);
    expect(stats.trend.overtimeHours).toBe(45);
    expect(stats.trend.reimburseCount).toBe(2);
    expect(stats.trend.reimburseAmount).toBe(300);
    expect(stats.scale.departments).toBe(5); // 根部门作用域为 all，可见全部 5 个部门
    expect(stats.scale.employees).toBe(4); // admin/张三/李四/市场，全部用户
    expect(stats.scale.topCategories).toEqual([{ name: '餐饮', amount: 300 }]);
  });

  it('部门隔离：subtree 用户仅聚合其作用域内部门（scope 传给各 repo）', async () => {
    const month = currentMonth();
    const listLeaves = vi.fn(async () => [
      { id: 1, type: '病假', reason: '', startAt: `${month}-01`, endAt: `${month}-01`, status: 'pending', applicantId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组' },
      { id: 2, type: '病假', reason: '', startAt: `${month}-02`, endAt: `${month}-02`, status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const listUsers = vi.fn(async () => [
      { id: 3, username: 'zhangsan', realName: '张三', status: 'active', roleIds: [2], departmentId: 3 },
      { id: 4, username: 'lisi', realName: '李四', status: 'active', roleIds: [2], departmentId: 4 },
      { id: 5, username: 'wisitor', realName: '市场', status: 'active', roleIds: [2], departmentId: 6 },
    ]);
    const app = buildApp(makeDeps({ hash, departmentId: 2, overrides: { listLeaves, listUsers } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const stats = res.json().data.stats;
    expect(stats.approvals.leave).toBe(2);
    expect(stats.scale.employees).toBe(2); // 张三/李四（市场部 6 不在研发部 scope）
    // 确认把 subtree scope（研发部下 2,3,4）传给 repo
    const callScope = (
      listLeaves as unknown as { mock: { calls: Array<[{ departmentIds: number[]; kind: string }]> } }
    ).mock.calls[0]![0];
    expect(callScope.kind).toBe('subtree');
    expect(callScope.departmentIds).toContain(2);
    expect(callScope.departmentIds).toContain(3);
    expect(callScope.departmentIds).toContain(4);
    expect(callScope.departmentIds).not.toContain(6);
  });
});