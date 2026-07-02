import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'
import { employeeStatusSchema } from '../../utils/schemas'

const employeeQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: z.string().trim().max(100).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: employeeStatusSchema.optional(),
})

const employeeUpdateSchema = z.object({
  status: employeeStatusSchema.optional(),
  gender: z.string().trim().max(10).optional().nullable(),
  birthDate: dateStringSchema.optional().nullable(),
  idCardNo: z.string().trim().max(20).optional().nullable(),
  nationality: z.string().trim().max(50).optional().nullable(),
  maritalStatus: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountNo: z.string().trim().max(50).optional().nullable(),
  probationEndDate: dateStringSchema.optional().nullable(),
  contractSignDate: dateStringSchema.optional().nullable(),
  terminationDate: dateStringSchema.optional().nullable(),
  terminationType: z.string().trim().max(50).optional().nullable(),
  terminationReason: z.string().trim().max(500).optional().nullable(),
  emergencyContact: z.string().trim().max(50).optional().nullable(),
  emergencyPhone: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  education: z.string().trim().max(20).optional().nullable(),
  skills: z.string().trim().max(500).optional().nullable(),
  remark: z.string().trim().max(500).optional().nullable(),
  salary: z.coerce.number().min(0).max(99999999).optional().nullable(),
  rating: z.coerce.number().int().min(0).max(5).optional().nullable(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少需要提交一个更新字段' }
)

export default async function employeeRoutes(fastify: FastifyInstance) {
  fastify.get('/employees', { preHandler: [requireAnyPermission(['employee:view', 'employee:manage'])] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(employeeQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, departmentId, status } = query
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)

    const where: any = { ...employeeScope }
    if (keyword) {
      where.user = {
        ...where.user,
        realName: { contains: keyword },
      }
    }
    if (departmentId) {
      where.user = { ...where.user, departmentId }
    }
    if (status) {
      where.status = status
    }

    const [total, list] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          employeeNo: true,
          status: true,
          hireDate: true,
          salary: true,
          rating: true,
          gender: true,
          birthDate: true,
          idCardNo: true,
          nationality: true,
          maritalStatus: true,
          bankName: true,
          bankAccountNo: true,
          probationEndDate: true,
          contractSignDate: true,
          terminationDate: true,
          terminationType: true,
          terminationReason: true,
          emergencyContact: true,
          emergencyPhone: true,
          address: true,
          education: true,
          skills: true,
          remark: true,
          supervisorId: true,
          supervisor: {
            select: {
              id: true,
              user: { select: { realName: true } },
            },
          },
          user: {
            select: {
              id: true,
              realName: true,
              phone: true,
              email: true,
              department: { select: { id: true, name: true } },
              position: { select: { id: true, name: true } },
            },
          },
          emergencyContacts: {
            orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
          },
        },
        orderBy: { id: 'desc' },
      }),
    ])

    const data = list.map((emp) => ({
      id: emp.id,
      employeeNo: emp.employeeNo,
      name: emp.user?.realName || '',
      department: emp.user?.department?.name || '',
      departmentId: emp.user?.department?.id,
      position: emp.user?.position?.name || '',
      phone: emp.user?.phone || '',
      email: emp.user?.email || '',
      hireDate: emp.hireDate,
      status: emp.status,
      salary: emp.salary,
      rating: emp.rating,
      gender: emp.gender,
      birthDate: emp.birthDate,
      idCardNo: emp.idCardNo,
      nationality: emp.nationality,
      maritalStatus: emp.maritalStatus,
      bankName: emp.bankName,
      bankAccountNo: emp.bankAccountNo,
      probationEndDate: emp.probationEndDate,
      contractSignDate: emp.contractSignDate,
      terminationDate: emp.terminationDate,
      terminationType: emp.terminationType,
      terminationReason: emp.terminationReason,
      emergencyContact: emp.emergencyContact,
      emergencyPhone: emp.emergencyPhone,
      address: emp.address,
      education: emp.education,
      skills: emp.skills,
      remark: emp.remark,
      supervisorId: emp.supervisorId,
      supervisorName: emp.supervisor?.user?.realName || '',
      emergencyContacts: emp.emergencyContacts,
    }))

    return { code: 0, data: { list: data, total, page, pageSize } }
  })

  fastify.get('/employees/:id', { preHandler: [requireAnyPermission(['employee:view', 'employee:manage'])] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNo: true,
        status: true,
        hireDate: true,
        salary: true,
        rating: true,
        gender: true,
        birthDate: true,
        idCardNo: true,
        nationality: true,
        maritalStatus: true,
        bankName: true,
        bankAccountNo: true,
        probationEndDate: true,
        contractSignDate: true,
        terminationDate: true,
        terminationType: true,
        terminationReason: true,
        emergencyContact: true,
        emergencyPhone: true,
        address: true,
        education: true,
        skills: true,
        remark: true,
        supervisorId: true,
        supervisor: {
          select: {
            id: true,
            user: { select: { realName: true } },
          },
        },
        user: {
          select: {
            id: true,
            realName: true,
            phone: true,
            email: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        emergencyContacts: {
          orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
        },
      },
    })

    if (!employee) {
      return reply.status(404).send({ code: 404, message: '员工不存在' })
    }

    const access = await canAccessEmployee(request.user, employee.id, { allowSelf: true })
    if (!access) {
      return reply.status(403).send({ code: 403, message: '无权查看该员工信息' })
    }

    const { getJSON, setJSON, isAvailable } = await import('../../utils/cache')
    const { CACHE_TTL } = await import('../../types/cache')
    const cacheKey = `hr:org:employees:${id}`

    if (isAvailable()) {
      const cached = await getJSON<any>(cacheKey)
      if (cached) {
        return { code: 0, data: cached }
      }
    }

    if (isAvailable()) {
      setJSON(cacheKey, employee, CACHE_TTL.EMPLOYEE_DETAIL)
    }

    return { code: 0, data: employee }
  })

  fastify.put('/employees/:id', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(employeeUpdateSchema, request.body)

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '员工不存在' })
    }

    setAudit(request, {
      module: 'employee',
      action: 'employee.update',
      requestData: body,
    })
    captureBefore(request, existing)

    const updateData: any = {}
    const dateFields = ['birthDate', 'probationEndDate', 'contractSignDate', 'terminationDate'] as const
    for (const [key, val] of Object.entries(body)) {
      if (val !== undefined) {
        if (dateFields.includes(key as any)) {
          updateData[key] = val ? new Date(val as string) : null
        } else {
          updateData[key] = val
        }
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    })

    setAfter(request, { id: employee.id })

    const { invalidate } = await import('../../utils/cache')
    invalidate(`hr:org:employees:${id}`)

    return { code: 0, message: '员工信息更新成功', data: employee }
  })

  fastify.delete('/employees/:id', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '员工不存在' })
    }

    setAudit(request, {
      module: 'employee',
      action: 'employee.delete',
      requestData: { id },
      beforeData: existing,
    })

    await prisma.employee.delete({ where: { id } })
    const { invalidate } = await import('../../utils/cache')
    invalidate(`hr:org:employees:${id}`)
    return { code: 0, message: '员工删除成功' }
  })

  // 批量删除员工
  fastify.post('/employees/batch-delete', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个员工'),
    }), request.body)

    const employees = await prisma.employee.findMany({
      where: { id: { in: ids } },
    })

    const { count } = await prisma.employee.deleteMany({
      where: { id: { in: ids } },
    })

    setAudit(request, {
      module: 'employee',
      action: 'employee.batchDelete',
      requestData: { ids, count },
    })

    return {
      code: 0,
      message: `成功删除 ${count} 名员工`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 批量更新员工状态
  fastify.post('/employees/batch-status', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个员工'),
      status: employeeStatusSchema,
    }), request.body)

    const employees = await prisma.employee.findMany({
      where: { id: { in: ids } },
    })

    const { count } = await prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    setAudit(request, {
      module: 'employee',
      action: 'employee.batchStatusUpdate',
      requestData: { ids, status, count },
    })

    return {
      code: 0,
      message: `成功更新 ${count} 名员工状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 员工变动记录（查询系统审计日志中员工模块的变更）
  fastify.get('/changes', { preHandler: [requireAnyPermission(['employee:view', 'employee:manage'])] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(z.object({
      page: z.unknown().optional(),
      pageSize: z.unknown().optional(),
      keyword: z.string().trim().max(100).optional(),
      type: z.string().trim().max(50).optional(),
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.optional(),
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, type, startDate, endDate } = query

    const where: any = { module: 'employee' }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
    }

    const [total, list] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          module: true,
          requestData: true,
          beforeData: true,
          afterData: true,
          username: true,
          createdAt: true,
        },
      }),
    ])

    const formatValue = (val: unknown): string => {
      if (!val) return '-'
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>
        const parts: string[] = []
        if (obj.status) parts.push(`状态: ${obj.status}`)
        if (obj.salary) parts.push(`薪资: ${obj.salary}`)
        if (obj.department) parts.push(`部门: ${obj.department}`)
        if (obj.position) parts.push(`岗位: ${obj.position}`)
        if (obj.userId) parts.push(`用户ID: ${obj.userId}`)
        return parts.length ? parts.join(', ') : JSON.stringify(val)
      }
      return String(val)
    }

    const typeMap: Record<string, string> = {
      employee_update: '信息变更',
      employee_delete: '删除员工',
      employee_create: '新增员工',
    }

    const data = list.map((log) => {
      const changeType = typeMap[log.action] || log.action
      let beforeContent = ''
      let afterContent = ''
      if (log.action === 'employee_update') {
        beforeContent = formatValue(log.beforeData)
        afterContent = formatValue(log.afterData)
      } else if (log.action === 'employee_delete') {
        beforeContent = formatValue(log.beforeData)
        afterContent = '-'
      } else if (log.action === 'employee_create') {
        beforeContent = '-'
        afterContent = formatValue(log.afterData)
      }

      // 从 afterData/beforeData 提取员工信息
      const empData = log.afterData || log.beforeData || {}
      const empObj = empData as Record<string, unknown>
      const userObj = empObj.user as Record<string, unknown> | undefined

      return {
        id: log.id,
        employeeName: userObj?.realName || (empObj as any)?.realName || '-',
        employeeNo: (empObj as any)?.employeeNo || '-',
        type: changeType,
        beforeContent,
        afterContent,
        changeDate: log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : '-',
        operator: log.username || '-',
        remark: log.action,
      }
    })

    let filtered = data
    if (keyword) {
      filtered = filtered.filter((r) =>
        r.employeeName.includes(keyword) || r.employeeNo.includes(keyword),
      )
    }
    if (type) {
      filtered = filtered.filter((r) => r.type === type)
    }

    return {
      code: 0,
      data: { list: filtered, total: filtered.length, page, pageSize },
    }
  })

  // ============================================================
  // 员工履历（Career Timeline）— 聚合生命周期事件 + 字段变更
  // ============================================================
  fastify.get('/employees/:id/career-timeline', { preHandler: [requireAnyPermission(['employee:view', 'employee:manage'])] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNo: true,
        status: true,
        hireDate: true,
        terminationDate: true,
        terminationType: true,
        terminationReason: true,
        probationEndDate: true,
        contractSignDate: true,
        user: {
          select: {
            realName: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!employee) {
      return reply.status(404).send({ code: 404, message: '员工不存在' })
    }

    const access = await canAccessEmployee(request.user, employee.id, { allowSelf: true })
    if (!access) {
      return reply.status(403).send({ code: 403, message: '无权查看该员工履历' })
    }

    // 并行获取三类数据源
    const [lifecycleEvents, infoChanges] = await Promise.all([
      // 1. 生命周期事件（入职、转正、调动、晋升、调薪、离职、再入职）
      prisma.employeeLifecycleEvent.findMany({
        where: {
          employeeId: id,
          status: 'completed',
        },
        orderBy: { effectiveDate: 'asc' },
        include: {
          creator: { select: { realName: true } },
        },
      }),

      // 2. 员工信息变更记录（职位、部门、薪资等字段级变更，无 operator 关联，单独查用户名）
      prisma.employeeChange.findMany({
        where: {
          employeeId: id,
          status: 'completed',
        },
        orderBy: { effectiveDate: 'asc' },
      }),
    ])

    // 收集操作人 ID（员工变更记录的 operatorId），批量查询用户名
    const operatorIds = infoChanges.map((c) => c.operatorId).filter(Boolean) as number[]

    const operatorMap = new Map<number, string>()
    if (operatorIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, realName: true },
      })
      for (const u of users) {
        operatorMap.set(u.id, u.realName)
      }
    }
    const timelineItems: Array<{
      type: string
      date: string
      title: string
      description?: string
      oldData?: Record<string, unknown>
      newData?: Record<string, unknown>
      operator?: string
    }> = []

    // 入职事件（从员工基础数据）
    if (employee.hireDate) {
      timelineItems.push({
        type: 'onboarding',
        date: new Date(employee.hireDate).toISOString().split('T')[0],
        title: '入职',
        description: `入职${employee.user?.department?.name || ''}`
          + `${employee.user?.position?.name ? '担任' + employee.user.position.name : ''}`,
      })
    }

    // 试用期转正
    if (employee.probationEndDate) {
      timelineItems.push({
        type: 'probation',
        date: new Date(employee.probationEndDate).toISOString().split('T')[0],
        title: '试用期结束',
      })
    }

    // 生命周期事件
    for (const evt of lifecycleEvents) {
      const labelMap: Record<string, string> = {
        onboarding: '入职',
        probation: '转正',
        transfer: '调动',
        promotion: '晋升',
        salary_adjustment: '调薪',
        offboarding: '离职',
        rehire: '再次入职',
      }

      timelineItems.push({
        type: evt.eventType,
        date: new Date(evt.effectiveDate).toISOString().split('T')[0],
        title: evt.title || labelMap[evt.eventType] || evt.eventType,
        description: evt.description || undefined,
        operator: evt.creator?.realName || undefined,
      })
    }

    // 字段级变更记录
    const typeNameMap: Record<string, string> = {
      basic_info: '基本信息变更',
      contact_info: '联系信息变更',
      position_info: '职位信息变更',
      other: '其他变更',
    }

    for (const chg of infoChanges) {
      const oldVal = chg.oldValue as Record<string, unknown> | null
      const newVal = chg.newValue as Record<string, unknown> | null

      // 提取有意义的变更描述
      const parts: string[] = []
      if (newVal && oldVal) {
        if (newVal.departmentId !== oldVal.departmentId) parts.push('部门调整')
        if (newVal.positionId !== oldVal.positionId) parts.push('岗位调整')
        if (newVal.salary !== oldVal.salary) {
          parts.push(`薪资 ${String(oldVal.salary ?? '?')} → ${String(newVal.salary ?? '?')}`)
        }
        if (newVal.status !== oldVal.status) {
          const statusLabels: Record<string, string> = {
            probation: '试用期',
            formal: '正式',
            contract: '合同工',
            terminated: '已离职',
            active: '在职',
            left: '离职',
          }
          parts.push(`状态 ${statusLabels[String(oldVal.status)] || oldVal.status} → ${statusLabels[String(newVal.status)] || newVal.status}`)
        }
        if (newVal.gender !== undefined && newVal.gender !== oldVal.gender) parts.push(`性别 ${oldVal.gender} → ${newVal.gender}`)
        if (newVal.phone !== undefined && newVal.phone !== oldVal.phone) parts.push('联系方式变更')
        if (newVal.email !== undefined && newVal.email !== oldVal.email) parts.push('邮箱变更')
        if (newVal.address !== undefined && newVal.address !== oldVal.address) parts.push('地址变更')
        if (newVal.emergencyContact !== undefined && newVal.emergencyContact !== oldVal.emergencyContact) parts.push('紧急联系人变更')
        if (newVal.bankAccountNo !== undefined && newVal.bankAccountNo !== oldVal.bankAccountNo) parts.push('银行账户变更')
      }

      const title = typeNameMap[chg.changeType] || '信息变更'
      const description = parts.length > 0 ? parts.join('、') : '字段变更'

      timelineItems.push({
        type: chg.changeType,
        date: new Date(chg.effectiveDate).toISOString().split('T')[0],
        title,
        description,
        oldData: oldVal || undefined,
        newData: newVal || undefined,
        operator: chg.operatorId ? operatorMap.get(chg.operatorId) || undefined : undefined,
      })
    }

    // 离职事件
    if (employee.terminationDate) {
      timelineItems.push({
        type: 'offboarding',
        date: new Date(employee.terminationDate).toISOString().split('T')[0],
        title: '离职',
        description: employee.terminationType
          ? `${employee.terminationType}${employee.terminationReason ? `：${employee.terminationReason}` : ''}`
          : undefined,
      })
    }

    // 当前状态
    if (employee.status === 'terminated' || employee.status === 'left') {
      // 已合并到离职事件
    } else {
      timelineItems.push({
        type: 'current',
        date: new Date().toISOString().split('T')[0],
        title: '当前',
        description: `${employee.user?.department?.name || ''} ${employee.user?.position?.name || ''}`,
      })
    }

    // 按日期排序（同一天的事件按逻辑顺序：入职→调动→晋升→调薪→变更→离职→再入职→当前）
    const typeOrder: Record<string, number> = {
      onboarding: 0,
      probation: 1,
      transfer: 2,
      promotion: 3,
      salary_adjustment: 4,
      basic_info: 5,
      contact_info: 5,
      position_info: 5,
      other: 5,
      offboarding: 8,
      rehire: 9,
      current: 10,
    }

    timelineItems.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5)
    })

    return {
      code: 0,
      data: {
        employee: {
          id: employee.id,
          employeeNo: employee.employeeNo,
          name: employee.user?.realName || '',
          department: employee.user?.department?.name || '',
          position: employee.user?.position?.name || '',
          status: employee.status,
        },
        timeline: timelineItems,
      },
    }
  })

  // 导出员工列表
  fastify.post('/employees/export', { preHandler: [requireAnyPermission(['employee:view', 'employee:manage'])] }, async (request: FastifyRequest<{
    Body: {
      departmentId?: number
      status?: string
      keyword?: string
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { departmentId, status, keyword, fields = [] } = body || {}

    const dataScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { ...dataScope }
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    if (keyword) {
      where.OR = [
        { employeeNo: { contains: keyword } },
        { user: { realName: { contains: keyword } } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNo: true,
        status: true,
        joinDate: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        user: {
          select: {
            realName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const exportFields = fields.length > 0 ? fields : ['employeeNo', 'realName', 'department', 'position', 'status', 'joinDate', 'phone', 'email']
    const rows = employees.map((emp: any) => ({
      employeeNo: emp.employeeNo,
      realName: emp.user?.realName || '-',
      department: emp.department?.name || '-',
      position: emp.position?.name || '-',
      status: emp.status === 'formal' ? '正式' : emp.status === 'probation' ? '试用期' : emp.status === 'intern' ? '实习' : '其他',
      joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString().split('T')[0] : '-',
      phone: emp.user?.phone || '-',
      email: emp.user?.email || '-',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `员工列表_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: exportFields,
        rows,
      },
    }
  })
}
