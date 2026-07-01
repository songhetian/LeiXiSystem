import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, validateData, optionalKeywordSchema, statusSchema } from '../utils/validation'

// --- Schemas ---
const categoryBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  categoryType: z.enum(['kb', 'doc']).optional().default('kb'),
  visibility: z.enum(['all', 'department', 'grade', 'personal']).optional().default('all'),
  visibilityConfig: z.any().optional().nullable(),
  status: statusSchema,
})

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  categoryType: z.enum(['kb', 'doc']).optional(),
  visibility: z.enum(['all', 'department', 'grade', 'personal']).optional(),
  visibilityConfig: z.any().optional().nullable(),
  status: statusSchema.optional(),
})

const articleListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  categoryId: z.coerce.number().int().positive().optional(),
  tags: z.string().optional(),
  status: z.string().optional(),
  categoryType: z.enum(['kb', 'doc']).optional(),
})

const articleBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  tags: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
})

const articleUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  tags: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  categoryType: z.enum(['kb', 'doc']).optional(),
})

const feedbackBodySchema = z.object({
  helpful: z.coerce.boolean(),
})

export default async function kbRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ─── Categories ───

  // GET /api/kb/categories - 分类树
  fastify.get('/categories', async (request: FastifyRequest<{
    Querystring: { categoryType?: string }
  }>) => {
    const categoryType = (request.query as any).categoryType
    const where: any = { status: 'active' }
    if (categoryType) where.categoryType = categoryType

    const categories = await prisma.kbCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { articles: true } } },
    })

    // 构建树形结构
    const tree: any[] = []
    const map = new Map<number, any>()

    for (const c of categories) {
      const node = {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        categoryType: c.categoryType,
        visibility: c.visibility,
        visibilityConfig: c.visibilityConfig,
        articleCount: c._count.articles,
        children: [] as any[],
      }
      map.set(c.id, node)
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node)
      } else {
        tree.push(node)
      }
    }

    return { code: 0, data: tree }
  })

  // POST /api/kb/categories - 创建分类
  fastify.post('/categories', { preHandler: [requirePermission('kb:manage')] }, async (request) => {
    const body = validateData(categoryBodySchema, request.body)
    const data = await prisma.kbCategory.create({ data: body })
    return { code: 0, data }
  })

  // PUT /api/kb/categories/:id - 更新分类
  fastify.put('/categories/:id', { preHandler: [requirePermission('kb:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(categoryUpdateSchema, request.body)
    const data = await prisma.kbCategory.update({
      where: { id: id },
      data: body,
    })
    return { code: 0, data }
  })

  // DELETE /api/kb/categories/:id - 删除分类
  fastify.delete('/categories/:id', { preHandler: [requirePermission('kb:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.kbCategory.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // ─── Articles ───

  // GET /api/kb/articles - 文章列表
  fastify.get('/articles', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; keyword?: string; categoryId?: number; tags?: string; status?: string; categoryType?: string }
  }>) => {
    const query = validateData(articleListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { content: { contains: query.keyword } },
        { tags: { contains: query.keyword } },
      ]
    }
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.tags) where.tags = { contains: query.tags }
    if (query.status) where.status = query.status
    else where.status = 'published'
    if (query.categoryType) {
      where.category = { categoryType: query.categoryType }
    }

    const [total, list] = await Promise.all([
      prisma.kbArticle.count({ where }),
      prisma.kbArticle.findMany({
        where,
        skip,
        take,
        include: { category: { select: { id: true, name: true, categoryType: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/kb/articles - 创建文章
  fastify.post('/articles', { preHandler: [requirePermission('kb:manage')] }, async (request) => {
    const body = validateData(articleBodySchema, request.body)
    const userId = (request as any).user.id
    const data = await prisma.kbArticle.create({
      data: { ...body, authorId: userId },
    })
    return { code: 0, data }
  })

  // GET /api/kb/articles/:id - 文章详情
  fastify.get('/articles/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const article = await prisma.kbArticle.findUnique({
      where: { id: id },
      include: { category: true },
    })

    if (!article) return { code: 404, message: '文章不存在' }

    // 增加阅读量
    await prisma.kbArticle.update({
      where: { id: id },
      data: { viewCount: { increment: 1 } },
    })

    return { code: 0, data: article }
  })

  // PUT /api/kb/articles/:id - 编辑文章
  fastify.put('/articles/:id', { preHandler: [requirePermission('kb:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(articleUpdateSchema, request.body)
    const data = await prisma.kbArticle.update({
      where: { id: id },
      data: body,
    })
    return { code: 0, data }
  })

  // DELETE /api/kb/articles/:id - 删除文章
  fastify.delete('/articles/:id', { preHandler: [requirePermission('kb:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.kbArticle.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // ─── Search ───

  // GET /api/kb/search - 全文搜索
  fastify.get('/search', async (request: FastifyRequest<{
    Querystring: { q: string; page?: number; pageSize?: number; categoryId?: number; categoryType?: string }
  }>) => {
    const query = validateData(searchQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {
      status: 'published',
      OR: [
        { title: { contains: query.q } },
        { content: { contains: query.q } },
        { tags: { contains: query.q } },
      ],
    }
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.categoryType) {
      where.category = { categoryType: query.categoryType }
    }

    const [total, list] = await Promise.all([
      prisma.kbArticle.count({ where }),
      prisma.kbArticle.findMany({
        where,
        skip,
        take,
        include: { category: { select: { id: true, name: true, categoryType: true } } },
        orderBy: [{ helpfulCount: 'desc' }, { viewCount: 'desc' }],
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list, keyword: query.q } }
  })

  // ─── Feedback ───

  // POST /api/kb/articles/:id/feedback - 文章评价
  fastify.post('/articles/:id/feedback', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(feedbackBodySchema, request.body)

    const article = await prisma.kbArticle.findUnique({ where: { id: id } })
    if (!article) return { code: 404, message: '文章不存在' }

    const updateData = body.helpful
      ? { helpfulCount: { increment: 1 } }
      : { notHelpfulCount: { increment: 1 } }

    await prisma.kbArticle.update({
      where: { id: id },
      data: updateData,
    })

    return { code: 0, message: '评价成功' }
  })

  // ─── Reference (工单引用知识库) ───

  // POST /api/kb/articles/:id/reference - 记录工单引用
  fastify.post('/articles/:id/reference', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = request.body as any
    const userId = (request as any).user.id

    if (!body.ticketId) return { code: 400, message: '缺少工单ID' }

    await prisma.kbArticleReference.create({
      data: {
        articleId: id,
        ticketId: body.ticketId,
        referencedBy: userId,
      },
    })

    return { code: 0, message: '引用记录成功' }
  })

  // GET /api/kb/articles/:id/references - 查看文章引用记录
  fastify.get('/articles/:id/references', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const refs = await prisma.kbArticleReference.findMany({
      where: { articleId: id },
      orderBy: { referencedAt: 'desc' },
      take: 50,
    })
    return { code: 0, data: refs }
  })
}
