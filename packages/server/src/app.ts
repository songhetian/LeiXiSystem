import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import jwt from '@fastify/jwt';
import { Type } from '@sinclair/typebox';
import {
  okay,
  fail,
  type PermissionPoint,
  type RoleWithPermissions,
  type UserWithRoles,
  type LeaveView,
  type ReimburseView,
  type ReimburseCategoryView,
  type ReimburseItemInput,
  type AttendanceView,
  type AttendanceExceptionView,
  type SalaryView,
  type WorkShiftView,
  type ScheduleView,
  type OvertimeView,
  type OvertimeStats,
  type MakeupView,
  type AttSettingView,
  type HolidayView,
  type LeaveTypeView,
  type LeaveQuotaView,
  type LeaveTrendPoint,
  type ScheduleTemplateView,
} from '@leixi/shared';
import { createAuthService, type SessionStore, type AuthConfig } from './modules/auth/auth.service';
import type { RolePermissionLoader } from './modules/auth/permission.service';
import { buildAttendanceStats } from './modules/attendance/attendance-stats.pure';
import { buildScheduleStats } from './modules/shift/schedule-stats.pure';
import { validateScheduleRows, type ScheduleValidationRow } from './modules/shift/schedule-validation.pure';
import { buildDashboardStats } from './modules/dashboard/dashboard-stats.pure';
import { toCsv, buildWorkbookBuffer, type ReportColumn } from './modules/report/report-export.pure';
import { detectDayExceptions, type ExceptionCandidate } from './modules/attendance/exception-detect.pure';
import { buildScope, scopeIncludes, type DepartmentNode, type DepartmentScope } from './modules/leave/department-scope';
import type { NotifyFn } from './modules/notify/socket';

export const HEALTH_SCHEMA = {
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Union([Type.Object({ status: Type.Literal('ok') }), Type.Null()]),
      message: Type.String(),
    }),
  },
};

/** 用户仓库抽象：隔离 Prisma，便于路由测试注入内存 mock */
export interface UserRepo {
  findByUsername(username: string): Promise<UserProjection | null>;
  findById(id: number): Promise<UserProjection | null>;
}

/** User 投影：路由层所需的最小用户字段集（与 DB schema 对齐） */
export interface UserProjection {
  id: number;
  username: string;
  password: string;
  realName: string;
  status: string;
  departmentId: number | null;
  roleIds: number[];
}

/** RBAC 数据访问抽象：角色权限查询与赋值（隔离 Prisma） */
export interface RbacRepo {
  listRoles(): Promise<RoleWithPermissions[]>;
  listPermissions(): Promise<PermissionPoint[]>;
  setRolePermissions(roleId: number, permissionIds: number[]): Promise<void>;
  listUsers(): Promise<UserWithRoles[]>;
  setUserRoles(userId: number, roleIds: number[]): Promise<void>;
  createUser(data: {
    username: string;
    password: string;
    realName: string;
    roleIds: number[];
  }): Promise<{ id: number }>;
  updateUser(
    id: number,
    data: { realName?: string; status?: string; password?: string; roleIds?: number[] },
  ): Promise<void>;
  deleteUser(id: number): Promise<void>;
}

/** 部门：CRUD 行视图 */
export interface DepartmentRow {
  id: number;
  name: string;
  parentId: number | null;
}

/** 部门数据访问：scope 解析（listTree）+ 部门管理 CRUD */
export interface DepartmentRepo {
  listTree(): Promise<DepartmentNode[]>;
  listDepartments(): Promise<DepartmentRow[]>;
  createDepartment(data: { name: string; parentId: number | null }): Promise<{ id: number }>;
  updateDepartment(id: number, data: { name?: string; parentId?: number | null }): Promise<void>;
  /** 删除部门：返回结果码，由路由层映射为 409/404 */
  deleteDepartment(
    id: number,
  ): Promise<'ok' | 'has_children' | 'has_leaves' | 'has_users' | 'not_found'>;
}

/** 请假数据访问：所有查询必须基于注入的 scope 过滤（部门隔离的防线）。 */
export interface LeaveRepo {
  listLeaves(scope: DepartmentScope): Promise<LeaveView[]>;
  createLeave(data: {
    type: string;
    reason: string;
    startAt: string;
    endAt: string;
    applicantId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
  getLeaveById(id: number): Promise<LeaveView | null>;
  setStatus(id: number, status: string): Promise<void>;
}

/** 报销数据访问：同请假——所有查询基于注入的 scope 过滤（部门隔离的防线）。 */
export interface ReimburseRepo {
  listReimburses(scope: DepartmentScope): Promise<ReimburseView[]>;
  createReimburse(data: {
    reason: string;
    items: ReimburseItemInput[];
    applicantId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
  getReimburseById(id: number): Promise<ReimburseView | null>;
  setStatus(id: number, status: string): Promise<void>;
}

/** 报销类别数据访问：系统级配置，无部门隔离。名称唯一，删除受分项引用保护。 */
export interface CategoryRepo {
  listCategories(): Promise<ReimburseCategoryView[]>;
  createCategory(data: { name: string; isActive?: boolean; description?: string | null }): Promise<
    { ok: true; id: number } | { ok: false; reason: 'dup' }
  >;
  updateCategory(
    id: number,
    data: Partial<{ name: string; isActive: boolean; description: string | null }>,
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }>;
  deleteCategory(id: number): Promise<'ok' | 'not_found' | 'in_use'>;
}

/** 考勤数据访问：无审批流，仅打卡记录；所有查询基于注入的 scope 过滤（部门隔离）。 */
export interface AttendanceRepo {
  listAttendances(scope: DepartmentScope): Promise<AttendanceView[]>;
  createAttendance(data: {
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    note?: string;
    userId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
}

/** 加班申请：审批流（pending/approved/rejected）+ 部门数据隔离 */
export interface OvertimeRepo {
  listOvertimes(scope: DepartmentScope): Promise<OvertimeView[]>;
  createOvertime(data: {
    date: string;
    startTime: string;
    endTime: string;
    hours: number;
    reason: string;
    applicantId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
  getOvertimeById(id: number): Promise<OvertimeView | null>;
  setStatus(id: number, status: string): Promise<void>;
  getStats(scope: DepartmentScope, month: string): Promise<OvertimeStats>;
}

/** 补卡申请：审批流（pending/approved/rejected）+ 部门数据隔离 */
export interface MakeupRepo {
  listMakeups(scope: DepartmentScope): Promise<MakeupView[]>;
  createMakeup(data: {
    recordDate: string;
    clockType: string;
    clockTime: string;
    reason: string;
    applicantId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
  getMakeupById(id: number): Promise<MakeupView | null>;
  setStatus(id: number, status: string): Promise<void>;
}

/** 薪资数据访问：无审批流，管理端按月为员工录入；所有查询基于注入的 scope 过滤（部门隔离）。 */
export interface SalaryRepo {
  listSalaries(scope: DepartmentScope): Promise<SalaryView[]>;
  createSalary(data: {
    month: string;
    basic: number;
    bonus: number;
    deduction: number;
    net: number;
    userId: number;
    departmentId: number;
  }): Promise<{ id: number }>;
}

/** 请假类型数据访问：系统级配置 CRUD，无部门隔离 */
export interface LeaveTypeRepo {
  listLeaveTypes(): Promise<LeaveTypeView[]>;
  createLeaveType(data: { name: string; unit: string; allowance: number; description?: string | null }): Promise<
    { ok: true; id: number } | { ok: false; reason: 'dup' }
  >;
  updateLeaveType(
    id: number,
    data: { name?: string; unit?: string; allowance?: number; isActive?: boolean; description?: string | null },
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }>;
  deleteLeaveType(id: number): Promise<'ok' | 'not_found' | 'in_use'>;
}

/**
 * 年度请假额度数据访问：user 维度部门隔离由路由层先解析可用 userIds 再传入。
 * 趋势按月聚合已审请假量（leaveRepo 数据 + 纯函数）。
 */
export interface QuotaRepo {
  listQuotas(year: number, userIds: number[]): Promise<LeaveQuotaView[]>;
  upsertQuota(data: {
    userId: number;
    year: number;
    leaveTypeId: number;
    allowance: number;
    used: number;
  }): Promise<{ ok: true } | { ok: false; reason: 'bad_user' | 'bad_type' }>;
  batchUpsertQuotas(rows: {
    userId: number;
    year: number;
    leaveTypeId: number;
    allowance: number;
  }[]): Promise<number>;
  getTrend(year: number, userIds: number[]): Promise<LeaveTrendPoint[]>;
}

/** 排班结果参与方：排班变更时用于通知被排班用户 */
export interface ScheduleActor {
  userId: number;
  departmentId: number | null;
  userName: string;
}

/** 考勤设置数据访问：系统级单例配置（id 恒为 1），无部门隔离/审批流 */
export interface AttSettingRepo {
  getSetting(): Promise<AttSettingView>;
  /** 全量覆盖单例配置；返回更新后的视图 */
  updateSetting(data: AttSettingView): Promise<AttSettingView>;
}

/** 节假日数据访问：具体日期独立建模，按年管理；系统级配置，无部门隔离 */
export interface HolidayRepo {
  listHolidays(year?: number): Promise<HolidayView[]>;
  createHoliday(data: {
    year: number;
    date: string;
    name: string;
    type: string;
  }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }>;
  updateHoliday(
    id: number,
    data: { year?: number; date?: string; name?: string; type?: string },
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }>;
  deleteHoliday(id: number): Promise<'ok' | 'not_found'>;
}

/** 考勤异常数据访问：扫描落库(upsert) + 列表(scope 隔离) + 人工确认/驳回 */
export interface ExceptionRepo {
  listExceptions(
    scope: DepartmentScope,
    filters?: { status?: string; type?: string },
  ): Promise<AttendanceExceptionView[]>;
  scanUpsert(
    candidates: ExceptionCandidate[],
  ): Promise<{ created: number; updated: number }>;
  setStatus(
    scope: DepartmentScope,
    id: number,
    status: 'confirmed' | 'dismissed',
    remark?: string | null,
  ): Promise<'ok' | 'not_found' | 'out_of_scope'>;
}

/** 排班（班次/排班管理）数据访问：班次为可复用模板；排班按用户部门做数据隔离。 */
export interface ShiftRepo {
  listShifts(scope: DepartmentScope): Promise<WorkShiftView[]>;
  createShift(data: {
    name: string;
    startTime: string;
    endTime: string;
    restDuration?: number;
    lateThreshold?: number | null;
    earlyThreshold?: number | null;
    useGlobalThreshold?: boolean;
    departmentId?: number | null;
    description?: string | null;
    color?: string;
  }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }>;
  updateShift(
    id: number,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      restDuration?: number;
      lateThreshold?: number | null;
      earlyThreshold?: number | null;
      useGlobalThreshold?: boolean;
      isActive?: boolean;
      departmentId?: number | null;
      description?: string | null;
      color?: string;
    },
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }>;
  deleteShift(id: number): Promise<'ok' | 'not_found' | 'in_use'>;
  toggleShift(id: number): Promise<'ok' | 'not_found'>;
  getRestShift(): Promise<{ id: number; name: string }>;
  listSchedules(
    scope: DepartmentScope,
    filters?: { startDate?: string; endDate?: string; userId?: number },
  ): Promise<ScheduleView[]>;
  listSchedulesByUser(
    userId: number,
    filters?: { startDate?: string; endDate?: string },
  ): Promise<ScheduleView[]>;
  upsertSchedule(row: {
    userId: number;
    shiftId: number | null;
    scheduleDate: string;
    isRestDay: boolean;
    departmentId: number;
  }): Promise<{ id: number }>;
  batchUpsertSchedules(rows: {
    userId: number;
    shiftId: number | null;
    scheduleDate: string;
    isRestDay: boolean;
    departmentId: number;
  }[]): Promise<number>;
  copyScheduleTemplate(
    sourceStart: string,
    sourceEnd: string,
    targetStart: string,
    userIds?: number[],
  ): Promise<number>;
  smartGenerate(rows: {
    userId: number;
    shiftId: number | null;
    scheduleDate: string;
    isRestDay: boolean;
    departmentId: number;
  }[]): Promise<number>;
  deleteSchedule(id: number): Promise<'ok' | 'not_found'>;
  /** 请假自动置休：把某员工在 [startDate,endDate] 区间内每天的排班置为休息（无排班则创建休息记录） */
  setRangeRest(data: {
    userId: number;
    departmentId: number | null;
    startDate: string;
    endDate: string;
  }): Promise<number>;
  listTemplates(): Promise<ScheduleTemplateView[]>;
  createTemplate(data: {
    name: string;
    description?: string | null;
  }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }>;
  updateTemplate(
    id: number,
    data: { name?: string; description?: string | null },
  ): Promise<'ok' | 'not_found' | 'dup'>;
  deleteTemplate(id: number): Promise<'ok' | 'not_found'>;
  setTemplateItems(
    templateId: number,
    items: { userId: number; weekday: number; shiftId: number | null; isRestDay?: boolean }[],
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' }>;
  applyTemplate(
    templateId: number,
    targetStart: string,
  ): Promise<{ ok: true; count: number } | { ok: false; reason: 'not_found' }>;
}

/** 应用依赖注入：所有外部副作用（JWT密钥/Redis会话/DB查询）在此接线 */
export interface AppDeps {
  jwtSecret: string;
  sessionStore: SessionStore;
  userRepo: UserRepo;
  permissionLoader: RolePermissionLoader;
  rbacRepo: RbacRepo;
  departmentRepo: DepartmentRepo;
  leaveRepo: LeaveRepo;
  reimburseRepo: ReimburseRepo;
  categoryRepo: CategoryRepo;
  attendanceRepo: AttendanceRepo;
  overtimeRepo: OvertimeRepo;
  makeupRepo: MakeupRepo;
  salaryRepo: SalaryRepo;
  shiftRepo: ShiftRepo;
  attSettingRepo: AttSettingRepo;
  holidayRepo: HolidayRepo;
  exceptionRepo: ExceptionRepo;
  leaveTypeRepo: LeaveTypeRepo;
  quotaRepo: QuotaRepo;
  authConfig?: Partial<AuthConfig>;
  /** socket 统一通知：业务模块可定向发给用户/部门/角色；未接入时可选 */
  notify?: NotifyFn;
}

const Env = {
  user: Type.Object({ id: Type.Number(), username: Type.String(), realName: Type.String() }),
};

/** GET /api/auth/me 响应主体：用户投影 + 权限码列表 */
const MeUser = Type.Object({
  id: Type.Number(),
  username: Type.String(),
  realName: Type.String(),
  permissions: Type.Array(Type.String()),
});

export const LOGIN_SCHEMA = {
  body: Type.Object({ username: Type.String(), password: Type.String() }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Object({
        accessToken: Type.String(),
        refreshToken: Type.String(),
        user: Env.user,
      }),
    }),
    401: Type.Object({ success: Type.Boolean(), data: Type.Null(), message: Type.String() }),
  },
};

export const ME_SCHEMA = {
  response: {
    200: Type.Object({ success: Type.Boolean(), data: Type.Union([MeUser, Type.Null()]) }),
    401: Type.Object({ success: Type.Boolean(), data: Type.Null(), message: Type.String() }),
  },
};

export const REFRESH_SCHEMA = {
  body: Type.Object({ refreshToken: Type.String() }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Object({
        accessToken: Type.String(),
        refreshToken: Type.String(),
        user: Env.user,
      }),
    }),
    401: Type.Object({ success: Type.Boolean(), data: Type.Null(), message: Type.String() }),
  },
};

/**
 * 构建应用实例（不含监听），供启动与测试注入复用。
 */
export function buildApp(deps: AppDeps): FastifyInstance {
  // eslint-disable-next-line dot-notation
  const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();

  const { jwtSecret, sessionStore, userRepo, permissionLoader, rbacRepo, departmentRepo, leaveRepo, reimburseRepo, categoryRepo, attendanceRepo, overtimeRepo, makeupRepo, salaryRepo, shiftRepo, attSettingRepo, holidayRepo, exceptionRepo, leaveTypeRepo, quotaRepo, notify } =
    deps;
  const authConfig: AuthConfig = {
    jwtSecret,
    accessTtl: '15m',
    refreshTtl: '30d',
    ...deps.authConfig,
  };
  const auth = createAuthService(sessionStore, authConfig);

  /**
   * 鉴权 + 权限点校验：通过返回 UserProjection（含 departmentId）；否则已发送 401/403 并返回 undefined。
   * 返回值供业务路由复用当前用户（如解析部门隔离 scope / 强制归属部门）。
   */
  async function requirePermission(
    req: FastifyRequest,
    reply: FastifyReply,
    code: string,
  ): Promise<UserProjection | undefined> {
    try {
      await req.jwtVerify();
    } catch {
      await reply.status(401).send(fail('未授权'));
      return undefined;
    }
    const userId = await auth.verifyAccessSession(req.user as { sub: string; sid: string; typ: string });
    if (userId === null) {
      // 该账号已在其他设备登录（被踢）/ 会话轮换，access token 立即失效
      await reply.status(401).send(fail('登录已失效，请重新登录'));
      return undefined;
    }
    const user = await userRepo.findById(userId);
    if (!user) {
      await reply.status(401).send(fail('用户不存在'));
      return undefined;
    }
    const permissions = await permissionLoader.loadPermissionCodes(user.roleIds);
    if (!permissions.includes(code)) {
      await reply.status(403).send(fail('无权限执行该操作'));
      return undefined;
    }
    return user;
  }

  void app.register(jwt, { secret: jwtSecret });

  app.get('/api/health', { schema: HEALTH_SCHEMA }, async () => okay({ status: 'ok' }));

  app.post('/api/auth/login', { schema: LOGIN_SCHEMA }, async (req, reply) => {
    const { username, password } = req.body;
    const user = await userRepo.findByUsername(username);
    if (!user || user.status !== 'active') {
      return reply.status(401).send(fail('用户名或密码错误'));
    }
    const ok = await auth.verifyPassword(password, user.password);
    if (!ok) return reply.status(401).send(fail('用户名或密码错误'));

    const { accessToken, refreshToken } = auth.issueTokens(user.id);
    return okay({
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, realName: user.realName },
    });
  });

  app.get('/api/auth/me', { schema: ME_SCHEMA }, async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send(fail('未授权'));
    }
    const userId = await auth.verifyAccessSession(req.user as { sub: string; sid: string; typ: string });
    if (userId === null) return reply.status(401).send(fail('登录已失效，请重新登录'));
    const user = await userRepo.findById(userId);
    if (!user) return reply.status(401).send(fail('用户不存在'));
    const permissions = await permissionLoader.loadPermissionCodes(user.roleIds);
    return okay({ id: user.id, username: user.username, realName: user.realName, permissions });
  });

  // 登出：终止底层会话（删除单设备 TTL 记录）
  app.post('/api/auth/logout', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send(fail('未授权'));
    }
    const { sub } = req.user as { sub: string };
    await auth.logout(Number(sub));
    return okay(null);
  });

  // 刷新令牌：用 refreshToken 换取新令牌对（旋转 sid 保持单设备）。refreshToken 失效/被课/伪造 → 401
  app.post('/api/auth/refresh', { schema: REFRESH_SCHEMA }, async (req, reply) => {
    const { refreshToken } = req.body;
    const userId = await auth.verifyRefreshToken(refreshToken);
    if (userId === null) {
      return reply.status(401).send(fail('登录已过期，请重新登录'));
    }
    const user = await userRepo.findById(userId);
    if (!user || user.status !== 'active') {
      return reply.status(401).send(fail('用户不存在或已禁用'));
    }
    const { accessToken, refreshToken: newRefresh } = auth.issueTokens(user.id);
    return okay({
      accessToken,
      refreshToken: newRefresh,
      user: { id: user.id, username: user.username, realName: user.realName },
    });
  });

  // RBAC：角色权限总览（需 role_view）。返回角色+全部权限点，供前端一次性渲染。
  app.get(
    '/api/roles',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'role_view'))) return;
      const [roles, permissions] = await Promise.all([rbacRepo.listRoles(), rbacRepo.listPermissions()]);
      return okay({ roles, permissions });
    },
  );

  // RBAC：更新角色权限（需 role_update），全量替换其权限点。
  app.put(
    '/api/roles/:id/permissions',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ permissionIds: Type.Array(Type.Number()) }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'role_update'))) return;
      const { permissionIds } = req.body;
      const roleId = (req.params as { id: number }).id;
      await rbacRepo.setRolePermissions(roleId, permissionIds);
      return okay(null);
    },
  );

  // RBAC：用户列表（含角色 id，需 user_view）
  app.get(
    '/api/users',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'user_view'))) return;
      const users = await rbacRepo.listUsers();
      return okay({ users });
    },
  );

  // RBAC：更新用户角色（需 role_assign），全量替换其角色。
  app.put(
    '/api/users/:id/roles',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ roleIds: Type.Array(Type.Number()) }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'role_assign'))) return;
      const { roleIds } = req.body;
      const userId = (req.params as { id: number }).id;
      await rbacRepo.setUserRoles(userId, roleIds);
      return okay(null);
    },
  );

  // 新建用户（需 user_create）：密码用 bcrypt 哈希后落库，可同时绑定角色。
  app.post(
    '/api/users',
    {
      schema: {
        body: Type.Object({
          username: Type.String({ minLength: 2, maxLength: 32 }),
          password: Type.String({ minLength: 6 }),
          realName: Type.String({ minLength: 1 }),
          roleIds: Type.Array(Type.Number()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'user_create'))) return;
      const { username, password, realName, roleIds } = req.body;
      try {
        const hash = await auth.hashPassword(password);
        const { id } = await rbacRepo.createUser({ username, password: hash, realName, roleIds });
        return reply.status(201).send(okay({ id }));
      } catch (err) {
        void err;
        return reply.status(409).send(fail('用户名已存在'));
      }
    },
  );

  // 编辑用户（需 user_update）：可改姓名/状态/角色；password 为空串表示不改。
  app.put(
    '/api/users/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          realName: Type.String({ minLength: 1 }),
          status: Type.String(),
          roleIds: Type.Array(Type.Number()),
          password: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'user_update'))) return;
      const { id } = req.params as { id: number };
      const { realName, status, roleIds, password } = req.body;
      const data: { realName?: string; status?: string; password?: string; roleIds?: number[] } = {
        realName,
        status,
        roleIds,
      };
      if (password && password.length >= 6) data.password = await auth.hashPassword(password);
      await rbacRepo.updateUser(id, data);
      return okay(null);
    },
  );

  // 删除用户（需 user_delete）
  app.delete(
    '/api/users/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'user_delete'))) return;
      const { id } = req.params as { id: number };
      await rbacRepo.deleteUser(id);
      return okay(null);
    },
  );

  // 重置密码（需 user_update）：为新密码 bcrypt 哈希后落库。
  app.put(
    '/api/users/:id/password',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ newPassword: Type.String({ minLength: 6 }) }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'user_update'))) return;
      const { id } = req.params as { id: number };
      const hash = await auth.hashPassword(req.body.newPassword);
      await rbacRepo.updateUser(id, { password: hash });
      return okay(null);
    },
  );

  // 请假列表（需 leave_view）：按当前用户部门可见作用域（本部门+下属部门）过滤。
  app.get(
    '/api/leaves',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'leave_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const leaves = await leaveRepo.listLeaves(scope);
      return okay({ leaves });
    },
  );

  // 发起请假（需 leave_create）：departmentId 强制取自当前用户（不信任前端），归属其所属部门。
  app.post(
    '/api/leaves',
    {
      schema: {
        body: Type.Object({
          type: Type.String({ minLength: 1 }),
          reason: Type.String({ minLength: 1 }),
          startAt: Type.String(),
          endAt: Type.String(),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'leave_create');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法发起请假'));
      }
      const { type, reason, startAt, endAt } = req.body;
      const { id } = await leaveRepo.createLeave({
        type,
        reason,
        startAt,
        endAt,
        applicantId: user.id,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 审批请假（需 leave_approve）：只能审批「本部门+下属部门」范围内的请假单（隔离护栏）。
  app.put(
    '/api/leaves/:id/status',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ status: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]) }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'leave_approve');
      if (!user) return;
      const leaveId = (req.params as { id: number }).id;
      const leave = await leaveRepo.getLeaveById(leaveId);
      if (!leave) return reply.status(404).send(fail('请假单不存在'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      if (!scopeIncludes(scope, leave.departmentId)) {
        return reply.status(403).send(fail('无权审批该部门的请假单'));
      }
      await leaveRepo.setStatus(leaveId, req.body.status);
      // 请假自动置休：审批通过后把申请人请假日期区间统一置为休息（无排班则创建休息记录）
      if (req.body.status === 'approved') {
        await shiftRepo.setRangeRest({
          userId: leave.applicantId,
          departmentId: leave.departmentId,
          startDate: leave.startAt.slice(0, 10),
          endDate: leave.endAt.slice(0, 10),
        });
      }
      // 审批结果实时通知申请人：统一 notify 定向到申请人 userId 房间
      notify?.({ userId: leave.applicantId }, 'notification', {
        kind: req.body.status === 'approved' ? 'success' : 'warning',
        title: '审批通知',
        message:
          req.body.status === 'approved' ? '你的请假单已被批准' : '你的请假单已被驳回',
      });
      return okay(null);
    },
  );

  // 报销列表（需 reimburse_view）：按当前用户部门可见作用域（本部门+下属部门）过滤。
  app.get(
    '/api/reimburses',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const reimburses = await reimburseRepo.listReimburses(scope);
      return okay({ reimburses });
    },
  );

  // 发起报销（需 reimburse_create）：departmentId 强制取自当前用户（不信任前端）。
  // 分项 items 一次性提交，总额与主类别由服务端计算——不信任前端金额。
  app.post(
    '/api/reimburses',
    {
      schema: {
        body: Type.Object({
          reason: Type.String({ minLength: 1 }),
          items: Type.Array(
            Type.Object({
              categoryId: Type.Number(),
              amount: Type.Number({ exclusiveMinimum: 0 }),
              note: Type.Optional(Type.String()),
            }),
            { minItems: 1 },
          ),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_create');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法发起报销'));
      }
      const { reason, items } = req.body;
      const { id } = await reimburseRepo.createReimburse({
        reason,
        items,
        applicantId: user.id,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 报销类别列表（需 reimburse_category_view）：系统级配置，无部门隔离
  app.get(
    '/api/reimburse-categories',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_category_view');
      if (!user) return;
      const categories = await categoryRepo.listCategories();
      return okay({ categories });
    },
  );

  // 新增报销类别（需 reimburse_category_manage）
  app.post(
    '/api/reimburse-categories',
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          isActive: Type.Optional(Type.Boolean()),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_category_manage');
      if (!user) return;
      const r = await categoryRepo.createCategory(req.body);
      if (!r.ok) return reply.status(409).send(fail('类别名称已存在'));
      return reply.status(201).send(okay({ id: r.id }));
    },
  );

  // 更新报销类别（需 reimburse_category_manage）
  app.put(
    '/api/reimburse-categories/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          isActive: Type.Optional(Type.Boolean()),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_category_manage');
      if (!user) return;
      const id = (req.params as { id: number }).id;
      const r = await categoryRepo.updateCategory(id, req.body);
      if (!r.ok) {
        return reply.status(r.reason === 'not_found' ? 404 : 409).send(fail(r.reason === 'not_found' ? '类别不存在' : '类别名称已存在'));
      }
      return okay(null);
    },
  );

  // 删除报销类别（需 reimburse_category_manage）：被分项引用 → 409
  app.delete(
    '/api/reimburse-categories/:id',
    {
      schema: { params: Type.Object({ id: Type.Number() }) },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_category_manage');
      if (!user) return;
      const id = (req.params as { id: number }).id;
      const r = await categoryRepo.deleteCategory(id);
      if (r === 'not_found') return reply.status(404).send(fail('类别不存在'));
      if (r === 'in_use') return reply.status(409).send(fail('该类别已被报销引用，无法删除'));
      return okay(null);
    },
  );

  // 审批报销（需 reimburse_approve）：只能审批「本部门+下属部门」范围的报销单（隔离护栏）。
  app.put(
    '/api/reimburses/:id/status',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ status: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]) }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'reimburse_approve');
      if (!user) return;
      const reimburseId = (req.params as { id: number }).id;
      const reimburse = await reimburseRepo.getReimburseById(reimburseId);
      if (!reimburse) return reply.status(404).send(fail('报销单不存在'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      if (!scopeIncludes(scope, reimburse.departmentId)) {
        return reply.status(403).send(fail('无权审批该部门的报销单'));
      }
      await reimburseRepo.setStatus(reimburseId, req.body.status);
      notify?.({ userId: reimburse.applicantId }, 'notification', {
        kind: req.body.status === 'approved' ? 'success' : 'warning',
        title: '审批通知',
        message:
          req.body.status === 'approved' ? '你的报销单已被批准' : '你的报销单已被驳回',
      });
      return okay(null);
    },
  );

  // 考勤列表（需 attendance_view）：按当前用户部门可见作用域（本部门+下属部门）过滤。
  app.get(
    '/api/attendance',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'attendance_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const attendance = await attendanceRepo.listAttendances(scope);
      return okay({ attendance });
    },
  );

  // 考勤统计报表（需 attendance_view）：按当前用户 scope 拉取记录，聚合成员工×月份行级统计。
  app.get(
    '/api/attendance/stats',
    {
      schema: {
        querystring: Type.Object({ month: Type.String({ minLength: 1 }) }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'attendance_view');
      if (!user) return;
      const { month } = req.query;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const rows = await attendanceRepo.listAttendances(scope);
      const stats = buildAttendanceStats(rows, { month });
      return okay({ stats });
    },
  );

  // 工作台仪表盘聚合：dashboard_view 总开关 + 各模块 view 权限条件收敛 + 部门 scope 隔离。
  app.get(
    '/api/dashboard/stats',
    {
      schema: {
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'dashboard_view');
      if (!user) return;
      const codes = await permissionLoader.loadPermissionCodes(user.roleIds);
      const can = (c: string) => codes.includes(c);
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);

      // 模块无对应 view 权限时，其数据不取（undefined），对应指标聚合为 0 —— 收敛闭环。
      const leaves = can('leave_view') ? await leaveRepo.listLeaves(scope) : undefined;
      const overtimeStats = can('overtime_view') ? await overtimeRepo.getStats(scope, month) : undefined;
      const makeups = can('makeup_view') ? await makeupRepo.listMakeups(scope) : undefined;
      const reimburses = can('reimburse_view') ? await reimburseRepo.listReimburses(scope) : undefined;
      const attendances = can('attendance_view') ? await attendanceRepo.listAttendances(scope) : undefined;
      const exceptions = can('att_exception_view') ? await exceptionRepo.listExceptions(scope) : undefined;
      const departments =
        can('dept_view')
          ? (await departmentRepo.listDepartments()).filter((d) => scope.kind === 'all' || scope.departmentIds.includes(d.id)).length
          : undefined;
      const employees =
        can('user_view')
          ? (await rbacRepo.listUsers()).filter((u) => scope.kind === 'all' || (u.departmentId != null && scope.departmentIds.includes(u.departmentId))).length
          : undefined;

      const stats = buildDashboardStats({
        month,
        leaves,
        overtimeStats,
        makeups,
        reimburses,
        attendances,
        exceptions,
        departments,
        employees,
      });
      return okay({ stats });
    },
  );

  // —— 数据导出 / 报表（CSV + xlsx 双格式，按部门 scope 隔离）—— //
  const EXPORT_CSV_MIME = 'text/csv; charset=utf-8';
  const EXPORT_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const ST_ZH: Record<string, string> = { pending: '待审批', approved: '已批准', rejected: '已驳回' };
  const EXC_TYPE_ZH: Record<string, string> = { late: '迟到', early_leave: '早退', missing_punch: '缺卡', absent: '缺勤' };
  const EXC_ST_ZH: Record<string, string> = { pending: '待处理', confirmed: '已确认', dismissed: '已驳回' };
  const CLOCK_ZH: Record<string, string> = { check_in: '签到', check_out: '签退' };
  const monthNow = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthOf = (q: string | undefined): string =>
    q && /^\d{4}-\d{2}$/.test(q) ? q : monthNow();

  /** 返回某月份起止日期 [YYYY-MM-01, YYYY-MM-月末]，用于排班统计按日期区间查询 */
  const monthRange = (month: string): [string, string] => {
    const [y = 0, m = 0] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
  };

  /** 统一导出器：按 format 输出 CSV 或 xlsx，并附 Content-Disposition 下载头 */
  async function sendExport(
    reply: FastifyReply,
    format: 'csv' | 'xlsx',
    base: string,
    columns: ReportColumn[],
    rows: Record<string, unknown>[],
  ) {
    const date = new Date().toISOString().slice(0, 10);
    // 下载文件名可能含中文（base），Node header 拒绝非 ASCII 字符。
    // 因此提供 ASCII 安全的 filename 兜底 + RFC5987 的 filename*=UTF-8 编码保留中文名。
    const dispo = (ext: string) =>
      `attachment; filename="export-${date}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${base}-${date}.${ext}`)}`;
    if (format === 'csv') {
      const body = toCsv(columns, rows);
      return reply
        .header('Content-Type', EXPORT_CSV_MIME)
        .header('Content-Disposition', dispo('csv'))
        .send(Buffer.from('\ufeff' + body, 'utf8')); // BOM 便于 Excel 识别中文
    }
    const buf = await buildWorkbookBuffer(columns, rows, `${base}-${date}`);
    return reply
      .header('Content-Type', EXPORT_XLSX_MIME)
      .header('Content-Disposition', dispo('xlsx'))
      .send(buf);
  }

  /** 列表型导出：每项 fetch(scope) 返回已映射好的导出行 */
  interface ExportSpec {
    path: string;
    permission: string;
    base: string;
    columns: ReportColumn[];
    fetch(scope: DepartmentScope): Promise<Record<string, unknown>[]>;
  }
  const tableSpecs: ExportSpec[] = [
    {
      path: '/api/export/leaves', permission: 'leave_view', base: '请假记录',
      columns: [
        { header: '申请人', key: 'applicantName' }, { header: '部门', key: 'departmentName' }, { header: '类型', key: 'type' },
        { header: '事由', key: 'reason' }, { header: '开始', key: 'startAt' }, { header: '结束', key: 'endAt' }, { header: '状态', key: 'status' },
      ],
      fetch: async (scope) => (await leaveRepo.listLeaves(scope)).map((v) => ({ applicantName: v.applicantName, departmentName: v.departmentName, type: v.type, reason: v.reason, startAt: v.startAt, endAt: v.endAt, status: ST_ZH[v.status] ?? v.status })),
    },
    {
      path: '/api/export/overtimes', permission: 'overtime_view', base: '加班记录',
      columns: [
        { header: '申请人', key: 'applicantName' }, { header: '部门', key: 'departmentName' }, { header: '日期', key: 'date' },
        { header: '开始', key: 'startTime' }, { header: '结束', key: 'endTime' }, { header: '时长(小时)', key: 'hours', format: 'number' },
        { header: '事由', key: 'reason' }, { header: '状态', key: 'status' },
      ],
      fetch: async (scope) => (await overtimeRepo.listOvertimes(scope)).map((v) => ({ applicantName: v.applicantName, departmentName: v.departmentName, date: v.date, startTime: v.startTime, endTime: v.endTime, hours: v.hours, reason: v.reason, status: ST_ZH[v.status] ?? v.status })),
    },
    {
      path: '/api/export/makeups', permission: 'makeup_view', base: '补卡记录',
      columns: [
        { header: '申请人', key: 'applicantName' }, { header: '部门', key: 'departmentName' }, { header: '记录日期', key: 'recordDate' },
        { header: '打卡类型', key: 'clockType' }, { header: '补卡时间', key: 'clockTime' }, { header: '事由', key: 'reason' }, { header: '状态', key: 'status' },
      ],
      fetch: async (scope) => (await makeupRepo.listMakeups(scope)).map((v) => ({ applicantName: v.applicantName, departmentName: v.departmentName, recordDate: v.recordDate, clockType: CLOCK_ZH[v.clockType] ?? v.clockType, clockTime: v.clockTime, reason: v.reason, status: ST_ZH[v.status] ?? v.status })),
    },
    {
      path: '/api/export/reimburses', permission: 'reimburse_view', base: '报销记录',
      columns: [
        { header: '申请人', key: 'applicantName' }, { header: '部门', key: 'departmentName' }, { header: '主类别', key: 'categoryName' },
        { header: '事由', key: 'reason' }, { header: '金额(元)', key: 'amount', format: 'money' }, { header: '状态', key: 'status' },
      ],
      fetch: async (scope) => (await reimburseRepo.listReimburses(scope)).map((v) => ({ applicantName: v.applicantName, departmentName: v.departmentName, categoryName: v.categoryName ?? '', reason: v.reason, amount: v.amount, status: ST_ZH[v.status] ?? v.status })),
    },
    {
      path: '/api/export/attendances', permission: 'attendance_view', base: '考勤打卡',
      columns: [
        { header: '申请人', key: 'applicantName' }, { header: '部门', key: 'departmentName' }, { header: '日期', key: 'date' },
        { header: '签到', key: 'checkIn' }, { header: '签退', key: 'checkOut' }, { header: '备注', key: 'note' },
      ],
      fetch: async (scope) => (await attendanceRepo.listAttendances(scope)).map((v) => ({ applicantName: v.applicantName, departmentName: v.departmentName, date: v.date, checkIn: v.checkIn ?? '', checkOut: v.checkOut ?? '', note: v.note })),
    },
    {
      path: '/api/export/exceptions', permission: 'att_exception_view', base: '考勤异常',
      columns: [
        { header: '用户', key: 'userName' }, { header: '部门', key: 'departmentName' }, { header: '日期', key: 'date' },
        { header: '类型', key: 'type' }, { header: '时长(分钟)', key: 'minutes', format: 'number' }, { header: '状态', key: 'status' },
      ],
      fetch: async (scope) => (await exceptionRepo.listExceptions(scope)).map((v) => ({ userName: v.userName, departmentName: v.departmentName, date: v.date, type: EXC_TYPE_ZH[v.type] ?? v.type, minutes: v.minutes, status: EXC_ST_ZH[v.status] ?? v.status })),
    },
    {
      path: '/api/export/salaries', permission: 'salary_view', base: '薪资台账',
      columns: [
        { header: '员工', key: 'employeeName' }, { header: '部门', key: 'departmentName' }, { header: '月份', key: 'month' },
        { header: '基本(元)', key: 'basic', format: 'money' }, { header: '奖金(元)', key: 'bonus', format: 'money' },
        { header: '扣款(元)', key: 'deduction', format: 'money' }, { header: '实发(元)', key: 'net', format: 'money' },
      ],
      fetch: async (scope) => (await salaryRepo.listSalaries(scope)).map((v) => ({ employeeName: v.employeeName, departmentName: v.departmentName, month: v.month, basic: v.basic, bonus: v.bonus, deduction: v.deduction, net: v.net })),
    },
  ];
  for (const sp of tableSpecs) {
    app.get(
      sp.path,
      {
        schema: {
          querystring: Type.Object({ format: Type.Optional(Type.Union([Type.Literal('csv'), Type.Literal('xlsx')])) }),
        },
      },
      async (req, reply) => {
        const user = await requirePermission(req, reply, sp.permission);
        if (!user) return;
        const tree = await departmentRepo.listTree();
        const scope = buildScope(user.departmentId, tree);
        const rows = await sp.fetch(scope);
        const format = req.query.format ?? 'xlsx';
        return sendExport(reply, format, sp.base, sp.columns, rows);
      },
    );
  }

  // 报表型导出：考勤统计（按月）——复用 buildAttendanceStats 聚合
  const REPORT_COLS = {
    attendanceStats: [
      { header: '员工', key: 'userName' }, { header: '部门', key: 'departmentName' },
      { header: '出勤天数', key: 'presentDays' }, { header: '正常出勤', key: 'normalDays' },
      { header: '迟到', key: 'lateCount' }, { header: '早退', key: 'earlyLeaveCount' },
      { header: '总工时(小时)', key: 'totalWorkHours' }, { header: '平均工时(小时)', key: 'avgWorkHours' },
    ],
    overtimeStats: [
      { header: '部门', key: 'departmentName' }, { header: '申请人', key: 'applicantName' },
      { header: '日期', key: 'date' }, { header: '时长(小时)', key: 'hours', format: 'number' }, { header: '状态', key: 'status' },
    ],
    scheduleStats: [
      { header: '员工', key: 'userName' }, { header: '部门', key: 'departmentName' },
      { header: '出勤班次', key: 'shiftDays' }, { header: '休息天数', key: 'restDays' },
      { header: '总工时(小时)', key: 'totalWorkHours' }, { header: '平均工时(小时)', key: 'avgWorkHours' },
    ],
  } satisfies Record<string, ReportColumn[]>;

  app.get(
    '/api/export/attendance-stats',
    {
      schema: {
        querystring: Type.Object({
          format: Type.Optional(Type.Union([Type.Literal('csv'), Type.Literal('xlsx')])),
          month: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'attendance_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const month = monthOf(req.query.month);
      const stats = buildAttendanceStats(await attendanceRepo.listAttendances(scope), { month });
      const rows = stats.map((s) => ({ userName: s.userName, departmentName: s.departmentName, presentDays: s.presentDays, normalDays: s.normalDays, lateCount: s.lateCount, earlyLeaveCount: s.earlyLeaveCount, totalWorkHours: s.totalWorkHours, avgWorkHours: s.avgWorkHours }));
      return sendExport(reply, req.query.format ?? 'xlsx', `考勤统计${month}`, REPORT_COLS.attendanceStats, rows);
    },
  );

  app.get(
    '/api/export/overtime-stats',
    {
      schema: {
        querystring: Type.Object({
          format: Type.Optional(Type.Union([Type.Literal('csv'), Type.Literal('xlsx')])),
          month: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'overtime_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const month = monthOf(req.query.month);
      const rows = (await overtimeRepo.listOvertimes(scope))
        .filter((v) => v.date.startsWith(month))
        .map((v) => ({ departmentName: v.departmentName, applicantName: v.applicantName, date: v.date, hours: v.hours, status: ST_ZH[v.status] ?? v.status }));
      return sendExport(reply, req.query.format ?? 'xlsx', `加班统计${month}`, REPORT_COLS.overtimeStats, rows);
    },
  );

  // 报表型导出：排班统计（按月）——聚合 出勤班次/休息/工时
  app.get(
    '/api/export/schedule-stats',
    {
      schema: {
        querystring: Type.Object({
          format: Type.Optional(Type.Union([Type.Literal('csv'), Type.Literal('xlsx')])),
          month: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'shift_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const month = monthOf(req.query.month);
      const [startDate, endDate] = monthRange(month);
      const stats = buildScheduleStats(await shiftRepo.listSchedules(scope, { startDate, endDate }), { month });
      const rows = stats.map((s) => ({ userName: s.userName, departmentName: s.departmentName, shiftDays: s.shiftDays, restDays: s.restDays, totalWorkHours: s.totalWorkHours, avgWorkHours: s.avgWorkHours }));
      return sendExport(reply, req.query.format ?? 'xlsx', `排班统计${month}`, REPORT_COLS.scheduleStats, rows);
    },
  );

  // 考勤打卡（需 attendance_punch）：departmentId 强制取自当前用户（不信任前端）。
  app.post(
    '/api/attendance',
    {
      schema: {
        body: Type.Object({
          date: Type.String({ minLength: 1 }),
          checkIn: Type.Optional(Type.String()),
          checkOut: Type.Optional(Type.String()),
          note: Type.Optional(Type.String()),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'attendance_punch');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法考勤打卡'));
      }
      const { date, checkIn, checkOut, note } = req.body;
      const { id } = await attendanceRepo.createAttendance({
        date,
        checkIn: checkIn ?? null,
        checkOut: checkOut ?? null,
        note: note ?? '',
        userId: user.id,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 加班列表（需 overtime_view）：按当前用户部门可见作用域过滤。
  app.get(
    '/api/overtimes',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'overtime_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const overtimes = await overtimeRepo.listOvertimes(scope);
      return okay({ overtimes });
    },
  );

  // 加班统计（需 overtime_view）：按月份聚合已批准总时长/次数与待审批次数。
  app.get(
    '/api/overtimes/stats',
    {
      schema: {
        querystring: Type.Object({ month: Type.String({ minLength: 1 }) }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'overtime_view');
      if (!user) return;
      const { month } = req.query;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const stats = await overtimeRepo.getStats(scope, month);
      return okay({ stats });
    },
  );

  // 发起加班申请（需 overtime_create）：departmentId 强制取自当前用户。
  app.post(
    '/api/overtimes',
    {
      schema: {
        body: Type.Object({
          date: Type.String({ minLength: 1 }),
          startTime: Type.String({ minLength: 1 }),
          endTime: Type.String({ minLength: 1 }),
          hours: Type.Number({ exclusiveMinimum: 0 }),
          reason: Type.String({ minLength: 1 }),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'overtime_create');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法发起加班申请'));
      }
      const { date, startTime, endTime, hours, reason } = req.body;
      const { id } = await overtimeRepo.createOvertime({
        date,
        startTime,
        endTime,
        hours,
        reason,
        applicantId: user.id,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 审批加班（需 overtime_approve）：只能审批「本部门+下属部门」范围的加班单（隔离护栏）。
  app.put(
    '/api/overtimes/:id/status',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ status: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]) }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'overtime_approve');
      if (!user) return;
      const overtimeId = (req.params as { id: number }).id;
      const overtime = await overtimeRepo.getOvertimeById(overtimeId);
      if (!overtime) return reply.status(404).send(fail('加班单不存在'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      if (!scopeIncludes(scope, overtime.departmentId)) {
        return reply.status(403).send(fail('无权审批该部门的加班单'));
      }
      await overtimeRepo.setStatus(overtimeId, req.body.status);
      notify?.({ userId: overtime.applicantId }, 'notification', {
        kind: req.body.status === 'approved' ? 'success' : 'warning',
        title: '审批通知',
        message: req.body.status === 'approved' ? '你的加班申请已批准' : '你的加班申请已驳回',
      });
      return okay(null);
    },
  );

  // 补卡列表（需 makeup_view）：按当前用户部门可见作用域过滤。
  app.get(
    '/api/makeups',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'makeup_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const makeups = await makeupRepo.listMakeups(scope);
      return okay({ makeups });
    },
  );

  // 发起补卡申请（需 makeup_create）：departmentId 强制取自当前用户。
  app.post(
    '/api/makeups',
    {
      schema: {
        body: Type.Object({
          recordDate: Type.String({ minLength: 1 }),
          clockType: Type.Union([Type.Literal('check_in'), Type.Literal('check_out')]),
          clockTime: Type.String({ minLength: 1 }),
          reason: Type.String({ minLength: 1 }),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'makeup_create');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法发起补卡申请'));
      }
      const { recordDate, clockType, clockTime, reason } = req.body;
      const { id } = await makeupRepo.createMakeup({
        recordDate,
        clockType,
        clockTime,
        reason,
        applicantId: user.id,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 审批补卡（需 makeup_approve）：只能审批「本部门+下属部门」范围的补卡单（隔离护栏）。
  app.put(
    '/api/makeups/:id/status',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ status: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]) }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'makeup_approve');
      if (!user) return;
      const makeupId = (req.params as { id: number }).id;
      const makeup = await makeupRepo.getMakeupById(makeupId);
      if (!makeup) return reply.status(404).send(fail('补卡单不存在'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      if (!scopeIncludes(scope, makeup.departmentId)) {
        return reply.status(403).send(fail('无权审批该部门的补卡单'));
      }
      await makeupRepo.setStatus(makeupId, req.body.status);
      notify?.({ userId: makeup.applicantId }, 'notification', {
        kind: req.body.status === 'approved' ? 'success' : 'warning',
        title: '审批通知',
        message: req.body.status === 'approved' ? '你的补卡申请已批准' : '你的补卡申请已驳回',
      });
      return okay(null);
    },
  );

  // 考勤设置查看（需 att_setting_view）：系统级单例配置 GET
  app.get(
    '/api/attendance/settings',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'att_setting_view'))) return;
      const setting = await attSettingRepo.getSetting();
      return okay({ setting });
    },
  );

  // 考勤设置更新（需 att_setting_edit）：全量覆盖单例配置 PUT
  app.put(
    '/api/attendance/settings',
    {
      schema: {
        body: Type.Object({
          earlyClockInMinutes: Type.Number({ minimum: 0 }),
          lateClockOutMinutes: Type.Number({ minimum: 0 }),
          lateMinutes: Type.Number({ minimum: 0 }),
          earlyLeaveMinutes: Type.Number({ minimum: 0 }),
          absentHours: Type.Number({ minimum: 0 }),
          allowMakeup: Type.Boolean(),
          makeupDeadlineDays: Type.Number({ minimum: 0 }),
          requireApprovalForMakeup: Type.Boolean(),
          notifyOnLate: Type.Boolean(),
          notifyOnEarlyLeave: Type.Boolean(),
          notifyOnAbsent: Type.Boolean(),
          enableTimeCheck: Type.Boolean(),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'att_setting_edit'))) return;
      const setting = await attSettingRepo.updateSetting(req.body as unknown as AttSettingView);
      return okay({ setting });
    },
  );

  // 节假日列表（需 holiday_view）：系统级配置，可按年筛选
  app.get(
    '/api/holidays',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'holiday_view'))) return;
      const q = req.query as { year?: string };
      const holidays = await holidayRepo.listHolidays(q.year ? Number(q.year) : undefined);
      return okay({ holidays });
    },
  );

  // 新建节假日（需 holiday_manage）：date 全局唯一；year 由 date 推导
  app.post(
    '/api/holidays',
    {
      schema: {
        body: Type.Object({
          date: Type.String({ minLength: 1 }),
          name: Type.String({ minLength: 1 }),
          type: Type.String({ minLength: 1 }),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'holiday_manage'))) return;
      const year = Number(req.body.date.slice(0, 4));
      const r = await holidayRepo.createHoliday({ year, ...req.body });
      if (!r.ok) return reply.status(409).send(fail('该日期已存在节假日'));
      return reply.status(201).send(okay({ id: r.id }));
    },
  );

  // 编辑节假日（需 holiday_manage）：date 唯一冲突→409，未找到→404
  app.put(
    '/api/holidays/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          date: Type.Optional(Type.String({ minLength: 1 })),
          name: Type.Optional(Type.String({ minLength: 1 })),
          type: Type.Optional(Type.String({ minLength: 1 })),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'holiday_manage'))) return;
      const { id } = req.params as { id: number };
      const data: { date?: string; name?: string; type?: string; year?: number } = { ...req.body };
      if (data.date) data.year = Number(data.date.slice(0, 4));
      const r = await holidayRepo.updateHoliday(id, data);
      if (!r.ok) {
        return r.reason === 'not_found'
          ? reply.status(404).send(fail('节假日不存在'))
          : reply.status(409).send(fail('该日期已存在节假日'));
      }
      return okay(null);
    },
  );

  // 删除节假日（需 holiday_manage）
  app.delete(
    '/api/holidays/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'holiday_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await holidayRepo.deleteHoliday(id);
      if (r === 'not_found') return reply.status(404).send(fail('节假日不存在'));
      return okay(null);
    },
  );

  // —— 考勤异常处理：扫描判定 + 列表(scope 隔离) + 人工确认/驳回 ——

  // 异常列表（需 att_exception_view）：按 scope 过滤，可按状态/类型筛选
  app.get(
    '/api/attendance/exceptions',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'att_exception_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const q = req.query as { status?: string; type?: string };
      const exceptions = await exceptionRepo.listExceptions(scope, { status: q.status, type: q.type });
      return okay({ exceptions });
    },
  );

  // 扫描异常（需 att_exception_manage）：遍历有排班的员工，基于打卡+设置自动判定并落库
  app.post(
    '/api/attendance/exceptions/scan',
    {
      schema: {
        body: Type.Object({
          startDate: Type.String({ minLength: 1 }),
          endDate: Type.String({ minLength: 1 }),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'att_exception_manage');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const { startDate, endDate } = req.body;
      const setting = await attSettingRepo.getSetting();
      // 范围内排班（含预期上下班时间/休息日）
      const schedules = await shiftRepo.listSchedules(scope, { startDate, endDate });
      // 范围内打卡记录，按 userId|date 建索引
      const attendance = await attendanceRepo.listAttendances(scope);
      const attendanceKey = new Map<string, { checkIn: string | null; checkOut: string | null }>();
      for (const a of attendance) {
        if (a.date >= startDate && a.date <= endDate) {
          attendanceKey.set(`${a.userId}|${a.date}`, { checkIn: a.checkIn, checkOut: a.checkOut });
        }
      }
      const candidates: ExceptionCandidate[] = [];
      for (const sc of schedules) {
        const att = attendanceKey.get(`${sc.userId}|${sc.scheduleDate}`);
        candidates.push(
          ...detectDayExceptions({
            date: sc.scheduleDate,
            userId: sc.userId,
            departmentId: sc.departmentId,
            userName: sc.userName,
            departmentName: sc.departmentName,
            startTime: sc.startTime,
            endTime: sc.endTime,
            isRestDay: sc.isRestDay,
            checkIn: att?.checkIn ?? null,
            checkOut: att?.checkOut ?? null,
            lateMinutes: setting.lateMinutes,
            earlyLeaveMinutes: setting.earlyLeaveMinutes,
          }),
        );
      }
      const result = await exceptionRepo.scanUpsert(candidates);
      return okay(result);
    },
  );

  // 异常确认/驳回（需 att_exception_manage）：越权(403)/未找到(404)，成功通知员工
  app.put(
    '/api/attendance/exceptions/:id/status',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          status: Type.Union([Type.Literal('confirmed'), Type.Literal('dismissed')]),
          remark: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'att_exception_manage');
      if (!user) return;
      const { id } = req.params as { id: number };
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const r = await exceptionRepo.setStatus(scope, id, req.body.status, req.body.remark);
      if (r === 'not_found') return reply.status(404).send(fail('异常记录不存在'));
      if (r === 'out_of_scope') return reply.status(403).send(fail('无权处理该部门的异常'));
      const target = (await exceptionRepo.listExceptions(scope)).find((e) => e.id === id);
      if (target?.userId) {
        notify?.({ userId: target.userId }, 'notification', {
          kind: req.body.status === 'confirmed' ? 'success' : 'warning',
          title: '考勤异常通知',
          message: req.body.status === 'confirmed' ? '你的考勤异常已被确认处理' : '你的考勤异常已被驳回',
        });
      }
      return okay(null);
    },
  );

  // —— 请假额度体系：LeaveType CRUD + 年度额度 + Excel 导入 + 趋势 ——

  // 请假类型列表（需 leave_type_view）：系统级配置，无部门隔离
  app.get(
    '/api/leave-types',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'leave_type_view'))) return;
      const leaveTypes = await leaveTypeRepo.listLeaveTypes();
      return okay({ leaveTypes });
    },
  );

  // 新建请假类型（需 leave_type_manage）：重名 → 409
  app.post(
    '/api/leave-types',
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          unit: Type.String({ minLength: 1 }),
          allowance: Type.Number({ minimum: 0 }),
          description: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'leave_type_manage'))) return;
      const r = await leaveTypeRepo.createLeaveType(req.body as { name: string; unit: string; allowance: number; description?: string | null });
      if (!r.ok) return reply.status(409).send(fail('请假类型名称已存在'));
      return reply.status(201).send(okay({ id: r.id }));
    },
  );

  // 编辑请假类型（需 leave_type_manage）
  app.put(
    '/api/leave-types/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          unit: Type.Optional(Type.String({ minLength: 1 })),
          allowance: Type.Optional(Type.Number({ minimum: 0 })),
          isActive: Type.Optional(Type.Boolean()),
          description: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'leave_type_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await leaveTypeRepo.updateLeaveType(id, req.body as Parameters<LeaveTypeRepo['updateLeaveType']>[1]);
      if (!r.ok) return r.reason === 'not_found' ? reply.status(404).send(fail('请假类型不存在')) : reply.status(409).send(fail('请假类型名称已存在'));
      return okay(null);
    },
  );

  // 删除请假类型（需 leave_type_manage）：被额度占用 → 409
  app.delete(
    '/api/leave-types/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'leave_type_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await leaveTypeRepo.deleteLeaveType(id);
      if (r === 'not_found') return reply.status(404).send(fail('请假类型不存在'));
      if (r === 'in_use') return reply.status(409).send(fail('该类型已被年度额度占用，无法删除'));
      return okay(null);
    },
  );

  // —— 额度范围解析工具（user 维度部门隔离）：返回 scope 内可见的 userId 集合 ——
  async function resolveScopeUserIds(actorDepartmentId: number | null): Promise<number[]> {
    const tree = await departmentRepo.listTree();
    const scope = buildScope(actorDepartmentId, tree);
    const users = await rbacRepo.listUsers();
    return users
      .filter((u) => (u.departmentId == null ? scope.kind === 'all' : scopeIncludes(scope, u.departmentId)))
      .map((u) => u.id);
  }

  // 年度额度列表（需 quota_view）：按 scope 过滤员工
  app.get(
    '/api/leave-quotas',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'quota_view');
      if (!user) return;
      const year = Number((req.query as { year?: string }).year ?? new Date().getFullYear());
      const userIds = await resolveScopeUserIds(user.departmentId);
      const quotas = await quotaRepo.listQuotas(year, userIds);
      return okay({ quotas });
    },
  );

  // 设置单条年度额度（需 quota_manage）：按某员工的某年某类型 upsert
  app.put(
    '/api/leave-quotas/:userId/:year/:leaveTypeId',
    {
      schema: {
        params: Type.Object({ userId: Type.Number(), year: Type.Number(), leaveTypeId: Type.Number() }),
        body: Type.Object({ allowance: Type.Number({ minimum: 0 }), used: Type.Optional(Type.Number({ minimum: 0 })) }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'quota_manage'))) return;
      const { userId, year, leaveTypeId } = req.params as { userId: number; year: number; leaveTypeId: number };
      const { allowance, used = 0 } = req.body as { allowance: number; used?: number };
      const r = await quotaRepo.upsertQuota({ userId, year, leaveTypeId, allowance, used });
      if (!r.ok) return reply.status(404).send(fail('员工或请假类型不存在'));
      return okay(null);
    },
  );

  // 批量导入年度额度 Excel（需 quota_manage）：body 内 base64 xlsx → 按姓名/类型映射 → 批量落地
  app.post(
    '/api/leave-quotas/import',
    {
      schema: {
        body: Type.Object({ file: Type.String({ minLength: 1 }) }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'quota_manage');
      if (!user) return;
      const year = Number((req.query as { year?: string }).year);
      if (!year) return reply.status(400).send(fail('缺少有效的年份参数'));
      const { parseQuotaWorkbook, mapQuotaRows } = await import('./modules/vacation/quota-excel');
      let buffer: Buffer;
      try {
        buffer = Buffer.from(req.body.file, 'base64');
      } catch {
        return reply.status(400).send(fail('文件数据无效'));
      }
      let rows: Awaited<ReturnType<typeof parseQuotaWorkbook>>;
      try {
        rows = await parseQuotaWorkbook(buffer);
      } catch {
        return reply.status(400).send(fail('文件数据无效'));
      }
      if (rows.length === 0) return reply.status(400).send(fail('未解析到有效额度数据'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const usersInScope = (await rbacRepo.listUsers()).filter((u) =>
        u.departmentId == null ? scope.kind === 'all' : scopeIncludes(scope, u.departmentId),
      );
      const typeIds = (await leaveTypeRepo.listLeaveTypes()).map((t) => [t.name, t.id] as const);
      const { rows: mapped, skipped } = mapQuotaRows(rows, usersInScope, typeIds, year);
      if (mapped.length === 0) return reply.status(400).send(fail('未找到可导入的额度（员工或类型不匹配）'));
      const count = await quotaRepo.batchUpsertQuotas(mapped);
      return reply.status(201).send(okay({ count, skipped }));
    },
  );

  // 年度请假趋势（需 quota_view）：按 scope 员工按月聚合已审请假量
  app.get(
    '/api/leave/trend',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'quota_view');
      if (!user) return;
      const year = Number((req.query as { year?: string }).year ?? new Date().getFullYear());
      const userIds = await resolveScopeUserIds(user.departmentId);
      const trend = await quotaRepo.getTrend(year, userIds);
      return okay({ trend });
    },
  );

  // 薪资列表（需 salary_view）：按当前用户部门可见作用域（本部门+下属部门）过滤。
  app.get(
    '/api/salaries',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'salary_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const salaries = await salaryRepo.listSalaries(scope);
      return okay({ salaries });
    },
  );

  // 录入薪资（需 salary_create）：管理端为「目标员工」录入。departmentId 取自目标员工（不信任前端/不取录入者），
  // 且目标员工须在录入者作用域内（只能给本部门+下属部门的人发薪）。net 实发由服务端计算。
  app.post(
    '/api/salaries',
    {
      schema: {
        body: Type.Object({
          month: Type.String({ minLength: 1 }),
          userId: Type.Number(),
          basic: Type.Number({ exclusiveMinimum: 0 }),
          bonus: Type.Number({ minimum: 0 }),
          deduction: Type.Number({ minimum: 0 }),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'salary_create');
      if (!user) return;
      const { month, userId, basic, bonus, deduction } = req.body;
      const target = await userRepo.findById(userId);
      if (!target) return reply.status(404).send(fail('目标员工不存在'));
      if (target.departmentId == null) {
        return reply.status(409).send(fail('目标员工未归属部门，无法录入薪资'));
      }
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      if (!scopeIncludes(scope, target.departmentId)) {
        return reply.status(403).send(fail('无权为作用域外的员工录入薪资'));
      }
      const { id } = await salaryRepo.createSalary({
        month,
        userId,
        departmentId: target.departmentId,
        basic,
        bonus,
        deduction,
        net: basic + bonus - deduction,
      });
      return reply.status(201).send(okay({ id }));
    },
  );

  // 部门列表（需 dept_view，含 parentId 供前端渲染树形）
  app.get(
    '/api/departments',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'dept_view'))) return;
      const departments = await departmentRepo.listDepartments();
      return okay({ departments });
    },
  );

  // 新建部门（需 dept_create）；name 唯一冲突 → 409
  app.post(
    '/api/departments',
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          parentId: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'dept_create'))) return;
      const { name, parentId = null } = req.body;
      try {
        const { id } = await departmentRepo.createDepartment({ name, parentId });
        return reply.status(201).send(okay({ id }));
      } catch {
        return reply.status(409).send(fail('部门名称已存在'));
      }
    },
  );

  // 编辑部门（需 dept_update）
  app.put(
    '/api/departments/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          parentId: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'dept_update'))) return;
      const { id } = req.params as { id: number };
      const { name, parentId } = req.body;
      try {
        await departmentRepo.updateDepartment(id, { name, parentId });
        return okay(null);
      } catch {
        return reply.status(409).send(fail('部门名称已存在'));
      }
    },
  );

  // 删除部门（需 dept_delete）：有子部门/请假单/用户时 409 保护
  app.delete(
    '/api/departments/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'dept_delete'))) return;
      const { id } = req.params as { id: number };
      const result = await departmentRepo.deleteDepartment(id);
      if (result === 'not_found') return reply.status(404).send(fail('部门不存在'));
      if (result !== 'ok') {
        const msg =
          result === 'has_children'
            ? '存在子部门，无法删除'
            : result === 'has_leaves'
              ? '部门下存在请假单，无法删除'
              : '部门下存在用户，无法删除';
        return reply.status(409).send(fail(msg));
      }
      return okay(null);
    },
  );

  // ---------- 排班模块：班次管理 + 排班管理 + 我的排班 ----------

  // 班次/排班管理页所需用户列表：作用于 scope 范围内的可选目标员工解析
  async function resolveScheduleTarget(
    userId: number,
    scope: DepartmentScope,
  ): Promise<UserProjection | null> {
    const target = await userRepo.findById(userId);
    if (!target) return null;
    // 未归类部门(null)的用户，仅当 scope 为 all（总部/root）时才可被排班
    if (target.departmentId == null) return scope.kind === 'all' ? target : null;
    return scopeIncludes(scope, target.departmentId) ? target : null;
  }

  /** 班次列表（需 shift_view）：通用班次 + 本部门/下属部门班次 */
  app.get(
    '/api/shifts',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'shift_view');
      if (!user) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const shifts = await shiftRepo.listShifts(scope);
      return okay({ shifts });
    },
  );

  app.post(
    '/api/shifts',
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          startTime: Type.String({ minLength: 1 }),
          endTime: Type.String({ minLength: 1 }),
          restDuration: Type.Optional(Type.Number({ minimum: 0 })),
          lateThreshold: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          earlyThreshold: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          useGlobalThreshold: Type.Optional(Type.Boolean()),
          departmentId: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          description: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'shift_manage'))) return;
      const r = await shiftRepo.createShift(req.body);
      if (!r.ok) return reply.status(409).send(fail('班次名称已存在'));
      return reply.status(201).send(okay({ id: r.id }));
    },
  );

  app.put(
    '/api/shifts/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          startTime: Type.Optional(Type.String({ minLength: 1 })),
          endTime: Type.Optional(Type.String({ minLength: 1 })),
          restDuration: Type.Optional(Type.Number({ minimum: 0 })),
          lateThreshold: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          earlyThreshold: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          useGlobalThreshold: Type.Optional(Type.Boolean()),
          isActive: Type.Optional(Type.Boolean()),
          departmentId: Type.Optional(Type.Union([Type.Null(), Type.Number()])),
          description: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'shift_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await shiftRepo.updateShift(id, req.body);
      if (!r.ok) {
        return r.reason === 'not_found'
          ? reply.status(404).send(fail('班次不存在'))
          : reply.status(409).send(fail('班次名称已存在'));
      }
      return okay(null);
    },
  );

  app.delete(
    '/api/shifts/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'shift_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await shiftRepo.deleteShift(id);
      if (r === 'not_found') return reply.status(404).send(fail('班次不存在'));
      if (r === 'in_use') return reply.status(409).send(fail('该班次已被排班引用，无法删除'));
      return okay(null);
    },
  );

  app.post(
    '/api/shifts/:id/toggle',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'shift_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await shiftRepo.toggleShift(id);
      if (r === 'not_found') return reply.status(404).send(fail('班次不存在'));
      return okay(null);
    },
  );

  // 排班列表（需 shift_view）：按当前用户部门可见作用域过滤，支持日期区间
  app.get(
    '/api/schedules',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'shift_view');
      if (!user) return;
      const q = req.query as { startDate?: string; endDate?: string };
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const schedules = await shiftRepo.listSchedules(scope, {
        startDate: q.startDate,
        endDate: q.endDate,
      });
      return okay({ schedules });
    },
  );

  // 排班统计报表（需 shift_view）：聚合员工×月份 出勤/休息/累计工时。
  app.get(
    '/api/schedules/stats',
    {
      schema: {
        querystring: Type.Object({ month: Type.String({ minLength: 1 }) }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'shift_view');
      if (!user) return;
      const { month } = req.query;
      const [startDate, endDate] = monthRange(month);
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const schedules = await shiftRepo.listSchedules(scope, { startDate, endDate });
      const stats = buildScheduleStats(schedules, { month });
      return okay({ stats });
    },
  );

  // -------- 周排班模板（需 schedule_template_view/manage） --------

  // 模板列表
  app.get(
    '/api/schedule-templates',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_view');
      if (!user) return;
      return okay({ templates: await shiftRepo.listTemplates() });
    },
  );

  // 新建模板（仅名称/描述，条目随后用 /items 维护）
  app.post(
    '/api/schedule-templates',
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          description: Type.Optional(Type.Union([Type.Null(), Type.String()])),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_create');
      if (!user) return;
      const r = await shiftRepo.createTemplate(req.body);
      if (!r.ok) return reply.status(409).send(fail('模板名称已存在'));
      return okay({ id: r.id });
    },
  );

  // 更新模板（名称/描述）
  app.put(
    '/api/schedule-templates/:id',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          description: Type.Optional(Type.Union([Type.Null(), Type.String()])),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_edit');
      if (!user) return;
      const r = await shiftRepo.updateTemplate(req.params.id, req.body);
      if (r === 'not_found') return reply.status(404).send(fail('模板不存在'));
      if (r === 'dup') return reply.status(409).send(fail('模板名称已存在'));
      return okay({});
    },
  );

  // 替换模板条目（先删后插）
  app.put(
    '/api/schedule-templates/:id/items',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({
          items: Type.Array(
            Type.Object({
              userId: Type.Number(),
              weekday: Type.Number({ minimum: 1, maximum: 7 }),
              shiftId: Type.Union([Type.Null(), Type.Number()]),
              isRestDay: Type.Optional(Type.Boolean()),
            }),
          ),
        }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_edit');
      if (!user) return;
      const r = await shiftRepo.setTemplateItems(req.params.id, req.body.items);
      if (!r.ok) return reply.status(404).send(fail('模板不存在'));
      return okay({ count: req.body.items.length });
    },
  );

  // 删除模板
  app.delete(
    '/api/schedule-templates/:id',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_delete');
      if (!user) return;
      const r = await shiftRepo.deleteTemplate((req.params as { id: number }).id);
      if (r === 'not_found') return reply.status(404).send(fail('模板不存在'));
      return okay({});
    },
  );

  // 一键应用模板到指定周
  app.post(
    '/api/schedule-templates/:id/apply',
    {
      schema: {
        params: Type.Object({ id: Type.Number() }),
        body: Type.Object({ targetStart: Type.String({ minLength: 1 }) }),
        response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'schedule_template_apply');
      if (!user) return;
      const r = await shiftRepo.applyTemplate(req.params.id, req.body.targetStart);
      if (!r.ok) return reply.status(404).send(fail('模板不存在'));
      return okay({ count: r.count });
    },
  );

  // 我的排班（需 my_schedule_view）：仅返回当前用户自己的排班，天然部门自隔离
  app.get(
    '/api/schedules/self',
    { schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Any() }) } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'my_schedule_view');
      if (!user) return;
      const q = req.query as { startDate?: string; endDate?: string };
      const schedules = await shiftRepo.listSchedulesByUser(user.id, {
        startDate: q.startDate,
        endDate: q.endDate,
      });
      return okay({ schedules });
    },
  );

  // 员工为自己选班（需 my_schedule_view）：departmentId 取自当前用户
  app.post(
    '/api/schedules/self',
    {
      schema: {
        body: Type.Object({
          scheduleDate: Type.String({ minLength: 1 }),
          shiftId: Type.Union([Type.Null(), Type.Number()]),
          isRestDay: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'my_schedule_view');
      if (!user) return;
      if (user.departmentId == null) {
        return reply.status(409).send(fail('当前用户未归属部门，无法自助排班'));
      }
      await shiftRepo.upsertSchedule({
        userId: user.id,
        shiftId: req.body.shiftId,
        scheduleDate: req.body.scheduleDate,
        isRestDay: req.body.isRestDay ?? false,
        departmentId: user.departmentId,
      });
      return reply.status(201).send(okay(null));
    },
  );

  // 管理端为某员工设置排班（需 shift_manage）：目标必须在用户作用域内，变更后通知目标用户
  app.post(
    '/api/schedules',
    {
      schema: {
        body: Type.Object({
          userId: Type.Number(),
          shiftId: Type.Union([Type.Null(), Type.Number()]),
          scheduleDate: Type.String({ minLength: 1 }),
          isRestDay: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      const target = await resolveScheduleTarget(req.body.userId, scope);
      if (!target) return reply.status(403).send(fail('无权为该员工排班（作用域外或用户不存在）'));
      await shiftRepo.upsertSchedule({
        userId: target.id,
        shiftId: req.body.shiftId,
        scheduleDate: req.body.scheduleDate,
        isRestDay: req.body.isRestDay ?? false,
        departmentId: target.departmentId ?? 0,
      });
      notify?.({ userId: target.id }, 'notification', {
        kind: 'info',
        title: '排班通知',
        message: `你 ${req.body.scheduleDate} 的排班已更新`,
      });
      return reply.status(201).send(okay(null));
    },
  );

  // 排班预检（需 shift_manage）：批量落地前的静态校验（日期/班次存在性/一人一天冲突），供前端覆盖确认
  app.post(
    '/api/schedules/validate',
    {
      schema: {
        body: Type.Object({
          schedules: Type.Array(
            Type.Object({
              userId: Type.Number(),
              shiftId: Type.Union([Type.Null(), Type.Number()]),
              scheduleDate: Type.String({ minLength: 1 }),
              isRestDay: Type.Optional(Type.Boolean()),
            }),
          ),
        }),
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      const rows: ScheduleValidationRow[] = [];
      for (const s of req.body.schedules) {
        const target = await resolveScheduleTarget(s.userId, scope);
        if (!target) return reply.status(403).send(fail('排班包含作用域外员工'));
        rows.push({
          userId: target.id,
          shiftId: s.shiftId,
          scheduleDate: s.scheduleDate,
          isRestDay: s.isRestDay ?? false,
          departmentId: target.departmentId ?? 0,
        });
      }
      const shifts = await shiftRepo.listShifts(scope);
      const result = validateScheduleRows(rows, shifts.map((sh) => sh.id));
      return okay(result);
    },
  );

  // 批量排班（需 shift_manage）：一批 (userId,shiftId,date,isRestDay) 原子落地，变更通知每个目标
  app.post(
    '/api/schedules/batch',
    {
      schema: {
        body: Type.Object({
          schedules: Type.Array(
            Type.Object({
              userId: Type.Number(),
              shiftId: Type.Union([Type.Null(), Type.Number()]),
              scheduleDate: Type.String({ minLength: 1 }),
              isRestDay: Type.Optional(Type.Boolean()),
            }),
          ),
        }),
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      if (req.body.schedules.length === 0) return reply.status(400).send(fail('排班数据不能为空'));
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      const rows: Parameters<ShiftRepo['batchUpsertSchedules']>[0] = [];
      const targets = new Set<number>();
      for (const s of req.body.schedules) {
        const target = await resolveScheduleTarget(s.userId, scope);
        if (!target) return reply.status(403).send(fail('排班包含作用域外员工'));
        rows.push({
          userId: target.id,
          shiftId: s.shiftId,
          scheduleDate: s.scheduleDate,
          isRestDay: s.isRestDay ?? false,
          departmentId: target.departmentId ?? 0,
        });
        targets.add(target.id);
      }
      const count = await shiftRepo.batchUpsertSchedules(rows);
      for (const uid of targets) {
        notify?.({ userId: uid }, 'notification', {
          kind: 'info',
          title: '排班通知',
          message: '你的排班已被批量更新',
        });
      }
      return okay({ count });
    },
  );

  // 复制排班模板（需 shift_manage）：把 source 区间复制到目标起始日期
  app.post(
    '/api/schedules/copy-template',
    {
      schema: {
        body: Type.Object({
          sourceStart: Type.String({ minLength: 1 }),
          sourceEnd: Type.String({ minLength: 1 }),
          targetStart: Type.String({ minLength: 1 }),
          userIds: Type.Optional(Type.Array(Type.Number())),
        }),
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      let userIds = req.body.userIds;
      if (userIds && userIds.length > 0) {
        const allowed: number[] = [];
        for (const uid of userIds) {
          const t = await resolveScheduleTarget(uid, scope);
          if (!t) return reply.status(403).send(fail('包含作用域外员工'));
          allowed.push(uid);
        }
        userIds = allowed;
      }
      const count = await shiftRepo.copyScheduleTemplate(
        req.body.sourceStart,
        req.body.sourceEnd,
        req.body.targetStart,
        userIds,
      );
      return okay({ count });
    },
  );

  // 智能生成（需 shift_manage）：批量规则 → 落地排班（含置休）
  app.post(
    '/api/schedules/smart',
    {
      schema: {
        body: Type.Object({
          rows: Type.Array(
            Type.Object({
              userId: Type.Number(),
              shiftId: Type.Union([Type.Null(), Type.Number()]),
              scheduleDate: Type.String({ minLength: 1 }),
              isRestDay: Type.Optional(Type.Boolean()),
            }),
          ),
        }),
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      const rows: Parameters<ShiftRepo['smartGenerate']>[0] = [];
      for (const s of req.body.rows) {
        const target = await resolveScheduleTarget(s.userId, scope);
        if (!target) return reply.status(403).send(fail('包含作用域外员工'));
        rows.push({
          userId: target.id,
          shiftId: s.shiftId,
          scheduleDate: s.scheduleDate,
          isRestDay: s.isRestDay ?? false,
          departmentId: target.departmentId ?? 0,
        });
      }
      const count = await shiftRepo.smartGenerate(rows);
      return okay({ count });
    },
  );

  app.delete(
    '/api/schedules/:id',
    { schema: { params: Type.Object({ id: Type.Number() }) } },
    async (req, reply) => {
      if (!(await requirePermission(req, reply, 'shift_manage'))) return;
      const { id } = req.params as { id: number };
      const r = await shiftRepo.deleteSchedule(id);
      if (r === 'not_found') return reply.status(404).send(fail('排班不存在'));
      return okay(null);
    },
  );

  // 导出排班 Excel（需 shift_view）：返回当前部门作用域内排班明细的 .xlsx
  app.get(
    '/api/schedules/export',
    { schema: { response: { 200: Type.Any(), 403: Type.Any(), 500: Type.Any() } } },
    async (req, reply) => {
      const user = await requirePermission(req, reply, 'shift_view');
      if (!user) return;
      const q = req.query as { startDate?: string; endDate?: string };
      const tree = await departmentRepo.listTree();
      const scope = buildScope(user.departmentId, tree);
      const schedules = await shiftRepo.listSchedules(scope, { startDate: q.startDate, endDate: q.endDate });
      const { buildScheduleWorkbook } = await import('./modules/shift/schedule-excel');
      const buffer = await buildScheduleWorkbook(schedules);
      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="schedules-${Date.now()}.xlsx"`)
        .send(buffer);
      return;
    },
  );

  // 导入排班 Excel（需 shift_manage）：body 内 base64 的 xlsx → 按姓名/班次名映射 → 批量落地
  app.post(
    '/api/schedules/import',
    {
      schema: {
        body: Type.Object({ file: Type.String({ minLength: 1 }) }),
        response: { 200: Type.Any(), 403: Type.Any(), 201: Type.Any(), 500: Type.Any() },
      },
    },
    async (req, reply) => {
      const actor = await requirePermission(req, reply, 'shift_manage');
      if (!actor) return;
      const tree = await departmentRepo.listTree();
      const scope = buildScope(actor.departmentId, tree);
      const { parseScheduleWorkbook, mapImportRows } = await import('./modules/shift/schedule-excel');
      let buffer: Buffer;
      try {
        buffer = Buffer.from(req.body.file, 'base64');
      } catch {
        return reply.status(400).send(fail('文件数据无效'));
      }
      const rows = await parseScheduleWorkbook(buffer);
      if (rows.length === 0) return reply.status(400).send(fail('未解析到有效排班数据'));
      // 用部门树解析的 scope 过滤可用员工，再按姓名映射待导入行
      const users = await rbacRepo.listUsers();
      const usersInScope = users.filter((u) =>
        u.departmentId == null ? scope.kind === 'all' : scopeIncludes(scope, u.departmentId),
      );
      const shiftsAll = await shiftRepo.listShifts(scope);
      const { rows: mapped, skipped } = mapImportRows(rows, usersInScope, shiftsAll);
      if (mapped.length === 0) return reply.status(400).send(fail('未找到可导入的排班（员工或班次不匹配）'));
      const count = await shiftRepo.batchUpsertSchedules(mapped);
      const targetIds = new Set(mapped.map((m) => m.userId));
      for (const uid of targetIds) {
        notify?.({ userId: uid }, 'notification', { kind: 'info', title: '排班通知', message: '你的排班已通过 Excel 批量导入更新' });
      }
      return reply.status(201).send(okay({ count, skipped }));
    },
  );

  return app;
}