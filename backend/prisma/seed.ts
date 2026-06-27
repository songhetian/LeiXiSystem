import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始播种数据...')

  const hashedPassword = await bcrypt.hash('123456', 10)

  const permissions = [
    { name: '人员管理', code: 'personnel:view', resource: 'personnel', action: 'view', module: 'personnel', sortOrder: 1 },
    { name: '新增员工', code: 'personnel:create', resource: 'personnel', action: 'create', module: 'personnel', sortOrder: 2 },
    { name: '编辑员工', code: 'personnel:edit', resource: 'personnel', action: 'edit', module: 'personnel', sortOrder: 3 },
    { name: '删除员工', code: 'personnel:delete', resource: 'personnel', action: 'delete', module: 'personnel', sortOrder: 4 },
    { name: '组织架构', code: 'organization:view', resource: 'organization', action: 'view', module: 'organization', sortOrder: 5 },
    { name: '部门管理', code: 'department:manage', resource: 'department', action: 'manage', module: 'organization', sortOrder: 6 },
    { name: '职位管理', code: 'position:manage', resource: 'position', action: 'manage', module: 'organization', sortOrder: 7 },
    { name: '权限管理', code: 'rbac:view', resource: 'rbac', action: 'view', module: 'rbac', sortOrder: 8 },
    { name: '角色管理', code: 'role:manage', resource: 'role', action: 'manage', module: 'rbac', sortOrder: 9 },
    { name: '班次管理', code: 'shift:view', resource: 'shift', action: 'view', module: 'attendance', sortOrder: 10 },
    { name: '班次维护', code: 'shift:manage', resource: 'shift', action: 'manage', module: 'attendance', sortOrder: 11 },
    { name: '排班查看', code: 'schedule:view', resource: 'schedule', action: 'view', module: 'attendance', sortOrder: 12 },
    { name: '排班分配', code: 'schedule:assign', resource: 'schedule', action: 'assign', module: 'attendance', sortOrder: 13 },
    { name: '考勤记录', code: 'attendance:view', resource: 'attendance', action: 'view', module: 'attendance', sortOrder: 14 },
    { name: '假期管理', code: 'vacation:view', resource: 'vacation', action: 'view', module: 'vacation', sortOrder: 15 },
    { name: '假期维护', code: 'vacation:manage', resource: 'vacation', action: 'manage', module: 'vacation', sortOrder: 16 },
    { name: '报销管理', code: 'reimbursement:view', resource: 'reimbursement', action: 'view', module: 'reimbursement', sortOrder: 17 },
    { name: '报销审批', code: 'reimbursement:approve', resource: 'reimbursement', action: 'approve', module: 'reimbursement', sortOrder: 18 },
    { name: '审批管理', code: 'approval:view', resource: 'approval', action: 'view', module: 'approval', sortOrder: 19 },
    { name: '数据看板', code: 'dashboard:view', resource: 'dashboard', action: 'view', module: 'dashboard', sortOrder: 20 },
    { name: '工资条查看', code: 'payslip:view', resource: 'payslip', action: 'view', module: 'payroll', sortOrder: 21 },
    { name: '薪资管理', code: 'payroll:manage', resource: 'payroll', action: 'manage', module: 'payroll', sortOrder: 22 },
    { name: '打卡原始记录', code: 'attendance:checkin:view', resource: 'attendance_checkin', action: 'view', module: 'attendance', sortOrder: 23 },
    { name: '考勤核算', code: 'attendance:calculate', resource: 'attendance', action: 'calculate', module: 'attendance', sortOrder: 24 },
    { name: '工资条全量查看', code: 'payroll:payslip:view-all', resource: 'payslip', action: 'view_all', module: 'payroll', sortOrder: 25 },
    { name: '个人工资条查看', code: 'payroll:payslip:view-self', resource: 'payslip', action: 'view_self', module: 'payroll', sortOrder: 26 },
    { name: '安全审计查看', code: 'security:audit:view', resource: 'system_log', action: 'view', module: 'security', sortOrder: 27 },
    { name: 'SSO应用管理', code: 'sso:manage', resource: 'sso_app', action: 'manage', module: 'sso', sortOrder: 28 },
    { name: '数据导入', code: 'data:import', resource: 'data_import', action: 'import', module: 'data', sortOrder: 29 },
    { name: '数据导出', code: 'data:export', resource: 'data_export', action: 'export', module: 'data', sortOrder: 30 },
    { name: '员工生命周期查看', code: 'lifecycle:view', resource: 'employee_lifecycle', action: 'view', module: 'personnel', sortOrder: 31 },
    { name: '员工生命周期管理', code: 'lifecycle:manage', resource: 'employee_lifecycle', action: 'manage', module: 'personnel', sortOrder: 32 },
    { name: '资产查看', code: 'asset:view', resource: 'asset', action: 'view', module: 'asset', sortOrder: 33 },
    { name: '资产管理', code: 'asset:manage', resource: 'asset', action: 'manage', module: 'asset', sortOrder: 34 },
    { name: '资产领用归还', code: 'asset:assign', resource: 'asset_assignment', action: 'assign', module: 'asset', sortOrder: 35 },
    { name: 'HR工单查看', code: 'helpdesk:view', resource: 'helpdesk_ticket', action: 'view', module: 'helpdesk', sortOrder: 36 },
    { name: 'HR工单处理', code: 'helpdesk:handle', resource: 'helpdesk_ticket', action: 'handle', module: 'helpdesk', sortOrder: 37 },
    { name: 'HR工单配置', code: 'helpdesk:manage', resource: 'helpdesk_category', action: 'manage', module: 'helpdesk', sortOrder: 38 },
    { name: '招聘查看', code: 'recruitment:view', resource: 'recruitment', action: 'view', module: 'recruitment', sortOrder: 39 },
    { name: '招聘管理', code: 'recruitment:manage', resource: 'recruitment', action: 'manage', module: 'recruitment', sortOrder: 40 },
    { name: '绩效查看', code: 'performance:view', resource: 'performance', action: 'view', module: 'performance', sortOrder: 41 },
    { name: '绩效管理', code: 'performance:manage', resource: 'performance', action: 'manage', module: 'performance', sortOrder: 42 },
    { name: '绩效评审', code: 'performance:review', resource: 'performance_review', action: 'review', module: 'performance', sortOrder: 43 },
    { name: '培训查看', code: 'training:view', resource: 'training', action: 'view', module: 'training', sortOrder: 44 },
    { name: '培训管理', code: 'training:manage', resource: 'training', action: 'manage', module: 'training', sortOrder: 45 },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    })
  }
  console.log('✅ 权限数据创建完成')

  const adminRole = await prisma.role.upsert({
    where: { name: '超级管理员' },
    update: {},
    create: {
      name: '超级管理员',
      description: '系统超级管理员，拥有所有权限',
      level: 1,
      isSystem: true,
      canViewAllDepts: true,
    },
  })

  const hrRole = await prisma.role.upsert({
    where: { name: '人事专员' },
    update: {},
    create: {
      name: '人事专员',
      description: '负责人事管理相关工作',
      level: 2,
      canViewAllDepts: true,
    },
  })

  const managerRole = await prisma.role.upsert({
    where: { name: '部门经理' },
    update: {},
    create: {
      name: '部门经理',
      description: '部门负责人，管理本部门员工',
      level: 3,
      canViewAllDepts: false,
    },
  })

  const employeeRole = await prisma.role.upsert({
    where: { name: '普通员工' },
    update: {},
    create: {
      name: '普通员工',
      description: '普通员工角色',
      level: 5,
      canViewAllDepts: false,
    },
  })
  console.log('✅ 角色数据创建完成')

  const allPerms = await prisma.permission.findMany()
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    })
  }
  console.log('✅ 超级管理员权限分配完成')

  async function assignPermissionsToRole(roleId: number, permissionCodes: string[]) {
    const permissionsToAssign = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    })

    for (const permission of permissionsToAssign) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: {},
        create: { roleId, permissionId: permission.id },
      })
    }
  }

  await assignPermissionsToRole(hrRole.id, [
    'dashboard:view',
    'personnel:view',
    'personnel:create',
    'personnel:edit',
    'organization:view',
    'department:manage',
    'position:manage',
    'shift:view',
    'shift:manage',
    'schedule:view',
    'schedule:assign',
    'attendance:view',
    'attendance:checkin:view',
    'attendance:calculate',
    'vacation:view',
    'vacation:manage',
    'reimbursement:view',
    'reimbursement:approve',
    'approval:view',
    'payslip:view',
    'payroll:manage',
    'payroll:payslip:view-all',
    'payroll:payslip:view-self',
    'lifecycle:view',
    'lifecycle:manage',
    'asset:view',
    'asset:manage',
    'asset:assign',
    'helpdesk:view',
    'helpdesk:handle',
    'helpdesk:manage',
    'recruitment:view',
    'recruitment:manage',
    'performance:view',
    'performance:manage',
    'performance:review',
    'training:view',
    'training:manage',
    'data:import',
    'data:export',
  ])

  await assignPermissionsToRole(managerRole.id, [
    'dashboard:view',
    'personnel:view',
    'organization:view',
    'shift:view',
    'schedule:view',
    'schedule:assign',
    'attendance:view',
    'vacation:view',
    'reimbursement:view',
    'reimbursement:approve',
    'approval:view',
    'payroll:payslip:view-self',
    'lifecycle:view',
    'asset:view',
    'helpdesk:view',
    'helpdesk:handle',
    'recruitment:view',
    'performance:view',
    'performance:review',
    'training:view',
  ])

  await assignPermissionsToRole(employeeRole.id, [
    'dashboard:view',
    'attendance:view',
    'vacation:view',
    'reimbursement:view',
    'approval:view',
    'payroll:payslip:view-self',
    'helpdesk:view',
    'performance:view',
  ])
  console.log('✅ 默认角色权限分配完成')

  await prisma.roleDataScope.upsert({
    where: { roleId: adminRole.id },
    update: { scopeType: 'all', departmentIds: null },
    create: { roleId: adminRole.id, scopeType: 'all' },
  })
  await prisma.roleDataScope.upsert({
    where: { roleId: hrRole.id },
    update: { scopeType: 'all', departmentIds: null },
    create: { roleId: hrRole.id, scopeType: 'all' },
  })
  await prisma.roleDataScope.upsert({
    where: { roleId: managerRole.id },
    update: { scopeType: 'department', departmentIds: null },
    create: { roleId: managerRole.id, scopeType: 'department' },
  })
  await prisma.roleDataScope.upsert({
    where: { roleId: employeeRole.id },
    update: { scopeType: 'self', departmentIds: null },
    create: { roleId: employeeRole.id, scopeType: 'self' },
  })
  console.log('✅ 角色数据范围创建完成')

  const dept1 = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '总公司',
      description: '总公司',
      sortOrder: 1,
    },
  })

  const dept2 = await prisma.department.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: '技术部',
      parentId: dept1.id,
      description: '技术研发部门',
      sortOrder: 2,
    },
  })

  const dept3 = await prisma.department.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: '人事部',
      parentId: dept1.id,
      description: '人力资源部门',
      sortOrder: 3,
    },
  })

  const dept4 = await prisma.department.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: '市场部',
      parentId: dept1.id,
      description: '市场营销部门',
      sortOrder: 4,
    },
  })

  const dept5 = await prisma.department.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: '财务部',
      parentId: dept1.id,
      description: '财务部门',
      sortOrder: 5,
    },
  })
  console.log('✅ 部门数据创建完成')

  const pos1 = await prisma.position.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '总经理',
      departmentId: dept1.id,
      description: '公司总经理',
      sortOrder: 1,
    },
  })

  const pos2 = await prisma.position.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: '技术总监',
      departmentId: dept2.id,
      description: '技术部门负责人',
      sortOrder: 1,
    },
  })

  const pos3 = await prisma.position.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: '高级开发工程师',
      departmentId: dept2.id,
      description: '高级软件开发工程师',
      sortOrder: 2,
    },
  })

  const pos4 = await prisma.position.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: '人事经理',
      departmentId: dept3.id,
      description: '人事部门负责人',
      sortOrder: 1,
    },
  })

  const pos5 = await prisma.position.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: '人事专员',
      departmentId: dept3.id,
      description: '人事专员',
      sortOrder: 2,
    },
  })
  console.log('✅ 职位数据创建完成')

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      realName: '系统管理员',
      email: 'admin@leixi.com',
      phone: '13800000000',
      departmentId: dept3.id,
      positionId: pos4.id,
      status: 'active',
      isDeptManager: true,
      employee: {
        create: {
          employeeNo: 'EMP001',
          hireDate: new Date('2020-01-01'),
          salary: 20000,
          status: 'active',
          education: '本科',
        },
      },
      userRoles: {
        create: [{ roleId: adminRole.id }],
      },
    },
  })

  await prisma.department.update({
    where: { id: dept3.id },
    data: { managerId: adminUser.id },
  })
  console.log('✅ 管理员账号创建完成 (admin / 123456)')

  const shift1 = await prisma.shift.upsert({
    where: { code: 'day' },
    update: {},
    create: {
      name: '白班',
      code: 'day',
      startTime: '09:00',
      endTime: '18:00',
      workHours: 8,
      isFlexible: false,
      color: '#165DFF',
      description: '标准白班',
      sortOrder: 1,
    },
  })

  await prisma.shift.upsert({
    where: { code: 'night' },
    update: {},
    create: {
      name: '夜班',
      code: 'night',
      startTime: '22:00',
      endTime: '07:00',
      workHours: 8,
      isFlexible: false,
      color: '#722ED1',
      description: '夜班',
      sortOrder: 2,
    },
  })

  await prisma.shift.upsert({
    where: { code: 'flexible' },
    update: {},
    create: {
      name: '弹性班',
      code: 'flexible',
      startTime: '10:00',
      endTime: '19:00',
      workHours: 8,
      isFlexible: true,
      color: '#00B42A',
      description: '弹性工作制',
      sortOrder: 3,
    },
  })
  console.log('✅ 班次数据创建完成')

  const vacationTypes = [
    { name: '年假', code: 'annual', totalDays: 10, unit: 'day', isPaid: true, sortOrder: 1 },
    { name: '病假', code: 'sick', totalDays: 15, unit: 'day', isPaid: false, sortOrder: 2 },
    { name: '事假', code: 'personal', totalDays: 5, unit: 'day', isPaid: false, sortOrder: 3 },
    { name: '婚假', code: 'marriage', totalDays: 3, unit: 'day', isPaid: true, sortOrder: 4 },
    { name: '产假', code: 'maternity', totalDays: 98, unit: 'day', isPaid: true, sortOrder: 5 },
    { name: '调休', code: 'compensatory', totalDays: 0, unit: 'day', isPaid: true, sortOrder: 6 },
  ]

  for (const vt of vacationTypes) {
    await prisma.vacationType.upsert({
      where: { code: vt.code },
      update: vt,
      create: vt,
    })
  }
  console.log('✅ 假期类型数据创建完成')

  const assetCategories = [
    { name: '办公电脑', code: 'computer', description: '笔记本、台式机、一体机等办公电脑', sortOrder: 1 },
    { name: '办公外设', code: 'peripheral', description: '显示器、键盘、鼠标、扩展坞等外设', sortOrder: 2 },
    { name: '移动设备', code: 'mobile_device', description: '手机、平板、移动热点等设备', sortOrder: 3 },
    { name: '办公家具', code: 'office_furniture', description: '工位、桌椅、文件柜等办公家具', sortOrder: 4 },
    { name: '软件许可', code: 'software_license', description: '软件账号、SaaS 订阅和授权许可', sortOrder: 5 },
  ]

  for (const category of assetCategories) {
    await prisma.assetCategory.upsert({
      where: { code: category.code },
      update: { status: 'active', sortOrder: category.sortOrder },
      create: { ...category, status: 'active' },
    })
  }
  console.log('✅ 资产分类数据创建完成')

  const helpdeskCategories = [
    { name: '薪资福利', code: 'payroll_benefit', description: '工资条、社保、公积金、福利相关咨询', sortOrder: 1 },
    { name: '考勤休假', code: 'attendance_leave', description: '打卡异常、请假、加班、调休相关问题', sortOrder: 2 },
    { name: '入离转调', code: 'employee_lifecycle', description: '入职、转正、调岗、离职等流程问题', sortOrder: 3 },
    { name: '资产设备', code: 'asset_device', description: '办公设备、资产领用与归还问题', sortOrder: 4 },
    { name: '系统账号', code: 'system_account', description: '账号权限、登录、SSO 和系统使用问题', sortOrder: 5 },
  ]

  for (const category of helpdeskCategories) {
    await prisma.helpdeskCategory.upsert({
      where: { code: category.code },
      update: { status: 'active', sortOrder: category.sortOrder },
      create: { ...category, status: 'active' },
    })
  }
  console.log('✅ HR 服务台分类数据创建完成')

  const trainingCourses = [
    {
      title: '新员工入职培训',
      code: 'new_employee_onboarding',
      category: '入职',
      description: '面向新员工的公司制度、组织文化、信息安全和基础流程培训',
      durationHours: 4,
    },
    {
      title: '信息安全与数据合规',
      code: 'security_compliance',
      category: '合规',
      description: '账号安全、敏感数据保护、审计要求和常见安全风险培训',
      durationHours: 2,
    },
    {
      title: '绩效目标制定方法',
      code: 'performance_goal_setting',
      category: '管理',
      description: '面向管理者和员工的目标拆解、指标设定与绩效沟通培训',
      durationHours: 2,
    },
  ]

  for (const course of trainingCourses) {
    await prisma.trainingCourse.upsert({
      where: { code: course.code },
      update: { status: 'active', category: course.category, durationHours: course.durationHours },
      create: { ...course, status: 'active', createdBy: adminUser.id },
    })
  }
  console.log('✅ 培训课程数据创建完成')

  const currentYear = new Date().getFullYear()
  const defaultCycleName = `${currentYear}年度绩效周期`
  const existingCycle = await prisma.performanceCycle.findFirst({
    where: { name: defaultCycleName },
    select: { id: true },
  })
  if (!existingCycle) {
    await prisma.performanceCycle.create({
      data: {
        name: defaultCycleName,
        cycleType: 'year',
        startDate: new Date(`${currentYear}-01-01`),
        endDate: new Date(`${currentYear}-12-31`),
        status: 'active',
        createdBy: adminUser.id,
      },
    })
  }
  console.log('✅ 默认绩效周期数据创建完成')

  console.log('🎉 所有种子数据创建完成！')
  console.log('默认登录账号: admin / 123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
