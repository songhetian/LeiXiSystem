import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { setAudit } from '../plugins/audit'
import { requirePermission } from '../middleware/permission'
import { idParamsSchema, validateData } from '../utils/validation'

const exportSchema = z.object({
  modules: z.array(z.enum([
    'departments',
    'positions',
    'vacation_types',
    'vacation_rules',
    'attendance_rules',
    'payroll_components',
    'schedule_templates',
    'workflows',
    'roles',
    'permissions',
  ])).min(1),
  includeData: z.boolean().default(false),
})

export default async function configExportRoutes(fastify: FastifyInstance) {
  // 导出配置
  fastify.post('/config/export', { preHandler: [requirePermission('system:config')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { modules, includeData } = validateData(exportSchema, request.body)

    const config: Record<string, any> = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      modules: {},
    }

    for (const module of modules) {
      switch (module) {
        case 'departments':
          config.modules.departments = await exportDepartments(includeData)
          break
        case 'positions':
          config.modules.positions = await exportPositions()
          break
        case 'vacation_types':
          config.modules.vacationTypes = await exportVacationTypes()
          break
        case 'vacation_rules':
          config.modules.vacationRules = await exportVacationRules()
          break
        case 'attendance_rules':
          config.modules.attendanceRules = await exportAttendanceRules()
          break
        case 'payroll_components':
          config.modules.payrollComponents = await exportPayrollComponents()
          break
        case 'schedule_templates':
          config.modules.scheduleTemplates = await exportScheduleTemplates()
          break
        case 'roles':
          config.modules.roles = await exportRoles()
          break
      }
    }

    setAudit(request, {
      module: 'system',
      action: 'config.export',
      requestData: { modules },
    })

    return {
      code: 0,
      data: config,
      message: '配置导出成功',
    }
  })

  // 导入配置
  fastify.post('/config/import', { preHandler: [requirePermission('system:config')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { config, mode = 'merge' } = request.body as any

    if (!config || !config.modules) {
      return { code: 400, message: '无效的配置文件' }
    }

    const results: any[] = []

    for (const [moduleName, data] of Object.entries(config.modules)) {
      try {
        switch (moduleName) {
          case 'departments':
            results.push(await importDepartments(data, mode))
            break
          case 'positions':
            results.push(await importPositions(data, mode))
            break
          case 'vacationTypes':
            results.push(await importVacationTypes(data, mode))
            break
          case 'vacationRules':
            results.push(await importVacationRules(data, mode))
            break
          case 'attendanceRules':
            results.push(await importAttendanceRules(data, mode))
            break
          case 'payrollComponents':
            results.push(await importPayrollComponents(data, mode))
            break
          case 'scheduleTemplates':
            results.push(await importScheduleTemplates(data, mode))
            break
          case 'roles':
            results.push(await importRoles(data, mode))
            break
        }
      } catch (error: any) {
        results.push({
          module: moduleName,
          success: false,
          error: error.message,
        })
      }
    }

    setAudit(request, {
      module: 'system',
      action: 'config.import',
      requestData: { mode, moduleCount: Object.keys(config.modules).length },
    })

    return {
      code: 0,
      message: '配置导入完成',
      data: results,
    }
  })

  // 下载导出文件
  fastify.get('/config/export/download', { preHandler: [requirePermission('system:config')] }, async (request: FastifyRequest<{ Querystring: { id?: string } }>, reply) => {
    // 这里可以扩展为保存导出任务到数据库
    // 目前直接返回JSON格式
    return reply.send({ code: 0, message: '请使用 POST /api/config/export 接口导出配置' })
  })
}

// 导出函数
async function exportDepartments(includeData: boolean) {
  const departments = await prisma.department.findMany({
    where: { status: 'active' },
    include: includeData ? { employees: { select: { id: true } } } : undefined,
  })

  return {
    items: departments.map((d) => ({
      name: d.name,
      code: d.code,
      parentId: d.parentId,
      managerId: d.managerId,
      status: d.status,
      orderNum: d.orderNum,
    })),
    summary: { total: departments.length },
  }
}

async function exportPositions() {
  const positions = await prisma.position.findMany({
    where: { status: 'active' },
  })

  return {
    items: positions.map((p) => ({
      name: p.name,
      code: p.code,
      departmentId: p.departmentId,
      level: p.level,
      status: p.status,
    })),
    summary: { total: positions.length },
  }
}

async function exportVacationTypes() {
  const types = await prisma.vacationType.findMany()

  return {
    items: types.map((t) => ({
      name: t.name,
      code: t.code,
      unit: t.unit,
      isPaid: t.isPaid,
      defaultDays: t.defaultDays,
      maxDays: t.maxDays,
      accrualType: t.accrualType,
      accrualFrequency: t.accrualFrequency,
      accrualDay: t.accrualDay,
      carryOverLimit: t.carryOverLimit,
      isActive: t.isActive,
    })),
    summary: { total: types.length },
  }
}

async function exportVacationRules() {
  const rules = await prisma.vacationAccrualRule.findMany()

  return {
    items: rules.map((r) => ({
      name: r.name,
      vacationTypeId: r.vacationTypeId,
      employeeType: r.employeeType,
      yearsOfServiceMin: r.yearsOfServiceMin,
      yearsOfServiceMax: r.yearsOfServiceMax,
      accrualAmount: r.accrualAmount,
      maxBalance: r.maxBalance,
      isActive: r.isActive,
    })),
    summary: { total: rules.length },
  }
}

async function exportAttendanceRules() {
  const [lateRules, deductionRules] = await Promise.all([
    prisma.attendanceExceptionRule.findMany(),
    prisma.attendanceDeductionRule.findMany(),
  ])

  return {
    lateRules: lateRules.map((r) => ({
      name: r.name,
      type: r.type,
      thresholdMinutes: r.thresholdMinutes,
      action: r.action,
      isActive: r.isActive,
    })),
    deductionRules: deductionRules.map((r) => ({
      name: r.name,
      type: r.type,
      minMinutes: r.minMinutes,
      maxMinutes: r.maxMinutes,
      deductionType: r.deductionType,
      deductionValue: r.deductionValue,
      isActive: r.isActive,
    })),
    summary: { lateRules: lateRules.length, deductionRules: deductionRules.length },
  }
}

async function exportPayrollComponents() {
  const [salaryComponents, salaryRules] = await Promise.all([
    prisma.salaryComponent.findMany(),
    prisma.salaryCalculationRule.findMany(),
  ])

  return {
    salaryComponents: salaryComponents.map((c) => ({
      name: c.name,
      code: c.code,
      type: c.type,
      calculationType: c.calculationType,
      isTaxable: c.isTaxable,
      isActive: c.isActive,
    })),
    salaryRules: salaryRules.map((r) => ({
      name: r.name,
      type: r.type,
      condition: r.condition,
      formula: r.formula,
      isActive: r.isActive,
    })),
    summary: { salaryComponents: salaryComponents.length, salaryRules: salaryRules.length },
  }
}

async function exportScheduleTemplates() {
  const templates = await prisma.scheduleTemplate.findMany({
    include: {
      shifts: true,
    },
  })

  return {
    items: templates.map((t) => ({
      name: t.name,
      type: t.type,
      validFrom: t.validFrom,
      validTo: t.validTo,
      shifts: t.shifts.map((s) => ({
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        breakStart: s.breakStart,
        breakEnd: s.breakEnd,
        workHours: s.workHours,
      })),
      isActive: t.isActive,
    })),
    summary: { total: templates.length },
  }
}

async function exportRoles() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
    },
  })

  return {
    items: roles.map((r) => ({
      name: r.name,
      code: r.code,
      description: r.description,
      permissions: r.permissions.map((p) => p.permission),
      isActive: r.isActive,
    })),
    summary: { total: roles.length },
  }
}

// 导入函数
async function importDepartments(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.department.findFirst({ where: { OR: [{ code: item.code }, { name: item.name }] } })

    if (existing && mode === 'merge') {
      await prisma.department.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          managerId: item.managerId,
          status: item.status,
          orderNum: item.orderNum,
        },
      })
    } else if (!existing) {
      await prisma.department.create({
        data: {
          name: item.name,
          code: item.code,
          parentId: item.parentId,
          managerId: item.managerId,
          status: item.status || 'active',
          orderNum: item.orderNum || 0,
        },
      })
    }
    imported++
  }

  return { module: 'departments', success: true, imported }
}

async function importPositions(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.position.findFirst({ where: { OR: [{ code: item.code }, { name: item.name }] } })

    if (existing && mode === 'merge') {
      await prisma.position.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          departmentId: item.departmentId,
          level: item.level,
          status: item.status,
        },
      })
    } else if (!existing) {
      await prisma.position.create({
        data: {
          name: item.name,
          code: item.code,
          departmentId: item.departmentId,
          level: item.level,
          status: item.status || 'active',
        },
      })
    }
    imported++
  }

  return { module: 'positions', success: true, imported }
}

async function importVacationTypes(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.vacationType.findFirst({ where: { code: item.code } })

    if (existing && mode === 'merge') {
      await prisma.vacationType.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          unit: item.unit,
          isPaid: item.isPaid,
          defaultDays: item.defaultDays,
          maxDays: item.maxDays,
          accrualType: item.accrualType,
          accrualFrequency: item.accrualFrequency,
          accrualDay: item.accrualDay,
          carryOverLimit: item.carryOverLimit,
          isActive: item.isActive,
        },
      })
    } else if (!existing) {
      await prisma.vacationType.create({ data: item })
    }
    imported++
  }

  return { module: 'vacationTypes', success: true, imported }
}

async function importVacationRules(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.vacationAccrualRule.findFirst({
      where: { name: item.name, vacationTypeId: item.vacationTypeId },
    })

    if (existing && mode === 'merge') {
      await prisma.vacationAccrualRule.update({
        where: { id: existing.id },
        data: item,
      })
    } else if (!existing) {
      await prisma.vacationAccrualRule.create({ data: item })
    }
    imported++
  }

  return { module: 'vacationRules', success: true, imported }
}

async function importAttendanceRules(data: any, mode: string) {
  let imported = 0

  if (data.lateRules) {
    for (const item of data.lateRules) {
      const existing = await prisma.attendanceExceptionRule.findFirst({ where: { name: item.name } })
      if (existing && mode === 'merge') {
        await prisma.attendanceExceptionRule.update({ where: { id: existing.id }, data: item })
      } else if (!existing) {
        await prisma.attendanceExceptionRule.create({ data: item })
      }
      imported++
    }
  }

  if (data.deductionRules) {
    for (const item of data.deductionRules) {
      const existing = await prisma.attendanceDeductionRule.findFirst({ where: { name: item.name } })
      if (existing && mode === 'merge') {
        await prisma.attendanceDeductionRule.update({ where: { id: existing.id }, data: item })
      } else if (!existing) {
        await prisma.attendanceDeductionRule.create({ data: item })
      }
      imported++
    }
  }

  return { module: 'attendanceRules', success: true, imported }
}

async function importPayrollComponents(data: any, mode: string) {
  let imported = 0

  if (data.salaryComponents) {
    for (const item of data.salaryComponents) {
      const existing = await prisma.salaryComponent.findFirst({ where: { code: item.code } })
      if (existing && mode === 'merge') {
        await prisma.salaryComponent.update({ where: { id: existing.id }, data: item })
      } else if (!existing) {
        await prisma.salaryComponent.create({ data: item })
      }
      imported++
    }
  }

  return { module: 'payrollComponents', success: true, imported }
}

async function importScheduleTemplates(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.scheduleTemplate.findFirst({ where: { name: item.name } })

    if (existing && mode === 'merge') {
      await prisma.scheduleTemplate.update({
        where: { id: existing.id },
        data: {
          type: item.type,
          validFrom: item.validFrom,
          validTo: item.validTo,
          isActive: item.isActive,
        },
      })
    } else if (!existing) {
      await prisma.scheduleTemplate.create({
        data: {
          name: item.name,
          type: item.type,
          validFrom: item.validFrom,
          validTo: item.validTo,
          isActive: item.isActive,
          createdById: 1, // 系统管理员
          shifts: {
            create: item.shifts,
          },
        },
      })
    }
    imported++
  }

  return { module: 'scheduleTemplates', success: true, imported }
}

async function importRoles(data: any, mode: string) {
  if (!data.items) return { success: true, imported: 0 }

  let imported = 0
  for (const item of data.items) {
    const existing = await prisma.role.findFirst({ where: { code: item.code } })

    if (existing && mode === 'merge') {
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          description: item.description,
          isActive: item.isActive,
        },
      })

      // 更新权限
      await prisma.rolePermission.deleteMany({ where: { roleId: existing.id } })
      for (const permission of item.permissions) {
        await prisma.rolePermission.create({
          data: { roleId: existing.id, permission },
        })
      }
    } else if (!existing) {
      const role = await prisma.role.create({
        data: {
          name: item.name,
          code: item.code,
          description: item.description,
          isActive: item.isActive,
        },
      })

      for (const permission of item.permissions) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permission },
        })
      }
    }
    imported++
  }

  return { module: 'roles', success: true, imported }
}
