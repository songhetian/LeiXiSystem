import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type AttSettingRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';
import type { AttSettingView } from '@leixi/shared';

const TREE: DepartmentNode[] = [{ id: 1, parentId: null }];

// 考勤设置是系统级单例配置，只需 att_setting_view（查看）/ att_setting_edit（编辑）
const SETTING_CODES = ['att_setting_view', 'att_setting_edit'];

/** 默认考勤设置（与 schema 默认值一致，作为独立来源断言用） */
const DEFAULT_SETTING: AttSettingView = {
  earlyClockInMinutes: 5,
  lateClockOutMinutes: 5,
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  absentHours: 4,
  allowMakeup: true,
  makeupDeadlineDays: 7,
  requireApprovalForMakeup: true,
  notifyOnLate: true,
  notifyOnEarlyLeave: true,
  notifyOnAbsent: true,
  enableTimeCheck: true,
};

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
    attSetting?: Partial<AttSettingRepo>;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 1, permissions = SETTING_CODES } = opts;
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
      getSetting: vi.fn(async () => ({ ...DEFAULT_SETTING })),
      updateSetting: vi.fn(async (data) => ({ ...DEFAULT_SETTING, ...data })),
      ...opts.attSetting,
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

async function login(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'x' },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('考勤设置路由（系统级单例配置，无部门隔离/审批流）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/attendance/settings 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/attendance/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 att_setting_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/settings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 att_setting_view：GET 返回系统级单例配置', async () => {
    const getSetting = vi.fn(async (): Promise<AttSettingView> => ({ ...DEFAULT_SETTING }));
    const app = buildApp(makeDeps({ hash, attSetting: { getSetting } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/settings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data.setting as AttSettingView;
    expect(data.earlyClockInMinutes).toBe(5);
    expect(data.absentHours).toBe(4);
    expect(getSetting).toHaveBeenCalledTimes(1);
  });

  it('无 att_setting_edit 时 PUT 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view', 'att_setting_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/attendance/settings',
      payload: { ...DEFAULT_SETTING, lateMinutes: 10 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 att_setting_edit：PUT 全量更新配置', async () => {
    const updateSetting = vi.fn(async (data: AttSettingView) => data);
    const app = buildApp(makeDeps({ hash, attSetting: { updateSetting } }));
    await app.ready();
    const token = await login(app);
    const body = { ...DEFAULT_SETTING, lateMinutes: 15, allowMakeup: false };
    const res = await app.inject({
      method: 'PUT',
      url: '/api/attendance/settings',
      payload: body,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(updateSetting).toHaveBeenCalledWith({
      earlyClockInMinutes: 5,
      lateClockOutMinutes: 5,
      lateMinutes: 15,
      earlyLeaveMinutes: 0,
      absentHours: 4,
      allowMakeup: false,
      makeupDeadlineDays: 7,
      requireApprovalForMakeup: true,
      notifyOnLate: true,
      notifyOnEarlyLeave: true,
      notifyOnAbsent: true,
      enableTimeCheck: true,
    });
    const data = res.json().data.setting as AttSettingView;
    expect(data.lateMinutes).toBe(15);
    expect(data.allowMakeup).toBe(false);
  });
});