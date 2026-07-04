import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始播种数据...')

  const hashedPassword = await bcrypt.hash('123456', 10)

  const permissions = [
    // ========== 组织人事 ==========
    { name: '人员管理-查看', code: 'personnel:view', resource: 'personnel', action: 'view', module: 'personnel', sortOrder: 1 },
    { name: '人员管理-新增', code: 'personnel:create', resource: 'personnel', action: 'create', module: 'personnel', sortOrder: 2 },
    { name: '人员管理-编辑', code: 'personnel:edit', resource: 'personnel', action: 'edit', module: 'personnel', sortOrder: 3 },
    { name: '人员管理-删除', code: 'personnel:delete', resource: 'personnel', action: 'delete', module: 'personnel', sortOrder: 4 },
    { name: '人员管理-导出', code: 'personnel:export', resource: 'personnel', action: 'export', module: 'personnel', sortOrder: 5 },
    { name: '人员管理-导入', code: 'personnel:import', resource: 'personnel', action: 'import', module: 'personnel', sortOrder: 6 },
    { name: '组织架构-查看', code: 'organization:view', resource: 'organization', action: 'view', module: 'organization', sortOrder: 7 },
    { name: '组织架构-管理', code: 'organization:manage', resource: 'organization', action: 'manage', module: 'organization', sortOrder: 8 },
    { name: '部门管理-查看', code: 'department:view', resource: 'department', action: 'view', module: 'organization', sortOrder: 9 },
    { name: '部门管理-新增', code: 'department:create', resource: 'department', action: 'create', module: 'organization', sortOrder: 10 },
    { name: '部门管理-编辑', code: 'department:edit', resource: 'department', action: 'edit', module: 'organization', sortOrder: 11 },
    { name: '部门管理-删除', code: 'department:delete', resource: 'department', action: 'delete', module: 'organization', sortOrder: 12 },
    { name: '职位管理-查看', code: 'position:view', resource: 'position', action: 'view', module: 'organization', sortOrder: 13 },
    { name: '职位管理-新增', code: 'position:create', resource: 'position', action: 'create', module: 'organization', sortOrder: 14 },
    { name: '职位管理-编辑', code: 'position:edit', resource: 'position', action: 'edit', module: 'organization', sortOrder: 15 },
    { name: '职位管理-删除', code: 'position:delete', resource: 'position', action: 'delete', module: 'organization', sortOrder: 16 },
    { name: '员工生命周期-查看', code: 'lifecycle:view', resource: 'employee_lifecycle', action: 'view', module: 'personnel', sortOrder: 17 },
    { name: '员工生命周期-管理', code: 'lifecycle:manage', resource: 'employee_lifecycle', action: 'manage', module: 'personnel', sortOrder: 18 },

    // ========== 考勤管理 ==========
    { name: '班次管理-查看', code: 'shift:view', resource: 'shift', action: 'view', module: 'attendance', sortOrder: 19 },
    { name: '班次管理-新增', code: 'shift:create', resource: 'shift', action: 'create', module: 'attendance', sortOrder: 20 },
    { name: '班次管理-编辑', code: 'shift:edit', resource: 'shift', action: 'edit', module: 'attendance', sortOrder: 21 },
    { name: '班次管理-删除', code: 'shift:delete', resource: 'shift', action: 'delete', module: 'attendance', sortOrder: 22 },
    { name: '排班管理-查看', code: 'schedule:view', resource: 'schedule', action: 'view', module: 'attendance', sortOrder: 23 },
    { name: '排班管理-分配', code: 'schedule:assign', resource: 'schedule', action: 'assign', module: 'attendance', sortOrder: 24 },
    { name: '排班管理-编辑', code: 'schedule:edit', resource: 'schedule', action: 'edit', module: 'attendance', sortOrder: 25 },
    { name: '排班管理-删除', code: 'schedule:delete', resource: 'schedule', action: 'delete', module: 'attendance', sortOrder: 26 },
    { name: '考勤记录-查看', code: 'attendance:view', resource: 'attendance', action: 'view', module: 'attendance', sortOrder: 27 },
    { name: '考勤记录-导出', code: 'attendance:export', resource: 'attendance', action: 'export', module: 'attendance', sortOrder: 28 },
    { name: '考勤记录-编辑', code: 'attendance:edit', resource: 'attendance', action: 'edit', module: 'attendance', sortOrder: 29 },
    { name: '考勤记录-删除', code: 'attendance:delete', resource: 'attendance', action: 'delete', module: 'attendance', sortOrder: 30 },
    { name: '打卡记录-查看', code: 'attendance:checkin:view', resource: 'attendance_checkin', action: 'view', module: 'attendance', sortOrder: 31 },
    { name: '打卡记录-管理', code: 'attendance:checkin:manage', resource: 'attendance_checkin', action: 'manage', module: 'attendance', sortOrder: 32 },
    { name: '考勤核算-查看', code: 'attendance:calculate:view', resource: 'attendance_calculate', action: 'view', module: 'attendance', sortOrder: 33 },
    { name: '考勤核算-执行', code: 'attendance:calculate:execute', resource: 'attendance_calculate', action: 'execute', module: 'attendance', sortOrder: 34 },
    { name: '考勤规则-查看', code: 'attendance:rules:view', resource: 'attendance_rules', action: 'view', module: 'attendance', sortOrder: 35 },
    { name: '考勤规则-管理', code: 'attendance:rules:manage', resource: 'attendance_rules', action: 'manage', module: 'attendance', sortOrder: 36 },
    { name: '加班管理-查看', code: 'overtime:view', resource: 'overtime', action: 'view', module: 'attendance', sortOrder: 37 },
    { name: '加班管理-审批', code: 'overtime:approve', resource: 'overtime', action: 'approve', module: 'attendance', sortOrder: 38 },
    { name: '加班管理-删除', code: 'overtime:delete', resource: 'overtime', action: 'delete', module: 'attendance', sortOrder: 39 },
    { name: '调班管理-查看', code: 'shiftswap:view', resource: 'shiftswap', action: 'view', module: 'attendance', sortOrder: 40 },
    { name: '调班管理-审批', code: 'shiftswap:approve', resource: 'shiftswap', action: 'approve', module: 'attendance', sortOrder: 41 },
    { name: '调班管理-删除', code: 'shiftswap:delete', resource: 'shiftswap', action: 'delete', module: 'attendance', sortOrder: 42 },

    // ========== 假期管理 ==========
    { name: '假期管理-查看', code: 'vacation:view', resource: 'vacation', action: 'view', module: 'vacation', sortOrder: 43 },
    { name: '假期管理-维护', code: 'vacation:manage', resource: 'vacation', action: 'manage', module: 'vacation', sortOrder: 44 },
    { name: '假期审批-查看', code: 'vacation:approve:view', resource: 'vacation_approve', action: 'view', module: 'vacation', sortOrder: 45 },
    { name: '假期审批-审批', code: 'vacation:approve:action', resource: 'vacation_approve', action: 'approve', module: 'vacation', sortOrder: 46 },

    // ========== 薪资中心 ==========
    { name: '工资条-查看', code: 'payslip:view', resource: 'payslip', action: 'view', module: 'payroll', sortOrder: 47 },
    { name: '工资条-导出', code: 'payslip:export', resource: 'payslip', action: 'export', module: 'payroll', sortOrder: 48 },
    { name: '薪资管理-查看', code: 'payroll:view', resource: 'payroll', action: 'view', module: 'payroll', sortOrder: 49 },
    { name: '薪资管理-编辑', code: 'payroll:edit', resource: 'payroll', action: 'edit', module: 'payroll', sortOrder: 50 },
    { name: '薪资管理-核算', code: 'payroll:calculate', resource: 'payroll', action: 'calculate', module: 'payroll', sortOrder: 51 },
    { name: '薪资管理-导出', code: 'payroll:export', resource: 'payroll', action: 'export', module: 'payroll', sortOrder: 52 },
    { name: '薪资组件-查看', code: 'payroll:component:view', resource: 'payroll_component', action: 'view', module: 'payroll', sortOrder: 53 },
    { name: '薪资组件-管理', code: 'payroll:component:manage', resource: 'payroll_component', action: 'manage', module: 'payroll', sortOrder: 54 },

    // ========== 报销管理 ==========
    { name: '报销管理-查看', code: 'reimbursement:view', resource: 'reimbursement', action: 'view', module: 'reimbursement', sortOrder: 55 },
    { name: '报销管理-新增', code: 'reimbursement:create', resource: 'reimbursement', action: 'create', module: 'reimbursement', sortOrder: 56 },
    { name: '报销管理-编辑', code: 'reimbursement:edit', resource: 'reimbursement', action: 'edit', module: 'reimbursement', sortOrder: 57 },
    { name: '报销管理-删除', code: 'reimbursement:delete', resource: 'reimbursement', action: 'delete', module: 'reimbursement', sortOrder: 58 },
    { name: '报销管理-导出', code: 'reimbursement:export', resource: 'reimbursement', action: 'export', module: 'reimbursement', sortOrder: 59 },
    { name: '报销审批-审批', code: 'reimbursement:approve', resource: 'reimbursement', action: 'approve', module: 'reimbursement', sortOrder: 60 },

    // ========== 审批中心 ==========
    { name: '审批管理-查看', code: 'approval:view', resource: 'approval', action: 'view', module: 'approval', sortOrder: 61 },
    { name: '审批管理-处理', code: 'approval:handle', resource: 'approval', action: 'handle', module: 'approval', sortOrder: 62 },
    { name: '审批流程-查看', code: 'approval:flow:view', resource: 'approval_flow', action: 'view', module: 'approval', sortOrder: 63 },
    { name: '审批流程-管理', code: 'approval:flow:manage', resource: 'approval_flow', action: 'manage', module: 'approval', sortOrder: 64 },

    // ========== 工作台 ==========
    { name: '数据看板-查看', code: 'dashboard:view', resource: 'dashboard', action: 'view', module: 'dashboard', sortOrder: 65 },
    { name: '运营大屏-查看', code: 'dashboard:operations:view', resource: 'dashboard_operations', action: 'view', module: 'dashboard', sortOrder: 66 },
    { name: '消息中心-查看', code: 'message:view', resource: 'message', action: 'view', module: 'dashboard', sortOrder: 67 },
    { name: '消息管理-发送', code: 'message:send', resource: 'message', action: 'send', module: 'dashboard', sortOrder: 68 },
    { name: '消息模板-管理', code: 'message:template:manage', resource: 'message_template', action: 'manage', module: 'dashboard', sortOrder: 69 },
    { name: '知识库-查看', code: 'kb:view', resource: 'kb', action: 'view', module: 'dashboard', sortOrder: 70 },
    { name: '知识库-管理', code: 'kb:manage', resource: 'kb', action: 'manage', module: 'dashboard', sortOrder: 71 },
    { name: 'OKR-查看', code: 'okr:view', resource: 'okr', action: 'view', module: 'dashboard', sortOrder: 72 },
    { name: 'OKR-管理', code: 'okr:manage', resource: 'okr', action: 'manage', module: 'dashboard', sortOrder: 73 },
    { name: '数据大屏-查看', code: 'visualization:view', resource: 'visualization', action: 'view', module: 'dashboard', sortOrder: 74 },

    // ========== 权限与安全 ==========
    { name: '权限管理-查看', code: 'rbac:view', resource: 'rbac', action: 'view', module: 'rbac', sortOrder: 75 },
    { name: '角色管理-查看', code: 'role:view', resource: 'role', action: 'view', module: 'rbac', sortOrder: 76 },
    { name: '角色管理-新增', code: 'role:create', resource: 'role', action: 'create', module: 'rbac', sortOrder: 77 },
    { name: '角色管理-编辑', code: 'role:edit', resource: 'role', action: 'edit', module: 'rbac', sortOrder: 78 },
    { name: '角色管理-删除', code: 'role:delete', resource: 'role', action: 'delete', module: 'rbac', sortOrder: 79 },
    { name: '权限配置-管理', code: 'permission:manage', resource: 'permission', action: 'manage', module: 'rbac', sortOrder: 80 },
    { name: '安全审计-查看', code: 'security:audit:view', resource: 'system_log', action: 'view', module: 'security', sortOrder: 81 },
    { name: '安全审计-管理', code: 'security:audit:manage', resource: 'system_log', action: 'manage', module: 'security', sortOrder: 82 },
    { name: '登录日志-查看', code: 'security:login-log:view', resource: 'login_log', action: 'view', module: 'security', sortOrder: 83 },

    // ========== 系统设置 ==========
    { name: '系统参数-查看', code: 'settings:view', resource: 'settings', action: 'view', module: 'sso', sortOrder: 84 },
    { name: '系统参数-管理', code: 'settings:manage', resource: 'settings', action: 'manage', module: 'sso', sortOrder: 85 },
    { name: 'SSO应用-查看', code: 'sso:view', resource: 'sso_app', action: 'view', module: 'sso', sortOrder: 86 },
    { name: 'SSO应用-管理', code: 'sso:manage', resource: 'sso_app', action: 'manage', module: 'sso', sortOrder: 87 },
    { name: '数据导入-执行', code: 'data:import', resource: 'data_import', action: 'import', module: 'data', sortOrder: 88 },
    { name: '数据导出-执行', code: 'data:export', resource: 'data_export', action: 'export', module: 'data', sortOrder: 89 },
    { name: '导出任务-查看', code: 'data:task:view', resource: 'data_task', action: 'view', module: 'data', sortOrder: 90 },
    { name: '导出任务-管理', code: 'data:task:manage', resource: 'data_task', action: 'manage', module: 'data', sortOrder: 91 },
    { name: '模板管理-查看', code: 'data:template:view', resource: 'data_template', action: 'view', module: 'data', sortOrder: 92 },
    { name: '模板管理-管理', code: 'data:template:manage', resource: 'data_template', action: 'manage', module: 'data', sortOrder: 93 },
    { name: '数据字典-查看', code: 'data:dict:view', resource: 'data_dict', action: 'view', module: 'data', sortOrder: 94 },
    { name: '数据字典-管理', code: 'data:dict:manage', resource: 'data_dict', action: 'manage', module: 'data', sortOrder: 95 },

    // ========== 资产管理 ==========
    { name: '资产-查看', code: 'asset:view', resource: 'asset', action: 'view', module: 'asset', sortOrder: 96 },
    { name: '资产-新增', code: 'asset:create', resource: 'asset', action: 'create', module: 'asset', sortOrder: 97 },
    { name: '资产-编辑', code: 'asset:edit', resource: 'asset', action: 'edit', module: 'asset', sortOrder: 98 },
    { name: '资产-删除', code: 'asset:delete', resource: 'asset', action: 'delete', module: 'asset', sortOrder: 99 },
    { name: '资产领用-管理', code: 'asset:assign:manage', resource: 'asset_assignment', action: 'manage', module: 'asset', sortOrder: 100 },

    // ========== HR服务台 ==========
    { name: 'HR工单-查看', code: 'helpdesk:view', resource: 'helpdesk_ticket', action: 'view', module: 'helpdesk', sortOrder: 101 },
    { name: 'HR工单-处理', code: 'helpdesk:handle', resource: 'helpdesk_ticket', action: 'handle', module: 'helpdesk', sortOrder: 102 },
    { name: 'HR工单-配置', code: 'helpdesk:manage', resource: 'helpdesk_category', action: 'manage', module: 'helpdesk', sortOrder: 103 },

    // ========== 招聘管理 ==========
    { name: '招聘-查看', code: 'recruitment:view', resource: 'recruitment', action: 'view', module: 'recruitment', sortOrder: 104 },
    { name: '招聘-管理', code: 'recruitment:manage', resource: 'recruitment', action: 'manage', module: 'recruitment', sortOrder: 105 },
    { name: '简历-查看', code: 'recruitment:resume:view', resource: 'resume', action: 'view', module: 'recruitment', sortOrder: 106 },
    { name: '简历-管理', code: 'recruitment:resume:manage', resource: 'resume', action: 'manage', module: 'recruitment', sortOrder: 107 },
    { name: '面试-查看', code: 'recruitment:interview:view', resource: 'interview', action: 'view', module: 'recruitment', sortOrder: 108 },
    { name: '面试-管理', code: 'recruitment:interview:manage', resource: 'interview', action: 'manage', module: 'recruitment', sortOrder: 109 },
    { name: 'Offer-查看', code: 'recruitment:offer:view', resource: 'offer', action: 'view', module: 'recruitment', sortOrder: 110 },
    { name: 'Offer-管理', code: 'recruitment:offer:manage', resource: 'offer', action: 'manage', module: 'recruitment', sortOrder: 111 },

    // ========== 绩效管理 ==========
    { name: '绩效-查看', code: 'performance:view', resource: 'performance', action: 'view', module: 'performance', sortOrder: 112 },
    { name: '绩效-管理', code: 'performance:manage', resource: 'performance', action: 'manage', module: 'performance', sortOrder: 113 },
    { name: '绩效-导出', code: 'performance:export', resource: 'performance', action: 'export', module: 'performance', sortOrder: 114 },
    { name: '绩效评审-评审', code: 'performance:review', resource: 'performance_review', action: 'review', module: 'performance', sortOrder: 115 },

    // ========== 培训管理 ==========
    { name: '培训-查看', code: 'training:view', resource: 'training', action: 'view', module: 'training', sortOrder: 116 },
    { name: '培训-管理', code: 'training:manage', resource: 'training', action: 'manage', module: 'training', sortOrder: 117 },
    { name: '课程-查看', code: 'training:course:view', resource: 'course', action: 'view', module: 'training', sortOrder: 118 },
    { name: '课程-管理', code: 'training:course:manage', resource: 'course', action: 'manage', module: 'training', sortOrder: 119 },
    { name: '考试-查看', code: 'training:exam:view', resource: 'exam', action: 'view', module: 'training', sortOrder: 120 },
    { name: '考试-管理', code: 'training:exam:manage', resource: 'exam', action: 'manage', module: 'training', sortOrder: 121 },

    // ========== 个人中心 ==========
    { name: '个人中心-查看', code: 'profile:view', resource: 'profile', action: 'view', module: 'other', sortOrder: 122 },
    { name: '个人中心-管理', code: 'profile:manage', resource: 'profile', action: 'manage', module: 'other', sortOrder: 123 },
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
    'schedule:manage',
    'attendance:view',
    'attendance:checkin:view',
    'attendance:calculate',
    'attendance:manage',
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

  const exceptionRules = [
    {
      name: '普通迟到',
      type: 'late',
      threshold: 15,
      autoResolve: false,
      deductMinutes: 0,
      status: 'active',
      sortOrder: 1,
      description: '上班迟到15分钟以内',
    },
    {
      name: '严重迟到',
      type: 'late',
      threshold: 30,
      thresholdMax: 60,
      autoResolve: false,
      deductMinutes: 30,
      status: 'active',
      sortOrder: 2,
      description: '上班迟到30-60分钟，扣除30分钟工时',
    },
    {
      name: '早退警告',
      type: 'early',
      threshold: 15,
      autoResolve: true,
      autoResolveType: 'warn',
      deductMinutes: 0,
      status: 'active',
      sortOrder: 3,
      description: '下班提前15分钟以上离开，记录警告',
    },
    {
      name: '缺上班卡',
      type: 'missing_checkin',
      threshold: 0,
      autoResolve: false,
      deductMinutes: 60,
      status: 'active',
      sortOrder: 4,
      description: '未打卡上下班，扣除1小时工时',
    },
    {
      name: '缺下班卡',
      type: 'missing_checkout',
      threshold: 0,
      autoResolve: false,
      deductMinutes: 60,
      status: 'active',
      sortOrder: 5,
      description: '下班未打卡，扣除1小时工时',
    },
    {
      name: '旷工自动标记',
      type: 'absent',
      threshold: 0,
      autoResolve: true,
      autoResolveType: 'deduct',
      deductMinutes: 480,
      status: 'active',
      sortOrder: 6,
      description: '旷工按全天扣除工时',
    },
    {
      name: '工时不足警告',
      type: 'work_duration_less',
      threshold: 30,
      autoResolve: true,
      autoResolveType: 'warn',
      deductMinutes: 0,
      status: 'active',
      sortOrder: 7,
      description: '实际工时少于应出勤30分钟以上',
    },
  ]

  for (const rule of exceptionRules) {
    await prisma.attendanceExceptionRule.upsert({
      where: { id: rule.sortOrder },
      update: rule,
      create: { ...rule, createdBy: adminUser.id },
    })
  }
  console.log('✅ 考勤异常规则数据创建完成')

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
