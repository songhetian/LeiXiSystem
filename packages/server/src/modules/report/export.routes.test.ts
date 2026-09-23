import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { NotifyFn } from '../notify/socket';
import type { DepartmentNode, DepartmentScope } from '../leave/department-scope';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 6, parentId: 1 }, // 市场部
];

const CODES = ['dashboard_view', 'user_view', 'leave_view', 'overtime_view', 'salary_view', 'attendance_view', 'att_exception_view', 'makeup_view', 'reimburse_view'];

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
    listOvertimes: AppDeps['overtimeRepo']['listOvertimes'];
    listSalaries: AppDeps['salaryRepo']['listSalaries'];
    listAttendances: AppDeps['attendanceRepo']['listAttendances'];
  }>;
  notify?: NotifyFn;
  hash?: string;
} = {}): AppDeps {
  const { departmentId = 1, permissions = CODES, overrides = {} } = opts;
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    userRepo: {
      async findByUsername(username) {
        return { id: username === 'admin' ? 1 : 2, username, password: opts.hash ?? '', realName: username === 'admin' ? '管理员' : '访客', status: 'active', departmentId, roleIds: username === 'admin' ? [1] : [2] };
      },
      async findById(id) {
        return { id, username: id === 1 ? 'admin' : 'guest', password: opts.hash ?? '', realName: id === 1 ? '管理员' : '访客', status: 'active', departmentId, roleIds: id === 1 ? [1] : [2] };
      },
    },
    permissionLoader: { async loadPermissionCodes(roleIds) { return roleIds.includes(1) ? permissions : []; } },
    rbacRepo: {
      listRoles: vi.fn(async () => []), listPermissions: vi.fn(async () => []), setRolePermissions: vi.fn(async () => {}),
      listUsers: vi.fn(async () => []), setUserRoles: vi.fn(async () => {}), createUser: vi.fn(async () => ({ id: 1 })),
      updateUser: vi.fn(async () => {}), deleteUser: vi.fn(async () => {}),
    },
    departmentRepo: {
      listTree: vi.fn(async () => TREE), listDepartments: vi.fn(async () => []), createDepartment: vi.fn(async () => ({ id: 1 })),
      updateDepartment: vi.fn(async () => {}), deleteDepartment: vi.fn(async () => 'ok' as const),
    },
    leaveRepo: {
      listLeaves: overrides.listLeaves ?? vi.fn(async () => []), createLeave: vi.fn(async () => ({ id: 1 })),
      getLeaveById: vi.fn(async () => null), setStatus: vi.fn(async () => {}),
    },
    reimburseRepo: {
      listReimburses: vi.fn(async () => []), createReimburse: vi.fn(async () => ({ id: 1 })),
      getReimburseById: vi.fn(async () => null), setStatus: vi.fn(async () => {}),
    },
    categoryRepo: {
      listCategories: vi.fn(async () => []), createCategory: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateCategory: vi.fn(async () => ({ ok: true as const })), deleteCategory: vi.fn(async () => 'ok' as const),
    },
    attendanceRepo: {
      listAttendances: overrides.listAttendances ?? vi.fn(async () => []), createAttendance: vi.fn(async () => ({ id: 1 })),
    },
    overtimeRepo: {
      listOvertimes: overrides.listOvertimes ?? vi.fn(async () => []), createOvertime: vi.fn(async () => ({ id: 1 })),
      getOvertimeById: vi.fn(async () => null), setStatus: vi.fn(async () => {}),
      getStats: vi.fn(async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' })),
    },
    makeupRepo: {
      listMakeups: vi.fn(async () => []), createMakeup: vi.fn(async () => ({ id: 1 })),
      getMakeupById: vi.fn(async () => null), setStatus: vi.fn(async () => {}),
    },
    salaryRepo: {
      listSalaries: overrides.listSalaries ?? vi.fn(async () => []), createSalary: vi.fn(async () => ({ id: 1 })),
    },
    shiftRepo: {
      listShifts: vi.fn(async () => []), createShift: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateShift: vi.fn(async () => ({ ok: true as const })), deleteShift: vi.fn(async () => 'ok' as const),
      toggleShift: vi.fn(async () => 'ok' as const), getRestShift: vi.fn(async () => ({ id: 1, name: '休息' })),
      listSchedules: vi.fn(async () => []), listSchedulesByUser: vi.fn(async () => []),
      upsertSchedule: vi.fn(async () => ({ id: 1 })), batchUpsertSchedules: vi.fn(async () => 0),
      copyScheduleTemplate: vi.fn(async () => 0), smartGenerate: vi.fn(async () => 0),
      deleteSchedule: vi.fn(async () => 'ok' as const), setRangeRest: vi.fn(async () => 0),
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
      listHolidays: vi.fn(async () => []), createHoliday: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateHoliday: vi.fn(async () => ({ ok: true as const })), deleteHoliday: vi.fn(async () => 'ok' as const),
    },
    leaveTypeRepo: {
      listLeaveTypes: vi.fn(async () => []), createLeaveType: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateLeaveType: vi.fn(async () => ({ ok: true as const })), deleteLeaveType: vi.fn(async () => 'ok' as const),
    },
    quotaRepo: {
      listQuotas: vi.fn(async () => []), upsertQuota: vi.fn(async () => ({ ok: true as const })),
      batchUpsertQuotas: vi.fn(async () => 0), getTrend: vi.fn(async () => []),
    },
    exceptionRepo: {
      listExceptions: vi.fn(async () => []), scanUpsert: vi.fn(async () => ({ created: 0, updated: 0 })),
      setStatus: vi.fn(async () => 'ok' as const),
    },
    notify: opts.notify ?? vi.fn(),
  };
}

async function login(app: ReturnType<typeof buildApp>, username = 'admin') {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'x' } });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('数据导出路由（CSV/xlsx 双格式 + 部门 scope 隔离 + 权限）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/export/leaves 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/export/leaves' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 leave_view 时导出返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/export/leaves', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('CSV 请假导出：content-type text/csv + 中文表头 + 状态映射为中文，且 listLeaves 收到当前用户 scope', async () => {
    const listLeaves = vi.fn(async () => [
      { id: 1, type: '病假', reason: '感冒', startAt: '2026-09-01', endAt: '2026-09-01', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 2, type: '事假', reason: '家事', startAt: '2026-09-02', endAt: '2026-09-02', status: 'approved', applicantId: 4, departmentId: 4, applicantName: '李四', departmentName: '后端组' },
    ]);
    const app = buildApp(makeDeps({ hash, overrides: { listLeaves } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/export/leaves?format=csv', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('.csv');
    const body = (res.body as unknown as Buffer).toString('utf8');
    expect(body).toContain('申请人,部门,类型,事由,开始,结束,状态');
    expect(body).toContain('待审批');
    expect(body).toContain('已批准');
    // 当前用户归属部门(admin=总部 id1)非空 → buildScope 返回 subtree，覆盖 1,2,3,4,6
    const callScope = (listLeaves as unknown as { mock: { calls: Array<[DepartmentScope]> } }).mock.calls[0]![0];
    expect(callScope.kind).toBe('subtree');
    if (callScope.kind === 'subtree') expect([...(callScope.departmentIds)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6]);
  });

  it('xlsx 加班导出（默认格式）：xlsx MIME + .xlsx 下载名 + 非空二进制', async () => {
    const listOvertimes = vi.fn(async () => [
      { id: 1, date: '2026-09-05', startTime: '19:00', endTime: '22:00', hours: 3, reason: '上线', status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, overrides: { listOvertimes } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/export/overtimes', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('.xlsx');
    expect((res.body as unknown as Buffer).length).toBeGreaterThan(100);
  });

  it('CSV 薪资导出：金额列按 money 保留两位小数', async () => {
    const listSalaries = vi.fn(async () => [
      { id: 1, month: '2026-08', basic: 5000, bonus: 500, deduction: 200, net: 5300, userId: 3, departmentId: 3, employeeName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, overrides: { listSalaries } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/export/salaries?format=csv', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const body = (res.body as unknown as Buffer).toString('utf8');
    expect(body).toContain('员工,部门,月份,基本(元),奖金(元),扣款(元),实发(元)');
    expect(body).toContain('5000.00');
    expect(body).toContain('5300.00');
  });

  it('考勤统计报表导出：按月聚合出勤/迟到，CSV 含统计列', async () => {
    const month = '2026-09';
    const listAttendances = vi.fn(async () => [
      { id: 1, date: `${month}-01`, checkIn: '09:00', checkOut: '18:00', note: '', userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
      { id: 2, date: `${month}-02`, checkIn: '09:10', checkOut: '18:00', note: '', userId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, overrides: { listAttendances } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: `/api/export/attendance-stats?month=${month}&format=csv`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const body = (res.body as unknown as Buffer).toString('utf8');
    expect(body).toContain('出勤天数');
    expect(body).toContain('迟到');
    expect(body).toContain('张三');
    // 2 条打卡：出勤2天/正常1/迟到1/早退0/总工时17.8/平均8.9
    expect(body).toContain('张三,前端组,2,1,1,0,17.8,8.9');
  });
});