import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import {
  getTemplateList,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  getTemplateByCode,
} from '../services/messageTemplate'

export default async function messageTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      status?: string
      keyword?: string
    }
  }>) => {
    const result = await getTemplateList({
      page: request.query.page,
      pageSize: request.query.pageSize,
      type: request.query.type,
      status: request.query.status,
      keyword: request.query.keyword,
    })

    return { code: 0, data: result }
  })

  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: parseInt(request.params.id) },
      include: {
        createdBy: { select: { id: true, realName: true } },
      },
    })

    if (!template) {
      return { code: 404, message: '模板不存在' }
    }

    return { code: 0, data: template }
  })

  fastify.get('/code/:code', async (request: FastifyRequest<{
    Params: { code: string }
  }>) => {
    const template = await getTemplateByCode(request.params.code)
    if (!template) {
      return { code: 404, message: '模板不存在' }
    }
    return { code: 0, data: template }
  })

  fastify.post('/', async (request: FastifyRequest<{
    Body: {
      name: string
      code: string
      type: string
      title: string
      content: string
      variables?: any
      status?: string
    }
  }>) => {
    const template = await createTemplate({
      ...request.body,
      createdById: request.user.id,
    })

    return { code: 0, data: template, message: '创建成功' }
  })

  fastify.put('/:id', async (request: FastifyRequest<{
    Params: { id: string }
    Body: {
      name?: string
      type?: string
      title?: string
      content?: string
      variables?: any
      status?: string
    }
  }>) => {
    const template = await updateTemplate(parseInt(request.params.id), request.body)
    return { code: 0, data: template, message: '更新成功' }
  })

  fastify.delete('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: parseInt(request.params.id) },
    })
    if (template?.isSystem) {
      return { code: 400, message: '系统模板不可删除' }
    }

    await deleteTemplate(parseInt(request.params.id))
    return { code: 0, message: '删除成功' }
  })

  fastify.post('/:id/preview', async (request: FastifyRequest<{
    Params: { id: string }
    Body: {
      variables?: Record<string, any>
    }
  }>) => {
    const result = await previewTemplate(
      parseInt(request.params.id),
      request.body.variables || {}
    )
    return { code: 0, data: result }
  })
}
