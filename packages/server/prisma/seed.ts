import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** 初始权限点（页面级 menu + 动作级 action），后续批次按模块扩展 */
const PERMISSIONS = [
  { code: 'dashboard_view', name: '查看工作台', type: 'menu', module: 'dashboard' },
  { code: 'user_view', name: '查看用户', type: 'menu', module: 'user' },
  { code: 'user_create', name: '新建用户', type: 'action', module: 'user' },
  { code: 'user_update', name: '编辑用户', type: 'action', module: 'user' },
  { code: 'user_delete', name: '删除用户', type: 'action', module: 'user' },
  { code: 'role_assign', name: '分配角色', type: 'action', module: 'user' },
  { code: 'role_view', name: '查看角色权限', type: 'menu', module: 'role' },
  { code: 'role_update', name: '编辑角色权限', type: 'action', module: 'role' },
  { code: 'leave_view', name: '查看请假', type: 'menu', module: 'leave' },
  { code: 'leave_create', name: '发起请假', type: 'action', module: 'leave' },
  { code: 'leave_approve', name: '审批请假', type: 'action', module: 'leave' },
  { code: 'reimburse_view', name: '查看报销', type: 'menu', module: 'reimburse' },
  { code: 'reimburse_create', name: '发起报销', type: 'action', module: 'reimburse' },
  { code: 'reimburse_approve', name: '审批报销', type: 'action', module: 'reimburse' },
  { code: 'reimburse_category_view', name: '查看报销类别', type: 'menu', module: 'reimburse' },
  { code: 'reimburse_category_manage', name: '管理报销类别', type: 'action', module: 'reimburse' },
  { code: 'dept_view', name: '查看部门', type: 'menu', module: 'dept' },
  { code: 'dept_create', name: '新建部门', type: 'action', module: 'dept' },
  { code: 'dept_update', name: '编辑部门', type: 'action', module: 'dept' },
  { code: 'dept_delete', name: '删除部门', type: 'action', module: 'dept' },
  { code: 'attendance_view', name: '查看考勤', type: 'menu', module: 'attendance' },
  { code: 'attendance_punch', name: '考勤打卡', type: 'action', module: 'attendance' },
  { code: 'overtime_view', name: '查看加班', type: 'menu', module: 'attendance' },
  { code: 'overtime_create', name: '申请加班', type: 'action', module: 'attendance' },
  { code: 'overtime_approve', name: '审批加班', type: 'action', module: 'attendance' },
  { code: 'makeup_view', name: '查看补卡', type: 'menu', module: 'attendance' },
  { code: 'makeup_create', name: '申请补卡', type: 'action', module: 'attendance' },
  { code: 'makeup_approve', name: '审批补卡', type: 'action', module: 'attendance' },
  { code: 'att_setting_view', name: '查看考勤设置', type: 'menu', module: 'attendance' },
  { code: 'att_setting_edit', name: '编辑考勤设置', type: 'action', module: 'attendance' },
  { code: 'holiday_view', name: '查看节假日', type: 'menu', module: 'attendance' },
  { code: 'holiday_manage', name: '管理节假日', type: 'action', module: 'attendance' },
  { code: 'leave_type_view', name: '查看请假类型', type: 'menu', module: 'leave' },
  { code: 'leave_type_manage', name: '管理请假类型', type: 'action', module: 'leave' },
  { code: 'quota_view', name: '查看年度额度', type: 'menu', module: 'leave' },
  { code: 'quota_manage', name: '管理年度额度', type: 'action', module: 'leave' },
  { code: 'salary_view', name: '查看薪资', type: 'menu', module: 'salary' },
  { code: 'salary_create', name: '录入薪资', type: 'action', module: 'salary' },
  { code: 'shift_view', name: '查看班次排班', type: 'menu', module: 'shift' },
  { code: 'shift_manage', name: '管理班次排班', type: 'action', module: 'shift' },
  { code: 'my_schedule_view', name: '查看我的排班', type: 'menu', module: 'shift' },
  { code: 'schedule_template_view', name: '查看周排班模板', type: 'menu', module: 'shift' },
  { code: 'schedule_template_create', name: '新建周排班模板', type: 'action', module: 'shift' },
  { code: 'schedule_template_edit', name: '编辑周排班模板', type: 'action', module: 'shift' },
  { code: 'schedule_template_delete', name: '删除周排班模板', type: 'action', module: 'shift' },
  { code: 'schedule_template_apply', name: '应用周排班模板', type: 'action', module: 'shift' },
  { code: 'att_exception_view', name: '查看考勤异常', type: 'menu', module: 'attendance' },
  { code: 'att_exception_manage', name: '处理考勤异常', type: 'action', module: 'attendance' },
] as const;

/** 部门树（数据隔离作用域）：总部 → 研发部 / 市场部 */
const DEPARTMENTS = [
  { name: '总部', parent: null },
  { name: '研发部', parent: '总部' },
  { name: '市场部', parent: '总部' },
] as const;

/** 种子管理员账号（开发环境默认密码 admin123，首次登录后尽快改密） */
const ADMIN = {
  username: 'admin',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
  realName: '系统管理员',
}; 

async function main() {
  const roles = await prisma.role.upsert({
    where: { name: 'admin' },
    update: { isSystem: true },
    create: { name: 'admin', description: '系统管理员（全权限）', isSystem: true },
  });

  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p },
    });
    // admin 角色关联到全部权限（幂等）
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: roles.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: roles.id, permissionId: perm.id },
    });
  }

  const hash = await bcrypt.hash(ADMIN.password, 10);

  // 部门树（数据隔离作用域）
  const deptByName = new Map<string, number>();
  for (const d of DEPARTMENTS) {
    const parentId = d.parent ? deptByName.get(d.parent) : undefined;
    const row = await prisma.department.upsert({
      where: { name: d.name },
      update: { parentId: parentId ?? null },
      create: { name: d.name, parentId: parentId ?? null },
    });
    deptByName.set(d.name, row.id);
  }
  const hqDeptId = deptByName.get('总部')!;
  const marketDeptId = deptByName.get('市场部')!;

  const admin = await prisma.user.upsert({
    where: { username: ADMIN.username },
    update: { password: hash, realName: ADMIN.realName, status: 'active', departmentId: hqDeptId },
    create: {
      username: ADMIN.username,
      password: hash,
      realName: ADMIN.realName,
      status: 'active',
      departmentId: hqDeptId,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roles.id } },
    update: {},
    create: { userId: admin.id, roleId: roles.id },
  });

  // 访客角色：只读工作台，用于验证权限收缩 / 菜单显隐
  const guestRole = await prisma.role.upsert({
    where: { name: 'guest' },
    update: {},
    create: { name: 'guest', description: '访客（仅工作台）' },
  });
  const guestPerm = await prisma.permission.findUnique({ where: { code: 'dashboard_view' } });
  if (guestPerm) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: guestRole.id, permissionId: guestPerm.id } },
      update: {},
      create: { roleId: guestRole.id, permissionId: guestPerm.id },
    });
  }
  const guestHash = await bcrypt.hash('guest123', 10);
  const guest = await prisma.user.upsert({
    where: { username: 'guest' },
    update: { password: guestHash, realName: '访客', status: 'active', departmentId: marketDeptId },
    create: { username: 'guest', password: guestHash, realName: '访客', status: 'active', departmentId: marketDeptId },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: guest.id, roleId: guestRole.id } },
    update: {},
    create: { userId: guest.id, roleId: guestRole.id },
  });

  // 报销类别（系统级配置，无部门隔离）：默认常用类别，名称唯一
  const DEFAULT_CATEGORIES = [
    { name: '餐饮', description: '工作餐、商务宴请等' },
    { name: '交通', description: '打车、地铁、差旅交通等' },
    { name: '办公', description: '办公用品、打印耗材等' },
    { name: '住宿', description: '出差住宿费' },
    { name: '其他', description: '其他应报销支出' },
  ];
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.reimburseCategory.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: { name: c.name, description: c.description, isActive: true },
    });
  }

  // 抽样请假单：admin(总部) 与 guest(市场部) 各一条，用于验证部门数据隔离
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const seedLeaves = [
    { type: '年假', reason: '总部——年度年假', applicantId: admin.id, departmentId: hqDeptId, startAt: new Date(todayStart.getTime() + 86400000), endAt: new Date(todayStart.getTime() + 172800000) },
    { type: '事假', reason: '市场部——个人事假', applicantId: guest.id, departmentId: marketDeptId, startAt: new Date(todayStart.getTime() + 86400000), endAt: new Date(todayStart.getTime() + 86400000) },
  ];
  for (const l of seedLeaves) {
    const exists = await prisma.leave.findFirst({
      where: { applicantId: l.applicantId, type: l.type, reason: l.reason },
      select: { id: true },
    });
    if (!exists) await prisma.leave.create({ data: l });
  }

  const rolesCount = await prisma.role.count();
  const permsCount = await prisma.permission.count();
  console.log(
    `[seed] 完成：admin 用户=${ADMIN.username}，角色=${rolesCount}，权限=${permsCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());