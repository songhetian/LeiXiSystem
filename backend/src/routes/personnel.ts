import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const employeeListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: statusSchema,
})

const employeeBodySchema = z.object({
  username: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和横线'),
  password: z.string().min(8).max(128).optional(),
  realName: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(100).optional().nullable(),
  phone: z.string().trim().max(20).regex(/^[0-9+\-\s]*$/, '手机号格式不合法').optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  positionId: positiveIntSchema.optional().nullable(),
  employeeNo: z.string().trim().min(1).max(20),
  hireDate: dateStringSchema,
  salary: z.coerce.number().min(0).max(99999999).optional().nullable(),
  status: statusSchema,
  education: z.string().trim().max(20).optional().nullable(),
  skills: z.string().trim().max(1000).optional().nullable(),
  remark: z.string().trim().max(1000).optional().nullable(),
})

const employeeUpdateSchema = employeeBodySchema.omit({ username: true, password: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const changeListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  changeType: z.string().trim().max(50).optional(),
})

export default async function personnelRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/employees/:id', { preHandler: [requireAnyPermission(['personnel:view', 'personnel:employee:view'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            department: true,
            position: true,
            userRoles: { include: { role: true } },
          },
        },
        changes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        overtimeRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        vacationBalances: {
          include: { vacationType: true },
        },
      },
    })

    if (!employee) {
      return { code: 404, message: '员工不存在' }
    }

    const canViewAll = hasPermission(request, 'personnel:view') || hasPermission(request, 'personnel:employee:view')
    if (!canViewAll && employee.userId !== request.user.id) {
      return { code: 403, message: '没有权限查看该员工' }
    }

    return {
      code: 0,
      data: {
        id: employee.id,
        userId: employee.userId,
        employeeNo: employee.employeeNo,
        realName: employee.user.realName,
        username: employee.user.username,
        email: employee.user.email,
        phone: employee.user.phone,
        avatar: employee.user.avatar,
        departmentId: employee.user.departmentId,
        departmentName: employee.user.department?.name,
        positionId: employee.user.positionId,
        positionName: employee.user.position?.name,
        hireDate: employee.hireDate,
        salary: employee.salary,
        status: employee.status,
        rating: employee.rating,
        education: employee.education,
        emergencyContact: employee.emergencyContact,
        emergencyPhone: employee.emergencyPhone,
        address: employee.address,
        skills: employee.skills,
        remark: employee.remark,
        isDeptManager: employee.user.isDeptManager,
        roles: employee.user.userRoles.map((ur) => ur.role.name),
        vacationBalances: employee.vacationBalances.map((vb) => ({
          id: vb.id,
          vacationTypeId: vb.vacationTypeId,
          typeName: vb.vacationType.name,
          typeCode: vb.vacationType.code,
          total: vb.total,
          used: vb.used,
          balance: vb.balance,
        })),
        recentChanges: employee.changes,
        recentLeaves: employee.leaveRequests,
        recentOvertimes: employee.overtimeRequests,
      },
    }
  })

  fastify.get('/employees', { preHandler: [requireAnyPermission(['personnel:view', 'personnel:employee:view'])] }, async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; keyword?: string; departmentId?: number; status?: string }
  }>) => {
    const query = validateData(employeeListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, departmentId, status } = query

    const where: any = {}
    if (keyword) {
      where.OR = [
        { user: { realName: { contains: keyword } } },
        { employeeNo: { contains: keyword } },
      ]
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
        orderBy: { id: 'desc' },
        include: {
          user: {
            include: { department: true, position: true },
          },
        },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          id: item.id,
          userId: item.userId,
          employeeNo: item.employeeNo,
          realName: item.user.realName,
          email: item.user.email,
          phone: item.user.phone,
          departmentId: item.user.departmentId,
          departmentName: item.user.department?.name,
          positionId: item.user.positionId,
          positionName: item.user.position?.name,
          hireDate: item.hireDate,
          salary: item.salary,
          status: item.status,
          rating: item.rating,
          education: item.education,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/employees', { preHandler: [requireAnyPermission(['personnel:create', 'personnel:employee:create'])] }, async (request: FastifyRequest<{
    Body: any
  }>, reply) => {
    const body = validateData(employeeBodySchema, request.body)

    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(body.password || '123456', 10)

    const result = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: hashedPassword,
        realName: body.realName,
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId ?? undefined,
        positionId: body.positionId ?? undefined,
        status: 'active',
        employee: {
          create: {
            employeeNo: body.employeeNo,
            hireDate: new Date(body.hireDate),
            salary: body.salary ?? undefined,
            education: body.education,
            skills: body.skills,
            remark: body.remark,
          },
        },
      },
      include: { employee: true, department: true, position: true },
    })

    return {
      code: 0,
      message: '创建成功',
      data: {
        id: result.employee?.id,
        userId: result.id,
        employeeNo: result.employee?.employeeNo,
        realName: result.realName,
      },
    }
  })

  fastify.put('/employees/:id', { preHandler: [requireAnyPermission(['personnel:edit', 'personnel:employee:update'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: any
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(employeeUpdateSchema, request.body)

    const employee = await prisma.employee.findUnique({
      where: { id },
    })

    if (!employee) {
      return { code: 404, message: '员工不存在' }
    }

    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        realName: body.realName,
        email: body.email,
        phone: body.phone,
        departmentId: body.departmentId ?? undefined,
        positionId: body.positionId ?? undefined,
        status: body.status,
      },
    })

    await prisma.employee.update({
      where: { id },
      data: {
        employeeNo: body.employeeNo,
        hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
        salary: body.salary,
        education: body.education,
        skills: body.skills,
        remark: body.remark,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/employees/:id', { preHandler: [requireAnyPermission(['personnel:delete', 'personnel:employee:delete'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const employee = await prisma.employee.findUnique({
      where: { id },
    })

    if (!employee) {
      return { code: 404, message: '员工不存在' }
    }

    await prisma.user.update({
      where: { id: employee.userId },
      data: { status: 'deleted' },
    })

    await prisma.employee.update({
      where: { id },
      data: { status: 'deleted' },
    })

    return { code: 0, message: '删除成功' }
  })

  fastify.get('/changes', { preHandler: [requireAnyPermission(['personnel:view', 'personnel:employee:view'])] }, async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; employeeId?: number; changeType?: string }
  }>) => {
    const query = validateData(changeListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { employeeId, changeType } = query

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (changeType) where.changeType = changeType

    const [total, list] = await Promise.all([
      prisma.employeeChange.count({ where }),
      prisma.employeeChange.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { employee: { include: { user: true } } },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          id: item.id,
          employeeId: item.employeeId,
          employeeName: item.employee.user.realName,
          changeType: item.changeType,
          oldValue: item.oldValue,
          newValue: item.newValue,
          reason: item.reason,
          effectiveDate: item.effectiveDate,
          status: item.status,
          createdAt: item.createdAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })
}
