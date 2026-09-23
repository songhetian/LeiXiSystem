import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { buildApp, type AppDeps, type ShiftRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { DepartmentNode } from '../leave/department-scope';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const SHIFT_CODES = [
  'dashboard_view',
  'user_view',
  'shift_view',
  'shift_manage',
  'my_schedule_view',
  'schedule_template_view',
  'schedule_template_create',
  'schedule_template_edit',
  'schedule_template_delete',
  'schedule_template_apply',
];

let hash = ''; // 顶层可变，beforeEach 里用 bcrypt 计算后再由 makeDeps 引用

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
    actorDept?: number | null; // 当前登录用户（排班发起者）部门
    targetUserId?: number; // 被排班员工
    targetDept?: number | null; // 被排班员工部门
    permissions?: string[];
    shift?: Partial<ShiftRepo>;
    notify?: ReturnType<typeof vi.fn>;
    rbac?: Partial<AppDeps['rbacRepo']>;
  } = {},
): AppDeps {
  const {
    actorDept = 2,
    targetUserId = 3,
    targetDept = 3,
    permissions = SHIFT_CODES,
  } = opts;
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    userRepo: {
      async findByUsername(username) {
        return {
          id: username === 'admin' ? 1 : 2,
          username,
          password: hash,
          realName: username === 'admin' ? '管理员' : '访客',
          status: 'active',
          departmentId: actorDept,
          roleIds: username === 'admin' ? [1] : [2],
        };
      },
      async findById(id) {
        if (id === 1) {
          return {
            id,
            username: 'admin',
            password: hash,
            realName: '管理员',
            status: 'active',
            departmentId: actorDept,
            roleIds: [1],
          };
        }
        if (id === targetUserId) {
          return {
            id,
            username: 'emp',
            password: hash,
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
      ...opts.rbac,
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

describe('排班路由（班次管理 + 排班管理 + 我的排班，部门数据隔离）', () => {
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/shifts 返回 401', async () => {
    const app = buildApp(makeDeps());
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/shifts' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 shift_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/shifts', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/shifts 以“本部门+下属部门”scope 查询班次', async () => {
    const listShifts = vi.fn(async () => {
      return [];
    });
    const app = buildApp(makeDeps({ shift: { listShifts } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/shifts', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listShifts).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
  });

  it('POST /api/shifts 需 shift_manage；无则 403', async () => {
    const app = buildApp(makeDeps({ permissions: ['shift_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/shifts',
      payload: { name: '早班', startTime: '08:00', endTime: '17:00' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/shifts 成功 → 201', async () => {
    const createShift = vi.fn(async () => ({ ok: true as const, id: 7 }));
    const app = buildApp(makeDeps({ shift: { createShift } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/shifts',
      payload: { name: '早班', startTime: '08:00', endTime: '17:00', restDuration: 60 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createShift).toHaveBeenCalledWith(expect.objectContaining({ name: '早班', restDuration: 60 }));
  });

  it('POST /api/shifts 名称重复 → 409', async () => {
    const createShift = vi.fn(async () => ({ ok: false as const, reason: 'dup' as const }));
    const app = buildApp(makeDeps({ shift: { createShift } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/shifts',
      payload: { name: '早班', startTime: '08:00', endTime: '17:00' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PUT /api/shifts/:id 不存在 → 404', async () => {
    const updateShift = vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const }));
    const app = buildApp(makeDeps({ shift: { updateShift } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/shifts/9',
      payload: { name: '晚班' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/shifts/:id 被排班引用 → 409', async () => {
    const deleteShift = vi.fn(async () => 'in_use' as const);
    const app = buildApp(makeDeps({ shift: { deleteShift } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'DELETE', url: '/api/shifts/1', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(409);
  });

  it('GET /api/schedules 支持日期区间过滤并带 scope', async () => {
    const listSchedules = vi.fn(async () => []);
    const app = buildApp(makeDeps({ shift: { listSchedules } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules?startDate=2026-09-01&endDate=2026-09-30',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listSchedules).toHaveBeenCalledWith(
      { kind: 'subtree', departmentIds: [2, 3, 4, 5] },
      { startDate: '2026-09-01', endDate: '2026-09-30' },
    );
  });

  it('GET /api/schedules/self 需 my_schedule_view，只查当前用户', async () => {
    const listSchedulesByUser = vi.fn(async () => []);
    const app = buildApp(makeDeps({ shift: { listSchedulesByUser } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules/self?startDate=2026-09-01&endDate=2026-09-30',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listSchedulesByUser).toHaveBeenCalledWith(1, { startDate: '2026-09-01', endDate: '2026-09-30' });
  });

  it('GET /api/schedules/stats 按月份拉取排班并聚合员工×月份统计', async () => {
    const listSchedules = vi.fn(async () => [
      {
        id: 1,
        scheduleDate: '2026-09-02',
        isRestDay: false,
        userId: 1,
        userName: '张三',
        departmentId: 2,
        departmentName: '研发部',
        shiftId: 1,
        shiftName: '早班',
        startTime: '09:00',
        endTime: '18:00',
        color: '#3B82F6',
        workHours: 9,
      },
      {
        id: 2,
        scheduleDate: '2026-09-03',
        isRestDay: true,
        userId: 1,
        userName: '张三',
        departmentId: 2,
        departmentName: '研发部',
        shiftId: null,
        shiftName: null,
        startTime: null,
        endTime: null,
        color: null,
        workHours: 0,
      },
    ]);
    const app = buildApp(makeDeps({ shift: { listSchedules } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules/stats?month=2026-09',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(listSchedules).toHaveBeenCalledWith(
      { kind: 'subtree', departmentIds: [2, 3, 4, 5] },
      { startDate: '2026-09-01', endDate: '2026-09-30' },
    );
    expect(body.data.stats).toHaveLength(1);
    expect(body.data.stats[0]).toMatchObject({
      userName: '张三',
      shiftDays: 1,
      restDays: 1,
      totalWorkHours: 9,
      avgWorkHours: 9,
      month: '2026-09',
    });
  });

  it('GET /api/schedules/stats 缺少 month → 400', async () => {
    const app = buildApp(makeDeps({}));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules/stats',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/schedule-templates 返回模板列表', async () => {
    const listTemplates = vi.fn(async () => [{ id: 1, name: '标准周', description: null, createdAt: '2026-09-01T00:00:00.000Z', items: [] }]);
    const app = buildApp(makeDeps({ shift: { listTemplates } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/schedule-templates', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(listTemplates).toHaveBeenCalled();
    expect(res.json().data.templates).toHaveLength(1);
  });

  it('POST /api/schedule-templates 新建模板成功 → 200；名称重复 → 409', async () => {
    const createTemplate = vi
      .fn<ShiftRepo['createTemplate']>()
      .mockResolvedValueOnce({ ok: true, id: 7 })
      .mockResolvedValueOnce({ ok: false, reason: 'dup' });
    const app = buildApp(makeDeps({ shift: { createTemplate } }));
    await app.ready();
    const token = await login(app);
    const headers = { authorization: `Bearer ${token}` };
    const ok = await app.inject({
      method: 'POST',
      url: '/api/schedule-templates',
      payload: { name: '早班周' },
      headers,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.id).toBe(7);
    const dup = await app.inject({
      method: 'POST',
      url: '/api/schedule-templates',
      payload: { name: '早班周' },
      headers,
    });
    expect(dup.statusCode).toBe(409);
  });

  it('PUT /api/schedule-templates/:id/items 替换条目成功 → 200', async () => {
    const setTemplateItems = vi.fn(async (): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> => ({ ok: true }));
    const app = buildApp(makeDeps({ shift: { setTemplateItems } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/schedule-templates/1/items',
      payload: { items: [{ userId: 3, weekday: 1, shiftId: 9 }] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setTemplateItems).toHaveBeenCalledWith(1, [{ userId: 3, weekday: 1, shiftId: 9 }]);
  });

  it('POST /api/schedule-templates/:id/apply 一键应用返回 count；模板不存在 → 404', async () => {
    const applyTemplate = vi
      .fn<ShiftRepo['applyTemplate']>()
      .mockResolvedValueOnce({ ok: true, count: 5 })
      .mockResolvedValueOnce({ ok: false, reason: 'not_found' });
    const app = buildApp(makeDeps({ shift: { applyTemplate } }));
    await app.ready();
    const token = await login(app);
    const headers = { authorization: `Bearer ${token}` };
    const ok = await app.inject({
      method: 'POST',
      url: '/api/schedule-templates/1/apply',
      payload: { targetStart: '2026-09-28' },
      headers,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.count).toBe(5);
    const notFound = await app.inject({
      method: 'POST',
      url: '/api/schedule-templates/99/apply',
      payload: { targetStart: '2026-09-28' },
      headers,
    });
    expect(notFound.statusCode).toBe(404);
  });

  it('DELETE /api/schedule-templates/:id 不存在 → 404', async () => {
    const deleteTemplate = vi.fn(async (): Promise<'ok' | 'not_found'> => 'not_found');
    const app = buildApp(makeDeps({ shift: { deleteTemplate } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'DELETE', url: '/api/schedule-templates/99', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/schedules/self 自助选班：departmentId 取自当前用户', async () => {
    const upsertSchedule = vi.fn(async () => ({ id: 1 }));
    const app = buildApp(makeDeps({ shift: { upsertSchedule } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/self',
      payload: { scheduleDate: '2026-09-25', shiftId: 3 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(upsertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, shiftId: 3, scheduleDate: '2026-09-25', departmentId: 2 }),
    );
  });

  it('POST /api/schedules 管理端排班：目标在作用域内 → 201 并通知目标', async () => {
    const upsertSchedule = vi.fn(async () => ({ id: 5 }));
    const notify = vi.fn();
    const app = buildApp(makeDeps({ shift: { upsertSchedule }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules',
      payload: { userId: 3, shiftId: 3, scheduleDate: '2026-09-25' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(upsertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3, shiftId: 3, scheduleDate: '2026-09-25', departmentId: 3 }),
    );
    expect(notify).toHaveBeenCalledWith({ userId: 3 }, 'notification', expect.objectContaining({ title: '排班通知' }));
  });

  it('POST /api/schedules 目标在作用域外(市场部 6) → 403 且不落库不通知', async () => {
    const upsertSchedule = vi.fn(async () => ({ id: 1 }));
    const notify = vi.fn();
    const app = buildApp(makeDeps({ targetDept: 6, shift: { upsertSchedule }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules',
      payload: { userId: 3, shiftId: 3, scheduleDate: '2026-09-25' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(upsertSchedule).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('POST /api/schedules/batch 批量排班成功并通知所有目标', async () => {
    const batchUpsertSchedules = vi.fn(async () => 2);
    const notify = vi.fn();
    const app = buildApp(makeDeps({ shift: { batchUpsertSchedules }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/batch',
      payload: {
        schedules: [
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-25' },
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-26' },
        ],
      },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(batchUpsertSchedules).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1); // 同一用户去重只通知一次
    expect(res.json().data.count).toBe(2);
  });

  it('POST /api/schedules/validate 全部合法 → valid true', async () => {
    const listShifts = vi.fn(async () => [
      { id: 3, name: '早班', startTime: '09:00', endTime: '18:00', workHours: 8, restDuration: 60, lateThreshold: null, earlyThreshold: null, useGlobalThreshold: true, isActive: true, departmentId: null, description: null, color: '#000', departmentName: null },
    ]);
    const app = buildApp(makeDeps({ shift: { listShifts } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/validate',
      payload: {
        schedules: [{ userId: 3, shiftId: 3, scheduleDate: '2026-09-25' }],
      },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.valid).toBe(true);
    expect(res.json().data.issues).toHaveLength(0);
  });

  it('POST /api/schedules/validate 日期非法且一人一天重复 → valid false 并携带 issues', async () => {
    const listShifts = vi.fn(async () => [
      { id: 3, name: '早班', startTime: '09:00', endTime: '18:00', workHours: 8, restDuration: 60, lateThreshold: null, earlyThreshold: null, useGlobalThreshold: true, isActive: true, departmentId: null, description: null, color: '#000', departmentName: null },
    ]);
    const app = buildApp(makeDeps({ shift: { listShifts } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/validate',
      payload: {
        schedules: [
          { userId: 3, shiftId: 3, scheduleDate: '2026-02-30' }, // 非法日期
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-25' },
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-25' }, // 重复
        ],
      },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.valid).toBe(false);
    const fields = (res.json().data.issues as { field: string }[]).map((i) => i.field);
    expect(fields).toContain('scheduleDate');
    expect(fields).toContain('duplicateUserDate');
  });

  it('POST /api/schedules/validate 含作用域外员工 → 403', async () => {
    const app = buildApp(makeDeps({ targetDept: 6 }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/validate',
      payload: { schedules: [{ userId: 3, shiftId: 3, scheduleDate: '2026-09-25' }] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/schedules/copy-template 复制模板', async () => {
    const copyScheduleTemplate = vi.fn(async () => 5);
    const app = buildApp(makeDeps({ shift: { copyScheduleTemplate } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/copy-template',
      payload: { sourceStart: '2026-09-01', sourceEnd: '2026-09-07', targetStart: '2026-10-01' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(copyScheduleTemplate).toHaveBeenCalled();
    expect(res.json().data.count).toBe(5);
  });

  it('POST /api/schedules/smart 智能生成排班', async () => {
    const smartGenerate = vi.fn(async () => 3);
    const app = buildApp(makeDeps({ shift: { smartGenerate } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/smart',
      payload: {
        rows: [
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-25', isRestDay: false },
          { userId: 3, shiftId: 3, scheduleDate: '2026-09-26', isRestDay: false },
          { userId: 3, shiftId: null, scheduleDate: '2026-09-27', isRestDay: true },
        ],
      },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(smartGenerate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ isRestDay: true })]),
    );
    expect(res.json().data.count).toBe(3);
  });

  it('DELETE /api/schedules/:id 不存在 → 404', async () => {
    const deleteSchedule = vi.fn(async () => 'not_found' as const);
    const app = buildApp(makeDeps({ shift: { deleteSchedule } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'DELETE', url: '/api/schedules/99', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/schedules/export 返回排班 xlsx（http 200 + xlsx MIME）', async () => {
    const listSchedules = vi.fn(async () => [
      {
        id: 1,
        scheduleDate: '2026-09-25',
        isRestDay: false,
        userId: 3,
        userName: '员工',
        departmentId: 3,
        departmentName: '前端组',
        shiftId: 3,
        shiftName: '早班',
        startTime: '08:00',
        endTime: '17:00',
        color: '#3B82F6',
      },
    ] as never);
    const app = buildApp(makeDeps({ shift: { listSchedules } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({ method: 'GET', url: '/api/schedules/export', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type'] ?? '').toContain('spreadsheetml.sheet');
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('POST /api/schedules/import 解析 xlsx 并按姓名/班次映射后批量落地 → 201', async () => {
    const batchUpsertSchedules = vi.fn(async () => 1);
    const notify = vi.fn();
    // 作用域内（前端组 dept3）员工 + 通用/本部门班次
    const rbac = {
      listUsers: vi.fn(async () => [
        { id: 3, username: 'emp', realName: '员工', status: 'active', roleIds: [2], departmentId: 3 },
      ] as never),
    };
    const shift = {
      listShifts: vi.fn(async () => [
        { id: 3, name: '早班', startTime: '08:00', endTime: '17:00', workHours: 8, restDuration: 60, lateThreshold: 30, earlyThreshold: 30, useGlobalThreshold: false, isActive: true, departmentId: null, description: null, color: '#3B82F6', departmentName: null },
      ] as never),
      batchUpsertSchedules,
    };
    const app = buildApp(makeDeps({ shift, rbac, notify }));
    await app.ready();
    // 用导出同源 exceljs 构造一个含 员工/2026-09-25/早班 的 xlsx
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('排班表');
    ws.addRow(['员工姓名', '日期', '班次', '开始', '结束', '是否休息']);
    ws.addRow(['员工', '2026-09-25', '早班', '08:00', '17:00', '否']);
    const base64 = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/schedules/import',
      payload: { file: base64 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(batchUpsertSchedules).toHaveBeenCalledWith([expect.objectContaining({ userId: 3, shiftId: 3, scheduleDate: '2026-09-25' })]);
    expect(notify).toHaveBeenCalledWith({ userId: 3 }, 'notification', expect.objectContaining({ title: '排班通知' }));
  });
});