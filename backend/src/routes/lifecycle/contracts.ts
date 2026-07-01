import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { taskListQuerySchema, contractStatusSchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeOmit } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { parseSafeHttpUrl } from '../../utils/security'

const contractSchema = z.object({
  employeeId: positiveIntSchema,
  contractNo: z.string().trim().min(1).max(100),
  contractType: z.string().trim().min(1).max(50),
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional().nullable(),
  status: contractStatusSchema.optional().default('active'),
  fileUrl: z.string().trim().max(500).optional().nullable(),
}).refine((value) => !value.endDate || new Date(value.startDate) <= new Date(value.endDate), {
  message: '合同开始日期不能晚于结束日期',
})

const contractUpdateSchema = partialUpdateSchema(safeOmit(contractSchema, ['employeeId']))

function normalizeFileUrl(fileUrl?: string | null) {
  return fileUrl ? parseSafeHttpUrl(fileUrl, { allowPrivateHosts: true }) : undefined
}

export default async function contractsRoutes(fastify: FastifyInstance) {
  fastify.get('/contracts', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) {
      const access = await canAccessEmployee(request.user, query.employeeId, { allowSelf: true })
      if (!access) return { code: 403, message: '无权查看该员工的合同' }
      where.employeeId = query.employeeId
    }
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.employeeContract.count({ where }),
      prisma.employeeContract.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          employeeId: true,
          contractNo: true,
          contractType: true,
          startDate: true,
          endDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.get('/contracts/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const contract = await prisma.employeeContract.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, user: { select: { realName: true } } } },
      },
    })
    if (!contract) return { code: 404, message: '合同不存在' }

    const access = await canAccessEmployee(request.user, contract.employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该合同' }

    return { code: 0, data: contract }
  })

  fastify.post('/contracts', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(contractSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'contract.create',
      module: 'lifecycle',
      requestData: body,
    })

    const contract = await prisma.employeeContract.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        fileUrl: normalizeFileUrl(body.fileUrl),
      },
    })

    setAfter(request, { id: contract.id })

    return { code: 0, message: '创建成功', data: contract }
  })

  fastify.put('/contracts/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(contractUpdateSchema, request.body)
    requireAtLeastOneField(data)

    setAudit(request, {
      action: 'contract.update',
      module: 'lifecycle',
      requestData: data,
    })

    const contract = await prisma.employeeContract.findUnique({ where: { id } })
    if (!contract) return { code: 404, message: '合同不存在' }

    captureBefore(request, { id: contract.id, status: contract.status })

    const updated = await prisma.employeeContract.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        fileUrl: data.fileUrl !== undefined ? normalizeFileUrl(data.fileUrl) : undefined,
      },
    })

    setAfter(request, { id: updated.id, status: updated.status })

    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/contracts/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const contract = await prisma.employeeContract.findUnique({ where: { id } })
    if (!contract) return { code: 404, message: '合同不存在' }

    setAudit(request, {
      action: 'contract.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: contract,
    })

    await prisma.employeeContract.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })
}
