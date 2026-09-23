import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp, type AppDeps, type ReimburseRepo, type DepartmentRepo, type AttendanceRepo, type CategoryRepo } from '../../app';
import type { SessionStore } from '../auth/auth.service';
import type { NotifyFn } from '../notify/socket';
import type { DepartmentNode } from '../leave/department-scope';
import type { ReimburseView } from '@leixi/shared';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

const REIMBURSE_CODES = [
  'dashboard_view',
  'user_view',
  'reimburse_view',
  'reimburse_create',
  'reimburse_approve',
  'reimburse_category_view',
  'reimburse_category_manage',
];

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
    reimburse?: Partial<ReimburseRepo>;
    category?: Partial<CategoryRepo>;
    attendance?: Partial<AttendanceRepo>;
    dept?: Partial<DepartmentRepo>;
    notify?: NotifyFn;
    hash?: string;
  } = {},
): AppDeps {
  const { departmentId = 2, permissions = REIMBURSE_CODES } = opts;
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
      ...opts.reimburse,
    },
    categoryRepo: {
      listCategories: vi.fn(async () => []),
      createCategory: vi.fn(async () => ({ ok: true as const, id: 1 })),
      updateCategory: vi.fn(async () => ({ ok: true as const })),
      deleteCategory: vi.fn(async () => 'ok' as const),
      ...opts.category,
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

describe('报销路由（部门数据隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/reimburses 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/reimburses' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 reimburse_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['dashboard_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/reimburses',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 reimburse_view：listReimburses 收到“本部门+下属部门”scope，跨部门不可见', async () => {
    const listReimburses = vi.fn(async (): Promise<ReimburseView[]> => [
      { id: 1, categoryId: 1, categoryName: '餐饮', reason: '前端组聚餐', amount: 300, status: 'pending', applicantId: 3, departmentId: 3, applicantName: '张三', departmentName: '前端组', createdAt: '2026-09-10T00:00:00.000Z', items: [{ id: 1, reimburseId: 1, categoryId: 1, categoryName: '餐饮', amount: 300, note: null }] },
    ]);
    const app = buildApp(makeDeps({ hash, reimburse: { listReimburses } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/reimburses',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(listReimburses).toHaveBeenCalledWith({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const items = res.json().data.reimburses as ReimburseView[];
    expect(items.every((l) => [2, 3, 4, 5].includes(l.departmentId))).toBe(true);
  });

  it('无部门用户 → scope 为 all（系统级）', async () => {
    const listReimburses = vi.fn(async () => []);
    const app = buildApp(makeDeps({ hash, departmentId: null, reimburse: { listReimburses } }));
    await app.ready();
    const token = await login(app);
    await app.inject({
      method: 'GET',
      url: '/api/reimburses',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listReimburses).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('无 reimburse_create 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['reimburse_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburses',
      payload: { reason: '出差打车', items: [{ categoryId: 2, amount: 128.5 }] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 reimburse_create：createReimburse 强制写入当前用户 departmentId（不信任前端）', async () => {
    const createReimburse = vi.fn(async () => ({ id: 9 }));
    const app = buildApp(makeDeps({ hash, reimburse: { createReimburse } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburses',
      payload: { reason: '采购键盘', items: [{ categoryId: 3, amount: 699 }] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createReimburse).toHaveBeenCalledWith(
      expect.objectContaining({ applicantId: 1, departmentId: 2, items: [{ categoryId: 3, amount: 699 }] }),
    );
  });

  it('无部门用户 POST 返回 409', async () => {
    const app = buildApp(makeDeps({ hash, departmentId: null }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburses',
      payload: { reason: 'x', items: [{ categoryId: 2, amount: 10 }] },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('无 reimburse_approve 时 PUT 审批返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['reimburse_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburses/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 reimburse_approve：可审批作用域内报销单 → setStatus approved + 通知申请人', async () => {
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn();
    const getReimburseById = vi.fn(async (): Promise<ReimburseView> => ({
      id: 5,
      categoryId: 1,
      categoryName: '餐饮',
      reason: 'x',
      amount: 200,
      status: 'pending',
      applicantId: 3,
      departmentId: 5,
      applicantName: '张三',
      departmentName: '平台组',
      createdAt: '2026-09-11T00:00:00.000Z',
      items: [{ id: 5, reimburseId: 5, categoryId: 1, categoryName: '餐饮', amount: 200, note: null }],
    }));
    const app = buildApp(makeDeps({ hash, reimburse: { setStatus, getReimburseById }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburses/5/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(5, 'approved');
    expect(notify).toHaveBeenCalledWith(
      { userId: 3 },
      'notification',
      expect.objectContaining({ message: '你的报销单已被批准' }),
    );
  });

  it('驳回后通过统一 notify 定向通知申请人', async () => {
    const setStatus = vi.fn(async () => {});
    const notify = vi.fn();
    const getReimburseById = vi.fn(async (): Promise<ReimburseView> => ({
      id: 7,
      categoryId: 2,
      categoryName: '交通',
      reason: 'x',
      amount: 50,
      status: 'pending',
      applicantId: 4,
      departmentId: 5,
      applicantName: '王五',
      departmentName: '平台组',
      createdAt: '2026-09-12T00:00:00.000Z',
      items: [{ id: 7, reimburseId: 7, categoryId: 2, categoryName: '交通', amount: 50, note: null }],
    }));
    const app = buildApp(makeDeps({ hash, reimburse: { setStatus, getReimburseById }, notify }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburses/7/status',
      payload: { status: 'rejected' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(setStatus).toHaveBeenCalledWith(7, 'rejected');
    expect(notify).toHaveBeenCalledWith(
      { userId: 4 },
      'notification',
      expect.objectContaining({ message: '你的报销单已被驳回' }),
    );
  });

  it('跨部门(市场部 6)报销单不可审批 → 403', async () => {
    const setStatus = vi.fn(async () => {});
    const getReimburseById = vi.fn(async (): Promise<ReimburseView> => ({
      id: 6,
      categoryId: 3,
      categoryName: '办公',
      reason: 'x',
      amount: 100,
      status: 'pending',
      applicantId: 9,
      departmentId: 6,
      applicantName: '李四',
      departmentName: '市场部',
      createdAt: '2026-09-13T00:00:00.000Z',
      items: [{ id: 6, reimburseId: 6, categoryId: 3, categoryName: '办公', amount: 100, note: null }],
    }));
    const app = buildApp(makeDeps({ hash, reimburse: { setStatus, getReimburseById } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburses/6/status',
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(setStatus).not.toHaveBeenCalled();
  });
});

describe('报销类别路由（系统级配置，无部门隔离）', () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash('x', 4);
  });

  it('未登录 GET /api/reimburse-categories 返回 401', async () => {
    const app = buildApp(makeDeps({ hash }));
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/reimburse-categories' });
    expect(res.statusCode).toBe(401);
  });

  it('登录但无 reimburse_category_view 时 GET 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['reimburse_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/reimburse-categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('有 reimburse_category_view：listCategories 返回全部', async () => {
    const listCategories = vi.fn(async () => [
      { id: 1, name: '餐饮', isActive: true, description: '工作餐' },
      { id: 2, name: '交通', isActive: true, description: null },
    ]);
    const app = buildApp(makeDeps({ hash, category: { listCategories } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/reimburse-categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const cats = res.json().data.categories;
    expect(cats).toHaveLength(2);
    expect(cats[0]?.name).toBe('餐饮');
  });

  it('无 reimburse_category_manage 时 POST 返回 403', async () => {
    const app = buildApp(makeDeps({ hash, permissions: ['reimburse_category_view'] }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburse-categories',
      payload: { name: '采购' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST 创建成功：createCategory 传 name/description，201 返回 id', async () => {
    const createCategory = vi.fn(async () => ({ ok: true as const, id: 9 }));
    const app = buildApp(makeDeps({ hash, category: { createCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburse-categories',
      payload: { name: '出差', description: '差旅相关', isActive: true },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(createCategory).toHaveBeenCalledWith({ name: '出差', description: '差旅相关', isActive: true });
    expect(res.json().data.id).toBe(9);
  });

  it('POST 重复名称 → 409', async () => {
    const createCategory = vi.fn(async () => ({ ok: false as const, reason: 'dup' as const }));
    const app = buildApp(makeDeps({ hash, category: { createCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/reimburse-categories',
      payload: { name: '餐饮' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('PUT 更新：updateCategory 传 id + 变更字段', async () => {
    const updateCategory = vi.fn(async () => ({ ok: true as const }));
    const app = buildApp(makeDeps({ hash, category: { updateCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburse-categories/2',
      payload: { isActive: false, description: '停用' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(updateCategory).toHaveBeenCalledWith(2, { isActive: false, description: '停用' });
  });

  it('PUT 不存在 → 404', async () => {
    const updateCategory = vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const }));
    const app = buildApp(makeDeps({ hash, category: { updateCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/reimburse-categories/999',
      payload: { name: 'x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE 被引用类别 → 409', async () => {
    const deleteCategory = vi.fn(async () => 'in_use' as const);
    const app = buildApp(makeDeps({ hash, category: { deleteCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/reimburse-categories/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('DELETE 成功 → 200', async () => {
    const deleteCategory = vi.fn(async () => 'ok' as const);
    const app = buildApp(makeDeps({ hash, category: { deleteCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/reimburse-categories/3',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('DELETE 不存在 → 404', async () => {
    const deleteCategory = vi.fn(async () => 'not_found' as const);
    const app = buildApp(makeDeps({ hash, category: { deleteCategory } }));
    await app.ready();
    const token = await login(app);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/reimburse-categories/888',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});