import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type SalaryRepo, type DepartmentRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { SalaryView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const SALARY_CODES = ['dashboard_view', 'user_view', 'salary_view', 'salary_create'];

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
    departmentId?: number | null; // 录入者（当前登录用户）部门
    targetUserId?: number; // 被发薪员工
    targetDept?: number | null; // 被发薪员工所属部门
    permissions?: string[];
    salary?: Partial<SalaryRepo>;
    dept?: Partial<DepartmentRepo>;
    hash?: string;
  } = {},
): AppDeps {
  const {
    departmentId = 2,
    targetUserId = 3,
    targetDept = 3,
    permissions = SALARY_CODES,
  } = opts;
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
        // id=1 为录入者（admin）；targetUserId 为被发薪员工，可按需配置其部门
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
        if (id === targetUserId) {
          return {
            id,
            username: 'emp',
            password: opts.hash ?? '',
            realName: '员工',
            status: 'active',
            departmentId: targetDept,
            roleIds: [2],
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
    salaryRepo: {
      listSalaries: vi.fn(async () => []),
      createSalary: vi.fn(async () => ({ id: 1 })),
      ...opts.salary,
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

describe('薪资路由（部门数据隔离，无审批流，管理端为他人录入）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/salaries 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/salaries' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 salary_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/salaries',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 salary_view：listSalaries 收到“本部门+下属部门”scope，跨部门不可见', async () => {
    const listSalaries = vi.fn(async (): Promise<SalaryView[]> => [
      { id: 1, month: '2026-08', basic: 10000, bonus: 2000, deduction: 500, net: 11500, userId: 3, departmentId: 3, employeeName: '张三', departmentName: '前端组' },
    ]);
    const app = buildApp(makeDeps({ hash, salary: { listSalaries } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/salaries',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listSalaries).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const items = res.json().data.salaries as SalaryView[];
    expect(items.every((l) => [2, 3, 4, 5].includes(l.departmentId))).toBe(true);
  });

  it('无部门录入者 → scope 为 all（系统级）', async () => {
    const listSalaries = vi.fn(async () => []);
    const app = buildApp(makeDeps({ hash, departmentId: null, salary: { listSalaries } }));
    await app.ready();
    const token = await login(app);
    await app.inject({
      method: 'GET',
      url: '/api/salaries',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listSalaries).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('无 salary_create 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['salary_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/salaries',
      payload: { month: '2026-08', userId: 3, basic: 10000, bonus: 2000, deduction: 500 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 salary_create：departmentId 取自目标员工（非录入者），net 服务端计算', async () => {
    const createSalary = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, salary: { createSalary } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/salaries',
      payload: { month: '2026-08', userId: 3, basic: 10000, bonus: 2000, deduction: 500 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createSalary).toHaveBeenCalledWith({
      month: '2026-08',
      userId: 3,
      departmentId: 3, // 目标员工部门，而非录入者部门 2
      basic: 10000,
      bonus: 2000,
      deduction: 500,
      net: 11500, // 10000 + 2000 - 500
    });
  });

  it('目标员工不存在 → 404', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/salaries',
      payload: { month: '2026-08', userId: 4, basic: 10000, bonus: 0, deduction: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('目标员工无部门 → 409', async () => {
    const app = buildApp(makeDeps({ hash, targetDept: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/salaries',
      payload: { month: '2026-08', userId: 3, basic: 10000, bonus: 0, deduction: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('目标员工在录入者作用域外(市场部 6) → 403', async () => {
    const createSalary = vi.fn(async () => ({ id: 1 }));
    const app = buildApp(makeDeps({ hash, targetDept: 6, salary: { createSalary } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/salaries',
      payload: { month: '2026-08', userId: 3, basic: 10000, bonus: 0, deduction: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(createSalary).not.toHaveBeenCalled();
  });
});