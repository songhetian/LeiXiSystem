import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const assignmentQuerySchema = z.object({
  employeeId: positiveIntSchema.optional(),
  status: z.string().trim().max(30).optional(),
})

const assignmentCreateSchema = z.object({
  employeeId: positiveIntSchema,
  salaryStructureId: positiveIntSchema,
  baseSalary: z.coerce.number().min(0).max(99999999),
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
}).refine((value) => !value.effectiveTo || new Date(value.effectiveFrom) <= new Date(value.effectiveTo), {
  message: '生效开始日期不能晚于结束日期',
})

const assignmentUpdateSchema = assignmentCreateSchema.omit({ employeeId: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少需要提交一个更新字段' }
)

export default async function assignmentsRoutes(fastify: FastifyInstance) {
  fastify.get('/assignments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(assignmentQuerySchema, request.query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const list = await prisma.salaryAssignment.findMany({
      where,
      include: {
        employee: { include: { user: { include: { department: true } } } },
        salaryStructure: true,
      },
      orderBy: { id: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/assignments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(assignmentCreateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.assignment.create',
      requestData: body,
    })
    const assignment = await prisma.salaryAssignment.create({
      data: {
        employeeId: body.employeeId,
        salaryStructureId: body.salaryStructureId,
        baseSalary: body.baseSalary,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        status: body.status,
      },
      include: {
        employee: { include: { user: true } },
        salaryStructure: true,
      },
    })

    setAfter(request, { id: assignment.id })

    return { code: 0, message: '员工薪资分配创建成功', data: assignment }
  })

  fastify.put('/assignments/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(assignmentUpdateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.assignment.update',
      requestData: body,
    })
    const existing = await prisma.salaryAssignment.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '员工薪资分配不存在' })
    }

    captureBefore(request, existing)
    const assignment = await prisma.salaryAssignment.update({
      where: { id },
      data: {
        salaryStructureId: body.salaryStructureId,
        baseSalary: body.baseSalary,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo !== undefined ? (body.effectiveTo ? new Date(body.effectiveTo) : null) : undefined,
        status: body.status,
      },
      include: {
        employee: { include: { user: true } },
        salaryStructure: true,
      },
    })

    setAfter(request, { id: assignment.id })

    return { code: 0, message: '员工薪资分配更新成功', data: assignment }
  })
}
