import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { taskListQuerySchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeOmit } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { parseSafeHttpUrl } from '../../utils/security'

const documentSchema = z.object({
  employeeId: positiveIntSchema,
  name: z.string().trim().min(1).max(100),
  documentType: z.string().trim().min(1).max(50),
  fileUrl: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive', 'expired']).optional().default('active'),
  expiresAt: dateStringSchema.optional().nullable(),
})

const documentUpdateSchema = partialUpdateSchema(safeOmit(documentSchema, ['employeeId']))

function normalizeFileUrl(fileUrl?: string | null) {
  return fileUrl ? parseSafeHttpUrl(fileUrl, { allowPrivateHosts: true }) : undefined
}

export default async function documentsRoutes(fastify: FastifyInstance) {
  fastify.get('/documents', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) {
      const access = await canAccessEmployee(request.user, query.employeeId, { allowSelf: true })
      if (!access) return { code: 403, message: '无权查看该员工的文档' }
      where.employeeId = query.employeeId
    }
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.employeeDocument.count({ where }),
      prisma.employeeDocument.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          employeeId: true,
          name: true,
          documentType: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.get('/documents/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const doc = await prisma.employeeDocument.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, user: { select: { realName: true } } } },
      },
    })
    if (!doc) return { code: 404, message: '文档不存在' }

    const access = await canAccessEmployee(request.user, doc.employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该文档' }

    return { code: 0, data: doc }
  })

  fastify.post('/documents', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(documentSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'document.create',
      module: 'lifecycle',
      requestData: body,
    })

    const doc = await prisma.employeeDocument.create({
      data: {
        ...body,
        fileUrl: normalizeFileUrl(body.fileUrl),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })

    setAfter(request, { id: doc.id })

    return { code: 0, message: '创建成功', data: doc }
  })

  fastify.put('/documents/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(documentUpdateSchema, request.body)
    requireAtLeastOneField(data)

    setAudit(request, {
      action: 'document.update',
      module: 'lifecycle',
      requestData: data,
    })

    const doc = await prisma.employeeDocument.findUnique({ where: { id } })
    if (!doc) return { code: 404, message: '文档不存在' }

    captureBefore(request, { id: doc.id, status: doc.status })

    const updated = await prisma.employeeDocument.update({
      where: { id },
      data: {
        ...data,
        fileUrl: data.fileUrl !== undefined ? normalizeFileUrl(data.fileUrl) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    })

    setAfter(request, { id: updated.id, status: updated.status })

    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/documents/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const doc = await prisma.employeeDocument.findUnique({ where: { id } })
    if (!doc) return { code: 404, message: '文档不存在' }

    setAudit(request, {
      action: 'document.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: doc,
    })

    await prisma.employeeDocument.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })
}
