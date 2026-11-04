// T24 · 权限点落库 + 真实业务数据种子（幂等，可重复执行）
// 用法: node --env-file=.env --import tsx prisma/seed.ts
// 或:   pnpm --filter @lei/backend exec prisma db seed
//
// 注意：业务演示数据与后端 e2e 的"全库清表"模式互斥——
// 跑完整后端测试后演示数据会被测试清理，需重新执行本 seed 恢复。
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { seedRealData } from './seed-real-data';
import { BUSINESS_WORKFLOWS } from '../src/approval/workflow-codes';

// ===== 权限点全集（操作级粒度，对齐各 controller @RequirePermission 实际使用） =====
export const PERMISSIONS = [
  // ---- 人事管理（employee）----
  { code: 'employee:view', name: '员工查看', module: 'employee', type: 'menu' },
  { code: 'employee:manage', name: '员工管理', module: 'employee', type: 'api' },
  { code: 'department:manage', name: '部门管理', module: 'employee', type: 'api' },
  { code: 'position:manage', name: '职位管理', module: 'employee', type: 'api' },

  // ---- 员工异动（onboarding/resignation/transfer/probation）----
  { code: 'onboarding:view', name: '入职查看', module: 'employee', type: 'api' },
  { code: 'onboarding:manage', name: '入职管理', module: 'employee', type: 'api' },
  { code: 'resignation:view', name: '离职查看', module: 'employee', type: 'api' },
  { code: 'resignation:apply', name: '离职申请', module: 'employee', type: 'api' },
  { code: 'transfer:view', name: '调动查看', module: 'employee', type: 'api' },
  { code: 'transfer:manage', name: '调动管理', module: 'employee', type: 'api' },
  { code: 'probation:view', name: '试用期查看', module: 'employee', type: 'api' },
  { code: 'probation:manage', name: '试用期管理', module: 'employee', type: 'api' },
  { code: 'probation:apply', name: '转正申请', module: 'employee', type: 'api' },

  // ---- 合同与证件（contract/certificate/cert_request）----
  { code: 'contract:view', name: '合同查看', module: 'employee', type: 'api' },
  { code: 'contract:manage', name: '合同管理', module: 'employee', type: 'api' },
  { code: 'certificate:view', name: '证件查看', module: 'employee', type: 'api' },
  { code: 'certificate:manage', name: '证件管理', module: 'employee', type: 'api' },
  { code: 'cert_request:view', name: '证照申请查看', module: 'employee', type: 'api' },
  { code: 'cert_request:manage', name: '证照申请管理', module: 'employee', type: 'api' },

  // ---- 培训与奖惩（training/reward）----
  { code: 'training:view', name: '培训查看', module: 'employee', type: 'api' },
  { code: 'training:manage', name: '培训管理', module: 'employee', type: 'api' },
  { code: 'reward:view', name: '奖惩查看', module: 'employee', type: 'api' },
  { code: 'reward:manage', name: '奖惩管理', module: 'employee', type: 'api' },

  // ---- 考勤管理（attendance）----
  { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
  { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'api' },
  { code: 'attendance:appeal:view', name: '申诉查看', module: 'attendance', type: 'api' },
  { code: 'attendance:appeal:apply', name: '申诉申请', module: 'attendance', type: 'api' },

  // ---- 假期管理（vacation）----
  { code: 'vacation:balance:adjust', name: '假期额度调整', module: 'vacation', type: 'api' },
  { code: 'vacation:manage', name: '假期设置', module: 'vacation', type: 'api' },

  // ---- 考勤异常 / 扣款规则（attendance-exception）----
  { code: 'attendance:exception:view', name: '考勤异常查看', module: 'attendance', type: 'menu' },
  { code: 'attendance:exception:manage', name: '考勤异常管理', module: 'attendance', type: 'api' },
  { code: 'attendance:deduction:view', name: '扣款规则查看', module: 'attendance', type: 'menu' },
  { code: 'attendance:deduction:manage', name: '扣款规则管理', module: 'attendance', type: 'api' },
  { code: 'attendance:location:manage', name: '打卡定位管理', module: 'attendance', type: 'api' },

  // ---- 绩效管理（performance）----
  { code: 'performance:view', name: '绩效查看', module: 'performance', type: 'menu' },
  { code: 'performance:manage', name: '绩效管理', module: 'performance', type: 'api' },
  { code: 'performance:cycle:manage', name: '绩效周期管理', module: 'performance', type: 'api' },
  { code: 'performance:goal:manage', name: '绩效目标管理', module: 'performance', type: 'api' },
  { code: 'performance:review:manage', name: '绩效评审管理', module: 'performance', type: 'api' },
  { code: 'okr:view', name: 'OKR 查看', module: 'performance', type: 'menu' },
  { code: 'okr:manage', name: 'OKR 管理', module: 'performance', type: 'api' },

  // ---- 财务预算 / 费用标准（finance）----
  { code: 'finance:budget:view', name: '预算查看', module: 'finance', type: 'menu' },
  { code: 'finance:budget:manage', name: '预算管理', module: 'finance', type: 'api' },
  { code: 'finance:expense-standard:view', name: '费用标准查看', module: 'finance', type: 'menu' },
  { code: 'finance:expense-standard:manage', name: '费用标准管理', module: 'finance', type: 'api' },

  // ---- 工单客服（helpdesk）----
  { code: 'helpdesk:view', name: '工单查看', module: 'helpdesk', type: 'menu' },
  { code: 'helpdesk:manage', name: '工单管理', module: 'helpdesk', type: 'api' },
  { code: 'helpdesk:sla:manage', name: '工单 SLA 管理', module: 'helpdesk', type: 'api' },

  // ---- 员工标签（employee-tag）----
  { code: 'employee:tag:manage', name: '员工标签管理', module: 'employee', type: 'api' },

  // ---- 审批中心（approval）----
  { code: 'approval:todo:view', name: '我的待办查看', module: 'approval', type: 'menu' },
  { code: 'approval:submitted:view', name: '我的申请查看', module: 'approval', type: 'menu' },
  { code: 'approval:workflow:manage', name: '审批流程管理', module: 'approval', type: 'api' },
  { code: 'approval:apply', name: '发起审批', module: 'approval', type: 'api' },
  { code: 'approval:process', name: '审批处理', module: 'approval', type: 'api' },
  { code: 'approval:manage', name: '审批管理', module: 'approval', type: 'api' },

  // ---- 薪酬管理（payroll）----
  { code: 'payroll:view', name: '薪资查看', module: 'payroll', type: 'menu' },
  { code: 'payroll:manage', name: '薪资管理', module: 'payroll', type: 'api' },
  { code: 'payroll:my:view', name: '我的工资条', module: 'payroll', type: 'api' },

  // ---- 报销管理（reimbursement）----
  { code: 'reimbursement:view', name: '报销查看', module: 'reimbursement', type: 'menu' },
  { code: 'reimbursement:create', name: '报销申请', module: 'reimbursement', type: 'api' },
  { code: 'reimbursement:approve', name: '报销审批', module: 'reimbursement', type: 'api' },
  { code: 'reimbursement:manage', name: '报销配置管理', module: 'reimbursement', type: 'api' },

  // ---- 知识库（knowledge）----
  { code: 'knowledge:view', name: '知识库查看', module: 'knowledge', type: 'menu' },
  { code: 'knowledge:manage', name: '知识库管理', module: 'knowledge', type: 'api' },

  // ---- 通用文件（files）----
  { code: 'file:upload', name: '文件上传', module: 'system', type: 'api' },
  { code: 'file:view', name: '文件查看', module: 'system', type: 'api' },

  // ---- 报表（reports）----
  { code: 'reports:view', name: '报表查看', module: 'reports', type: 'menu' },

  // ---- 系统管理（system）----
  { code: 'system:user:view', name: '用户查看', module: 'system', type: 'menu' },
  { code: 'system:user:manage', name: '用户管理', module: 'system', type: 'api' },
  { code: 'system:role:view', name: '角色查看', module: 'system', type: 'menu' },
  { code: 'system:role:manage', name: '角色管理', module: 'system', type: 'api' },
  { code: 'system:broadcast:manage', name: '公告管理', module: 'system', type: 'api' },
  { code: 'system:log:view', name: '操作日志查看', module: 'system', type: 'api' },
  { code: 'system:setting:view', name: '系统设置查看', module: 'system', type: 'api' },
  { code: 'system:setting:update', name: '系统设置修改', module: 'system', type: 'api' },
  { code: 'system:config:edit', name: '系统配置编辑', module: 'system', type: 'api' },
  { code: 'system:notification:settings', name: '通知设置管理', module: 'system', type: 'api' },
  { code: 'system:notification:send', name: '通知发送', module: 'system', type: 'api' },

  // ---- 数据字典（dict）----
  { code: 'dict:view', name: '字典查看', module: 'system', type: 'api' },
  { code: 'dict:manage', name: '字典管理', module: 'system', type: 'api' },

  // ---- 个人中心（personal）----
  { code: 'personal:leave:apply', name: '我的请假申请', module: 'personal', type: 'api' },
  { code: 'personal:overtime:apply', name: '我的加班申请', module: 'personal', type: 'api' },
  { code: 'personal:makeup:apply', name: '我的补卡申请', module: 'personal', type: 'api' },
  { code: 'personal:attendance:view', name: '我的考勤查看', module: 'personal', type: 'api' },
  { code: 'personal:notification:view', name: '我的通知查看', module: 'personal', type: 'api' },
  { code: 'personal:profile:update', name: '个人资料修改', module: 'personal', type: 'api' },
] as const;

export const ADMIN_PERMISSIONS: string[] = PERMISSIONS.map((p) => p.code);

export const STAFF_PERMISSIONS: string[] = [
  // 人事：仅查看
  'employee:view',
  // 考勤：仅查看
  'attendance:view',
  // 个人中心：自助申请和查看
  'personal:leave:apply',
  'personal:overtime:apply',
  'personal:makeup:apply',
  'personal:attendance:view',
  'personal:notification:view',
  'personal:profile:update',
  // 报销：申请
  'reimbursement:view',
  'reimbursement:create',
  // 通用文件：上传/查看（报销附件）
  'file:upload',
  'file:view',
  // 知识库：查看
  'knowledge:view',
  // 工资条
  'payroll:my:view',
  // 审批：查看待办/申请；发起审批（approval:apply）；
  // 处理待办（approval:process，staff 含审批人场景，见 ADR-0019）
  'approval:todo:view',
  'approval:submitted:view',
  'approval:apply',
  'approval:process',
];

/**
 * 是否写入演示数据。
 * 未设置时默认开启（开发/试用不变）；生产初始化设 SEED_DEMO=false，
 * 只建权限点/角色/管理员/部门/默认审批流程等基础数据。
 */
export function isDemoSeedEnabled(): boolean {
  return process.env.SEED_DEMO !== 'false';
}

/** 权限点 + 角色绑定（幂等：upsert 权限点，重建 admin/staff 的角色绑定） */
export async function seedPermissions(
  prisma: PrismaClient,
  options: { demo?: boolean } = {},
) {
  const demo = options.demo ?? isDemoSeedEnabled();
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module, type: p.type },
      create: { code: p.code, name: p.name, module: p.module, type: p.type },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: '管理员' },
  });
  const staffRole = await prisma.role.upsert({
    where: { code: 'staff' },
    update: {},
    create: { code: 'staff', name: '普通员工' },
  });

  // 重建绑定（先清后插，保证与常量一致、幂等）
  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: [adminRole.id, staffRole.id] } },
  });
  const perms = await prisma.permission.findMany();
  const permId = (code: string) => perms.find((p) => p.code === code)!.id;
  await prisma.rolePermission.createMany({
    data: [
      ...ADMIN_PERMISSIONS.map((code) => ({
        roleId: adminRole.id,
        permissionId: permId(code),
      })),
      ...STAFF_PERMISSIONS.map((code) => ({
        roleId: staffRole.id,
        permissionId: permId(code),
      })),
    ],
  });

  // 管理员账号：无论是否演示数据都必须存在，否则系统无人可登录
  // （初始密码 123456，首次登录务必修改）
  const hash = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, realName: '系统管理员' },
    create: { username: 'admin', passwordHash: hash, realName: '系统管理员', status: 'active' },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // 演示账号 staff：仅演示数据开启时创建
  let staff: { id: number } | null = null;
  if (demo) {
    staff = await prisma.user.upsert({
      where: { username: 'staff' },
      update: { passwordHash: hash, realName: '王小明' },
      create: { username: 'staff', passwordHash: hash, realName: '王小明', status: 'active' },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: staff.id, roleId: staffRole.id } },
      update: {},
      create: { userId: staff.id, roleId: staffRole.id },
    });
  }

  // 重建权限绑定后失效相关用户的 Redis 权限缓存，
  // 避免已登录用户继续使用旧权限（按钮无反应 / 菜单不全）
  await invalidateUserPermCache(staff ? [admin.id, staff.id] : [admin.id]);

  return { admin, staff };
}

/**
 * 根据 userIds 构造 Redis 权限缓存 key 列表（纯函数，便于测试）。
 * 与 backend/src/common/permission-cache.service.ts 的 USER_PERM_CACHE_KEY_PREFIX 保持一致。
 */
export function buildUserPermCacheKeys(userIds: number[], keyPrefix = 'leixi:'): string[] {
  return userIds.map((id) => `${keyPrefix}user:perm:${id}`);
}

/**
 * 删除指定用户的 Redis 权限缓存键。
 * seed 脚本不通过 NestJS DI，直接用 ioredis 连接 REDIS_URL；
 * Redis 未配置或不可用时静默跳过（与 PermissionCacheService 一致）。
 */
export async function invalidateUserPermCache(
  userIds: number[],
  options: {
    redisUrl?: string;
    keyPrefix?: string;
    clientFactory?: (url: string) => Pick<Redis, 'connect' | 'del' | 'quit'>;
  } = {},
): Promise<void> {
  const url = options.redisUrl ?? process.env.REDIS_URL;
  if (!url) return;
  const prefix = options.keyPrefix ?? process.env.REDIS_KEY_PREFIX ?? 'leixi:';
  const factory = options.clientFactory ?? ((u: string) => new Redis(u, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  }) as unknown as Pick<Redis, 'connect' | 'del' | 'quit'>);
  const client = factory(url);
  try {
    await client.connect();
    const keys = buildUserPermCacheKeys(userIds, prefix);
    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[seed] 已失效 Redis 权限缓存: ${keys.length} 个用户`);
    }
  } catch (err: any) {
    console.warn(`[seed] 失效权限缓存失败（忽略）: ${err.message}`);
  } finally {
    try {
      await client.quit();
    } catch {
      // ignore
    }
  }
}

/** 非演示初始化：至少保证有一个可挂靠的部门（否则无法建员工/挂考勤） */
async function ensureBaseDepartment(prisma: PrismaClient) {
  const existing = await prisma.department.findFirst({ where: { name: '总部' } });
  if (!existing) {
    await prisma.department.create({
      data: { name: '总部', description: '系统初始化默认部门' },
    });
  }
}

/** 基础 + 业务数据（幂等：唯一键 upsert / createMany skipDuplicates / findFirst 跳过） */
export async function seedBusiness(
  prisma: PrismaClient,
  options: { demo?: boolean } = {},
) {
  const demo = options.demo ?? isDemoSeedEnabled();
  const { admin, staff } = await seedPermissions(prisma, { demo });

  if (demo) {
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: 'staff' } });

    // ---- 1) 演示业务数据：部门/职位/30 名员工（各绑定 User 账号）/员工事务/履历/变动流水/考勤/薪资/报销 ----
    await seedRealData(prisma, {
      adminUser: { id: admin.id },
      staffUser: { id: staff!.id },
      staffRoleId: staffRole.id,
    });
  } else {
    // ---- 1) 非演示初始化：不写演示组织与员工，只保证基础部门存在 ----
    await ensureBaseDepartment(prisma);
  }

  // ---- 系统设置 ----
  const systemSettings = [
    { key: 'company_name', value: '雷犀科技', label: '公司名称', group: 'general', description: '显示在系统标题处的公司名称' },
    { key: 'system.name', value: '雷犀管理系统', label: '系统名称', group: 'general', description: '登录页与侧边栏显示的系统名称' },
    { key: 'system.logo', value: '', label: '系统 Logo', group: 'general', description: '登录页与侧边栏显示的 Logo 图片(相对路径或URL)' },
    { key: 'company_address', value: '北京市朝阳区科技园区A座', label: '公司地址', group: 'general', description: '公司办公地址' },
    { key: 'workday_per_week', value: '5', label: '每周工作日', group: 'attendance', description: '标准每周工作天数' },
    { key: 'default_work_start', value: '09:00', label: '默认上班时间', group: 'attendance', description: '默认班次的上班打卡时间' },
    { key: 'default_work_end', value: '18:00', label: '默认下班时间', group: 'attendance', description: '默认班次的下班打卡时间' },
    { key: 'lunch_break_start', value: '12:00', label: '午休开始时间', group: 'attendance', description: '午休开始时间，不计入工作时长' },
    { key: 'lunch_break_end', value: '13:30', label: '午休结束时间', group: 'attendance', description: '午休结束时间' },
    { key: 'late_tolerance_minutes', value: '10', label: '迟到宽限(分钟)', group: 'attendance', description: '迟到多少分钟内不算迟到' },
    { key: 'early_leave_tolerance_minutes', value: '10', label: '早退宽限(分钟)', group: 'attendance', description: '早退多少分钟内不算早退' },
    { key: 'overtime_to_leave_hours', value: '8', label: '加班转调休(小时/天)', group: 'attendance', description: '累计多少加班小时折算为1天调休假期' },
    { key: 'password_min_length', value: '6', label: '密码最小长度', group: 'security', description: '用户密码最小字符数' },
    { key: 'password_require_complex', value: 'false', label: '密码复杂度要求', group: 'security', description: '是否要求包含大小写字母和数字' },
    { key: 'login_max_attempts', value: '5', label: '最大登录尝试次数', group: 'security', description: '连续失败多少次后锁定账号' },
    { key: 'session_timeout_minutes', value: '120', label: '会话超时(分钟)', group: 'security', description: '无操作多少分钟后自动退出' },
  ];

  for (const s of systemSettings) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await prisma.systemSetting.create({ data: s });
    }
  }

  // ---- 休假类型 + 额度 ----
  // 年假为「年度型」：不配 monthlyDays（否则被 isMonthlyDays 判为月假，month=0 年度额度与跨年结转都不会生效），
  // 额度取 baseDays，配 carryOverMaxDays 使其参与跨年结转。
  // isPaid：有薪假不取消全勤奖（年假/病假/调休），无薪假取消（事假）。
  // 缺省 false，故此处必须显式标出有薪类型，否则全勤奖会被年假误取消。
  const vacationTypes = [
  { code: 'annual', name: '年假', baseDays: 10, carryOverMaxDays: 3, isPaid: true },
  { code: 'sick', name: '病假', baseDays: 0, isPaid: true },
  { code: 'personal', name: '事假', baseDays: 0, isPaid: false },
  { code: 'compensatory', name: '调休', baseDays: 0, isPaid: true },
];
  const vacTypeIds: Record<string, number> = {};
  for (const t of vacationTypes) {
    const vt = await prisma.vacationType.upsert({
      where: { code: t.code },
      update: { isPaid: t.isPaid },
      create: t,
    });
    vacTypeIds[t.code] = vt.id;
  }
  const annualEmps = await prisma.employee.findMany({
    where: { employeeNo: { in: ['E001', 'E002', 'E006', 'E013', 'E017', 'E024', 'E029'] } },
  });
  for (const emp of annualEmps) {
    // 年假年度额度：单条 month=0（与 initializeYearBalances / calculateAnnualLeaveDays 口径一致）
    await prisma.vacationBalance.upsert({
      where: {
        employeeId_vacationTypeId_year_month: {
          employeeId: emp.id,
          vacationTypeId: vacTypeIds['annual'],
          year: 2026,
          month: 0,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        vacationTypeId: vacTypeIds['annual'],
        year: 2026,
        month: 0,
        totalDays: 10,
        usedDays: 0,
      },
    });
  }

  // ---- 默认审批流程：按业务流程登记表逐条幂等补齐（ADR-0020）----
  // 业务侧发起审批时硬编码 workflowCode，缺流程会直接「审批流不存在」；
  // 这里为每个登记业务铺一条可用默认流程，管理员可在流程设置页调整节点。
  const wfByCode = new Map<string, { id: number }>();
  const nodeByCode = new Map<string, { id: number }>();
  for (const biz of BUSINESS_WORKFLOWS) {
    const w = await prisma.approvalWorkflow.upsert({
      where: { code: biz.code },
      // update 只做「复活」：流程被管理员软删后，重跑 seed 必须能恢复，
      // 否则该业务从此发起审批都直接 404「审批流不存在」，而种子看起来是成功的。
      // 名称/模块/节点不动，避免覆盖管理员在设置页的配置。
      update: { deletedAt: null },
      create: { code: biz.code, name: biz.name, module: biz.module, status: 'active' },
    });
    // 只在「流程下还没有任何节点」时铺默认节点。
    // 不能用 upsert(update:{}) 按 nodeKey 补：管理员在设置页改过节点后，原来的
    // manager 节点已被 updateWorkflow 整体重建删除，重跑 seed 会把它复活成
    // order=1，与管理员配置的节点撞同一个 order（审批链按 order 排序，两道都会进链）。
    let n = await prisma.approvalWorkflowNode.findFirst({ where: { workflowId: w.id } });
    if (!n) {
      n = await prisma.approvalWorkflowNode.create({
        data: {
          workflowId: w.id,
          nodeKey: 'manager',
          name: '直属上级审批',
          type: 'role',
          roleCode: 'admin',
          order: 1,
        },
      });
    }
    wfByCode.set(biz.code, w);
    nodeByCode.set(biz.code, n);
  }
  // ---- 审批演示单（演示内容，SEED_DEMO=false 时跳过）----
  if (demo) {
    const wf = wfByCode.get('leave')!;
    const node = nodeByCode.get('leave')!;
    const empE1 = await prisma.employee.findUniqueOrThrow({ where: { employeeNo: 'E013' } });
    const staffDept = await prisma.department.findFirstOrThrow({ where: { name: '客服部' } });
    const demoInstances = [
      { title: '演示请假1-年假-8月20日', start: '2026-08-20', days: 1, status: 'pending' as const },
      { title: '演示请假2-事假-8月22日', start: '2026-08-22', days: 0.5, status: 'pending' as const },
      { title: '演示请假3-年假-8月5日(已通过)', start: '2026-08-05', days: 2, status: 'approved' as const },
    ];
    for (const it of demoInstances) {
      const existing = await prisma.approvalInstance.findFirst({ where: { title: it.title } });
      if (existing) continue;
      const inst = await prisma.approvalInstance.create({
        data: {
          workflowId: wf.id,
          workflowCode: 'leave',
          title: it.title,
          applicantId: staff!.id,
          applicantName: '王小明',
          departmentId: staffDept.id,
          status: it.status,
          currentNodeKey: it.status === 'pending' ? 'manager' : null,
          currentNodeName: it.status === 'pending' ? '直属上级审批' : null,
        },
      });
      await prisma.approvalRecord.create({
        data: {
          instanceId: inst.id,
          nodeId: node.id,
          nodeKey: 'manager',
          nodeName: '直属上级审批',
          status: it.status === 'pending' ? 'pending' : 'approved',
          approverId: it.status === 'approved' ? admin.id : null,
          approverName: it.status === 'approved' ? '管理员' : null,
          handledAt: it.status === 'approved' ? new Date('2026-08-06') : null,
          comment: it.status === 'approved' ? '同意' : null,
          order: 1,
        },
      });
      await prisma.leaveRecord.create({
        data: {
          employeeId: empE1.id,
          vacationTypeId: vacTypeIds[it.title.includes('事假') ? 'personal' : 'annual'],
          startDate: new Date(it.start),
          endDate: new Date(it.start),
          days: it.days,
          // 演示假（年假/事假）均为年度型额度：按 createLeave 口径固定 month=0。
          // 原先用本地 getMonth()+1 既与口径不符（年度型额度只认 month=0 那一行），
          // 也会在负时区宿主机上把 UTC 午夜的月初日期串到上一个月。
          month: 0,
          reason: '演示请假数据',
          status: it.status,
        },
      });
    }
  }

  // ---- 知识库 / 公告（演示内容，SEED_DEMO=false 时跳过）----
  if (demo) {
    const catRows = [
      { name: '入职指南', sortOrder: 1 },
      { name: '制度手册', sortOrder: 2 },
      { name: 'FAQ', sortOrder: 3 },
    ];
    const catIds: Record<string, number> = {};
    for (const c of catRows) {
      let cat = await prisma.knowledgeCategory.findFirst({ where: { name: c.name } });
      if (!cat) cat = await prisma.knowledgeCategory.create({ data: c });
      catIds[c.name] = cat.id;
    }
    const articles: Array<[string, string, string]> = [
      ['新员工入职流程', '入职指南', '欢迎入职！请按以下步骤办理：1. 领取工牌；2. 加入部门群；3. 完成系统账号激活。'],
      ['考勤打卡规范', '制度手册', '工作日上下班需使用打卡机考勤，迟到/早退将计入考勤记录，月度汇总后与薪资挂钩。'],
      ['如何申请年假？', 'FAQ', '年假申请路径：考勤 → 休假 → 新建请假申请，选择年假类型并提交审批。'],
    ];
    for (const [title, catName, content] of articles) {
      const ex = await prisma.knowledgeArticle.findFirst({ where: { title } });
      if (!ex) {
        await prisma.knowledgeArticle.create({
          data: { categoryId: catIds[catName], title, content, createdBy: admin.id },
        });
      }
    }

    const bc = await prisma.broadcast.findFirst({
      where: { title: '欢迎使用雷犀客服管理系统' },
    });
    if (!bc) {
      await prisma.broadcast.create({
        data: {
          title: '欢迎使用雷犀客服管理系统',
          content: '系统已上线，请各位同事及时查看公告、完善个人资料。',
          status: 'published',
          type: 'notice',
          createdBy: admin.id,
          publishedBy: admin.id,
          publishedAt: new Date(),
        },
      });
    }
  }

  // ---- 员工编号序列初始化（幂等）----
  // 取现有 EMP 工号的**最大值**（而非最后一条记录），避免与人工工号区间重叠
  const empRows = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: 'EMP' } },
    select: { employeeNo: true },
  });
  const currentMax = empRows.reduce((max, row) => {
    const matched = /^EMP(\d+)$/.exec(row.employeeNo ?? '');
    const value = matched ? parseInt(matched[1], 10) : 0;
    return value > max ? value : max;
  }, 0);
  await prisma.sequence.upsert({
    where: { name: 'employee_no' },
    update: {},
    create: {
      name: 'employee_no',
      currentValue: currentMax,
      step: 1,
      description: '员工编号序列',
    },
  });
}

export async function main(prisma = new PrismaClient()) {
  try {
    const demo = isDemoSeedEnabled();
    // 权限点/角色/账号由 seedBusiness 内部首步完成（它需要 admin 账号 id 建演示数据）
    await seedBusiness(prisma, { demo });
    const [
      employees, departments, shifts, schedules, punches, dailies,
      payrollRuns, payslips, approvals, leaves, articles, broadcasts,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.department.count(),
      prisma.shift.count(),
      prisma.schedule.count(),
      prisma.punchLog.count(),
      prisma.attendanceDaily.count(),
      prisma.payrollRun.count(),
      prisma.payslip.count(),
      prisma.approvalInstance.count(),
      prisma.leaveRecord.count(),
      prisma.knowledgeArticle.count(),
      prisma.broadcast.count(),
    ]);
    console.log('[seed] 完成（幂等，可重复执行）');
    console.log(
      `[seed] 员工=${employees} 部门=${departments} 班次=${shifts} 排班=${schedules} 打卡=${punches} 日报=${dailies}`,
    );
    console.log(
      `[seed] 薪资批次=${payrollRuns} 工资条=${payslips} 审批单=${approvals} 请假单=${leaves} 知识库=${articles} 公告=${broadcasts}`,
    );
    console.log(
      `[seed] 模式：${demo ? '演示数据（SEED_DEMO 未关闭）' : '仅基础数据（SEED_DEMO=false）'}`,
    );
    if (demo) {
      console.log('[seed] 演示账号: admin/123456（全部权限） staff/123456（员工+考勤+知识库）');
    } else {
      console.log('[seed] 管理员账号: admin/123456（全部权限，首次登录请立即修改密码）');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[seed] 失败:', e);
    process.exit(1);
  });
}
