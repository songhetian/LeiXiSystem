import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { hasPermission, requirePermission } from '../../middleware/permission'
import { idParamsSchema, validateData, dateStringSchema } from '../../utils/validation'
import { normalizePagination } from '../../utils/pagination'
import { setAudit, setAfter } from '../../plugins/audit'
import {
  getMyRequests,
  getRequests,
  getRequest,
  createRequest,
  approveRequest,
  rejectRequest,
  generateCertificate,
  cancelRequest,
} from '../../services/employeeCertificate'

const certificateTypeSchema = z.enum(['income', 'employment', 'residency', 'resignation', 'other'])
const certificateStatusSchema = z.enum(['pending', 'approved', 'rejected', 'generated'])
const languageSchema = z.enum(['zh-CN', 'en'])
const deliveryMethodSchema = z.enum(['electronic', 'paper'])

const myCertificatesQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: certificateStatusSchema.optional(),
  type: certificateTypeSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
})

const certificatesQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: certificateStatusSchema.optional(),
  type: certificateTypeSchema.optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  keyword: z.string().trim().max(100).optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
})

const createCertificateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  type: certificateTypeSchema,
  title: z.string().trim().max(200).optional(),
  purpose: z.string().trim().max(500).optional(),
  language: languageSchema.optional(),
  needSeal: z.boolean().optional(),
  deliveryMethod: deliveryMethodSchema.optional(),
  remark: z.string().trim().max(500).optional(),
})

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

const generateSchema = z.object({
  certificateUrl: z.string().trim().min(1).max(500),
})

export default async function certificateRoutes(fastify: FastifyInstance) {
  fastify.get('/certificates/my', async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(myCertificatesQuerySchema, request.query)
    const { page, pageSize } = normalizePagination(query)
    const result = await getMyRequests(request.user.id, {
      ...query,
      page,
      pageSize,
    })
    return { code: 0, data: result }
  })

  fastify.post('/certificates', async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(createCertificateSchema, request.body)
    const result = await createRequest(request.user.id, body.employeeId, body)

    setAudit(request, {
      module: 'employee',
      action: 'certificate.create',
      requestData: body,
    })
    setAfter(request, { id: result.id })

    return { code: 0, message: '证明申请创建成功', data: result }
  })

  fastify.get('/certificates', async (request: FastifyRequest<{
    Querystring: unknown
  }>, reply) => {
    const isManage = hasPermission(request, 'employee:manage')
    if (isManage) {
      const query = validateData(certificatesQuerySchema, request.query)
      const { page, pageSize } = normalizePagination(query)
      const result = await getRequests({
        ...query,
        page,
        pageSize,
      })
      return { code: 0, data: result }
    }

    const query = validateData(myCertificatesQuerySchema, request.query)
    const { page, pageSize } = normalizePagination(query)
    const result = await getMyRequests(request.user.id, {
      ...query,
      page,
      pageSize,
    })
    return { code: 0, data: result }
  })

  fastify.get('/certificates/:id', async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const result = await getRequest(id)

    const isManage = hasPermission(request, 'employee:manage')
    if (!isManage && result.userId !== request.user.id) {
      return reply.status(403).send({ code: 403, message: '无权查看该申请' })
    }

    return { code: 0, data: result }
  })

  fastify.delete('/certificates/:id', async (request: FastifyRequest<{
    Params: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await cancelRequest(id, request.user.id)

    setAudit(request, {
      module: 'employee',
      action: 'certificate.cancel',
      requestData: { id },
    })

    return { code: 0, message: '申请已取消' }
  })

  fastify.put('/certificates/:id/approve', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const result = await approveRequest(id, request.user.id)

    setAudit(request, {
      module: 'employee',
      action: 'certificate.approve',
      requestData: { id },
    })
    setAfter(request, { id: result.id })

    return { code: 0, message: '审批通过', data: result }
  })

  fastify.put('/certificates/:id/reject', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(rejectSchema, request.body)
    const result = await rejectRequest(id, request.user.id, body.reason)

    setAudit(request, {
      module: 'employee',
      action: 'certificate.reject',
      requestData: { id, reason: body.reason },
    })
    setAfter(request, { id: result.id })

    return { code: 0, message: '已驳回', data: result }
  })

  fastify.put('/certificates/:id/generate', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(generateSchema, request.body)
    const result = await generateCertificate(id, body.certificateUrl)

    setAudit(request, {
      module: 'employee',
      action: 'certificate.generate',
      requestData: { id, certificateUrl: body.certificateUrl },
    })
    setAfter(request, { id: result.id })

    return { code: 0, message: '证明已生成', data: result }
  })
}
