// T24 · 权限点落库 + 演示数据种子（幂等，可重复执行）
// 用法: node --env-file=.env --import tsx prisma/seed.ts
// 或:   pnpm --filter @lei/backend exec prisma db seed
//
// 注意：业务演示数据与后端 e2e 的"全库清表"模式互斥——
// 跑完整后端测试后演示数据会被测试清理，需重新执行本 seed 恢复。
import { PrismaClient, Prisma, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
  { code: 'approval:manage', name: '审批管理', module: 'approval', type: 'api' },

  // ---- 薪酬管理（payroll）----
  { code: 'payroll:view', name: '薪资查看', module: 'payroll', type: 'menu' },
  { code: 'payroll:manage', name: '薪资管理', module: 'payroll', type: 'api' },
  { code: 'payroll:my:view', name: '我的工资条', module: 'payroll', type: 'api' },

  // ---- 报销管理（reimbursement）----
  { code: 'reimbursement:view', name: '报销查看', module: 'reimbursement', type: 'menu' },
  { code: 'reimbursement:create', name: '报销申请', module: 'reimbursement', type: 'api' },
  { code: 'reimbursement:approve', name: '报销审批', module: 'reimbursement', type: 'api' },

  // ---- 知识库（knowledge）----
  { code: 'knowledge:view', name: '知识库查看', module: 'knowledge', type: 'menu' },
  { code: 'knowledge:manage', name: '知识库管理', module: 'knowledge', type: 'api' },

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
  // 知识库：查看
  'knowledge:view',
  // 工资条
  'payroll:my:view',
  // 审批：我的待办/我的申请
  'approval:todo:view',
  'approval:submitted:view',
];

/** 权限点 + 角色绑定（幂等：upsert 权限点，重建 admin/staff 的角色绑定） */
export async function seedPermissions(prisma: PrismaClient) {
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

  // 演示账号（灰度试用密码，首次登录建议修改）
  const hash = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, realName: '系统管理员' },
    create: { username: 'admin', passwordHash: hash, realName: '系统管理员', status: 'active' },
  });
  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: { passwordHash: hash, realName: '王小明' },
    create: { username: 'staff', passwordHash: hash, realName: '王小明', status: 'active' },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: staff.id, roleId: staffRole.id } },
    update: {},
    create: { userId: staff.id, roleId: staffRole.id },
  });

  return { admin, staff };
}

/** 演示业务数据（幂等：唯一键 upsert / createMany skipDuplicates / findFirst 跳过） */
export async function seedBusiness(prisma: PrismaClient) {
  const { admin, staff } = await seedPermissions(prisma);

  // ---- 系统设置 ----
  const systemSettings = [
    { key: 'company_name', value: '雷犀科技', label: '公司名称', group: 'general', description: '显示在系统标题处的公司名称' },
    { key: 'company_address', value: '北京市朝阳区科技园区A座', label: '公司地址', group: 'general', description: '公司办公地址' },
    { key: 'workday_per_week', value: '5', label: '每周工作日', group: 'attendance', description: '标准每周工作天数' },
    { key: 'default_work_start', value: '09:00', label: '默认上班时间', group: 'attendance', description: '默认班次的上班打卡时间' },
    { key: 'default_work_end', value: '18:00', label: '默认下班时间', group: 'attendance', description: '默认班次的下班打卡时间' },
    { key: 'lunch_break_start', value: '12:00', label: '午休开始时间', group: 'attendance', description: '午休开始时间，不计入工作时长' },
    { key: 'lunch_break_end', value: '13:30', label: '午休结束时间', group: 'attendance', description: '午休结束时间' },
    { key: 'late_tolerance_minutes', value: '10', label: '迟到宽限(分钟)', group: 'attendance', description: '迟到多少分钟内不算迟到' },
    { key: 'early_leave_tolerance_minutes', value: '10', label: '早退宽限(分钟)', group: 'attendance', description: '早退多少分钟内不算早退' },
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

  // ---- 组织 ----
  const depNames = ['技术部', '客服部', '人事财务部'];
  const deps: number[] = [];
  for (const name of depNames) {
    let d = await prisma.department.findFirst({ where: { name } });
    if (!d) d = await prisma.department.create({ data: { name } });
    deps.push(d.id);
  }

  const posNames = ['产品经理', '开发工程师', '客服专员', '财务专员', '人事专员'];
  const posIds: Record<string, number> = {};
  for (const name of posNames) {
    let p = await prisma.position.findFirst({ where: { name } });
    if (!p) p = await prisma.position.create({ data: { name } });
    posIds[name] = p.id;
  }

  // ---- 员工（30 人，E001-E030）----
  const empNames = [
    '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏', '周涛', '吴倩',
    '徐强', '孙丽', '马超', '朱婷', '胡军', '郭雪', '何平', '高翔', '林峰', '罗燕',
    '郑浩', '梁欣', '谢鹏', '宋佳', '唐明', '韩雪', '冯磊', '董雯', '萧然', '程亮',
  ];
  const deptOf = (i: number) => (i < 12 ? deps[0] : i < 24 ? deps[1] : deps[2]);
  const posOf = (i: number) =>
    i < 12
      ? i % 4 === 0
        ? posIds['产品经理']
        : posIds['开发工程师']
      : i < 24
        ? posIds['客服专员']
        : i % 2 === 0
          ? posIds['财务专员']
          : posIds['人事专员'];

  const employees: { id: number; employeeNo: string; salary: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const employeeNo = `E${String(i + 1).padStart(3, '0')}`;
    const salary = 5200 + ((i * 137) % 70) * 100; // 5200 ~ 12100
    const emp = await prisma.employee.upsert({
      where: { employeeNo },
      update: {},
      create: {
        employeeNo,
        name: empNames[i],
        departmentId: deptOf(i),
        positionId: posOf(i),
        hireDate: new Date(2023 + (i % 3), (i * 3) % 12, ((i * 7) % 27) + 1),
        salary,
        status: EmployeeStatus.active,
        // E001 绑定 staff 演示账号（我的申请/我的工资条视角）
        userId: i === 0 ? staff.id : undefined,
      },
    });
    employees.push({ id: emp.id, employeeNo, salary });
  }

  // ---- 班次（对齐旧项目字段）----
  const shifts = [
    { name: '早班', startTime: '09:00', endTime: '18:00', restDuration: 60, lateThreshold: 15, earlyThreshold: 15, useGlobalThreshold: true, color: '#3B82F6', description: '标准早班 9:00-18:00', isActive: true },
    { name: '晚班', startTime: '13:00', endTime: '22:00', restDuration: 60, lateThreshold: 15, earlyThreshold: 15, useGlobalThreshold: true, color: '#F59E0B', description: '下午班次 13:00-22:00', isActive: true },
    { name: '行政班', startTime: '09:00', endTime: '17:30', restDuration: 60, lateThreshold: 10, earlyThreshold: 10, useGlobalThreshold: true, color: '#10B981', description: '行政班次 9:00-17:30', isActive: true },
  ];
  const shiftIds: number[] = [];
  for (const s of shifts) {
    const sh = await prisma.shift.upsert({ where: { name: s.name }, update: {}, create: s });
    shiftIds.push(sh.id);
  }

  // ---- 近 30 天工作日 ----
  const workDates: Date[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    workDates.push(d);
  }

  // ---- 排班 ----
  const scheduleRows = [];
  for (let i = 0; i < employees.length; i++) {
    for (const wd of workDates) {
      scheduleRows.push({ employeeId: employees[i].id, shiftId: shiftIds[i % 3], workDate: wd });
    }
  }
  await prisma.schedule.createMany({ data: scheduleRows, skipDuplicates: true });

  // ---- 打卡（每天上班/下班两条，DEMO 设备）----
  const punchRows: Prisma.PunchLogCreateManyInput[] = [];
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    for (const wd of workDates) {
      const inT = new Date(wd);
      inT.setHours(8, 45 + (i % 16), 0, 0); // 8:45~9:00
      const outT = new Date(wd);
      outT.setHours(18, 0 + (i % 13), 0, 0);
      punchRows.push({
        employeeNo: emp.employeeNo,
        deviceNo: 'DEMO-001',
        punchTime: inT,
        punchType: 'in',
        source: 'import',
        status: 'matched',
      });
      punchRows.push({
        employeeNo: emp.employeeNo,
        deviceNo: 'DEMO-001',
        punchTime: outT,
        punchType: 'out',
        source: 'import',
        status: 'matched',
      });
    }
  }
  await prisma.punchLog.createMany({ data: punchRows, skipDuplicates: true });

  // ---- 考勤日报（~6% 迟到）----
  const dailyRows: Prisma.AttendanceDailyCreateManyInput[] = [];
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const late = i % 17 === 0;
    for (const wd of workDates) {
      const inT = new Date(wd);
      inT.setHours(8, 50, 0, 0);
      const outT = new Date(wd);
      outT.setHours(18, 10, 0, 0);
      dailyRows.push({
        employeeId: emp.id,
        workDate: wd,
        firstPunch: inT,
        lastPunch: outT,
        punchCount: 2,
        lateMinutes: late ? 15 : 0,
        earlyMinutes: 0,
        overtimeMinutes: 0,
        leaveDays: 0,
        status: late ? 'late' : 'normal',
      });
    }
  }
  await prisma.attendanceDaily.createMany({ data: dailyRows, skipDuplicates: true });

  // ---- 休假类型 + 额度 ----
  const vacationTypes = [
    { code: 'annual', name: '年假', baseDays: 5 },
    { code: 'sick', name: '病假', baseDays: 0 },
    { code: 'personal', name: '事假', baseDays: 0 },
    { code: 'compensatory', name: '调休', baseDays: 0 },
  ];
  const vacTypeIds: Record<string, number> = {};
  for (const t of vacationTypes) {
    const vt = await prisma.vacationType.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
    vacTypeIds[t.code] = vt.id;
  }
  for (const emp of employees.slice(0, 10)) {
    await prisma.vacationBalance.upsert({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: emp.id,
          vacationTypeId: vacTypeIds['annual'],
          year: 2026,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        vacationTypeId: vacTypeIds['annual'],
        year: 2026,
        totalDays: 5,
        usedDays: 1,
      },
    });
  }

  // ---- 审批演示（请假 2 待审批 + 1 已通过；按 title 幂等跳过）----
  const wf = await prisma.approvalWorkflow.upsert({
    where: { code: 'leave' },
    update: {},
    create: { code: 'leave', name: '请假审批', module: 'attendance', status: 'active' },
  });
  const node = await prisma.approvalWorkflowNode.upsert({
    where: { workflowId_nodeKey: { workflowId: wf.id, nodeKey: 'manager' } },
    update: {},
    create: {
      workflowId: wf.id,
      nodeKey: 'manager',
      name: '直属上级审批',
      type: 'role',
      roleCode: 'admin',
      order: 1,
    },
  });
  const empE1 = await prisma.employee.findUniqueOrThrow({ where: { employeeNo: 'E001' } });
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
        applicantId: staff.id,
        applicantName: '王小明',
        departmentId: deps[1],
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
        reason: '演示请假数据',
        status: it.status,
      },
    });
  }

  // ---- 薪资批次（2026-07 confirmed）+ 明细 + 工资条 ----
  await prisma.salaryItem.upsert({
    where: { code: 'base' },
    update: {},
    create: { code: 'base', name: '基础工资', type: 'fixed' },
  });
  await prisma.salaryItem.upsert({
    where: { code: 'meal' },
    update: {},
    create: { code: 'meal', name: '餐补', type: 'fixed', amount: 300 },
  });
  const totalAmount = employees.reduce((sum, e) => sum + e.salary + 300, 0);
  const run = await prisma.payrollRun.upsert({
    where: { month: '2026-07' },
    update: {},
    create: {
      month: '2026-07',
      status: 'confirmed',
      totalEmployees: employees.length,
      totalAmount,
      checkedEmployeeIds: employees.slice(0, 3).map((e) => e.id),
      checkedBy: admin.id,
      checkedAt: new Date('2026-07-31'),
      confirmedBy: admin.id,
      confirmedAt: new Date('2026-08-01'),
      remark: '演示数据',
    },
  });
  const detailRows = [];
  for (const emp of employees) {
    detailRows.push({
      runId: run.id,
      employeeId: emp.id,
      itemCode: 'base',
      itemName: '基础工资',
      amount: emp.salary,
    });
    detailRows.push({
      runId: run.id,
      employeeId: emp.id,
      itemCode: 'meal',
      itemName: '餐补',
      amount: 300,
    });
  }
  await prisma.payrollDetail.createMany({ data: detailRows, skipDuplicates: true });
  const slipRows = employees.map((emp) => ({
    runId: run.id,
    employeeId: emp.id,
    month: '2026-07',
    totalAmount: emp.salary + 300,
    itemsJson: JSON.stringify([
      { code: 'base', name: '基础工资', amount: emp.salary },
      { code: 'meal', name: '餐补', amount: 300 },
    ]),
  }));
  await prisma.payslip.createMany({ data: slipRows, skipDuplicates: true });

  // ---- 知识库 ----
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

  // ---- 公告 ----
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

  // ---- 员工编号序列初始化（幂等）----
  const latestEmp = await prisma.employee.findFirst({
    orderBy: { id: 'desc' },
    select: { employeeNo: true },
  });
  const currentMax = latestEmp
    ? parseInt(latestEmp.employeeNo.replace(/\D/g, ''), 10)
    : 0;
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
    await seedPermissions(prisma);
    await seedBusiness(prisma);
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
    console.log('[seed] 演示账号: admin/123456（全部权限） staff/123456（员工+考勤+知识库）');
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
