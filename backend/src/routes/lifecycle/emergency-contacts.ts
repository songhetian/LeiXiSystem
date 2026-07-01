import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { idParamsSchema, positiveIntSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeOmit } from '../../utils/validation'

const emergencyContactSchema = z.object({
  employeeId: positiveIntSchema,
  name: z.string().trim().min(1).max(50),
  relationship: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(1).max(20),
  isPrimary: z.boolean().optional().default(false),
})

const emergencyContactUpdateSchema = partialUpdateSchema(safeOmit(emergencyContactSchema, ['employeeId']))

export default async function emergencyContactsRoutes(fastify: FastifyInstance) {
  fastify.get('/emergency-contacts', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number }
  }>) => {
    const employeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined
    if (!employeeId) {
      return { code: 400, message: 'employeeId 必填' }
    }

    const access = await canAccessEmployee(request.user, employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该员工的紧急联系人' }

    const list = await prisma.employeeEmergencyContact.findMany({
      where: { employeeId },
      orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
    })

    return { code: 0, data: list }
  })

  fastify.get('/emergency-contacts/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const contact = await prisma.employeeEmergencyContact.findUnique({ where: { id } })
    if (!contact) return { code: 404, message: '紧急联系人不存在' }

    const access = await canAccessEmployee(request.user, contact.employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该紧急联系人' }

    return { code: 0, data: contact }
  })

  fastify.post('/emergency-contacts', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(emergencyContactSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'contact.create',
      module: 'lifecycle',
      requestData: body,
    })

    const contact = await prisma.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.employeeEmergencyContact.updateMany({
          where: { employeeId: body.employeeId, isPrimary: true },
          data: { isPrimary: false },
        })
      }
      return tx.employeeEmergencyContact.create({ data: body })
    })

    setAfter(request, { id: contact.id })
    return { code: 0, message: '创建成功', data: contact }
  })

  fastify.put('/emergency-contacts/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(emergencyContactUpdateSchema, request.body)
    requireAtLeastOneField(data)

    const existing = await prisma.employeeEmergencyContact.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '紧急联系人不存在' }

    setAudit(request, {
      action: 'contact.update',
      module: 'lifecycle',
      requestData: { id, ...data },
    })
    captureBefore(request, existing)

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.employeeEmergencyContact.updateMany({
          where: { employeeId: existing.employeeId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        })
      }
      return tx.employeeEmergencyContact.update({ where: { id }, data: data })
    })

    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/emergency-contacts/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.employeeEmergencyContact.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '紧急联系人不存在' }

    setAudit(request, {
      action: 'contact.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: existing,
    })

    await prisma.employeeEmergencyContact.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })
}
