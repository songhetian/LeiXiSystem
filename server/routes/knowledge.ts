import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { connection as redis } from '../lib/redis';

export const categorySchema = z.object({
  id: z.number().or(z.bigint()).transform(val => Number(val)),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  is_public: z.number().or(z.boolean()).transform(val => !!val),
  owner_id: z.number().nullable().optional(),
});

export const articleSchema = z.object({
  id: z.number().or(z.bigint()).transform(val => Number(val)),
  title: z.string(),
  summary: z.string().nullable(),
  content: z.string().optional(),
  view_count: z.number(),
  like_count: z.number(),
  status: z.string(),
  created_at: z.date().or(z.string()),
  category_name: z.string().optional(),
});

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get('/api/knowledge/categories', {
    schema: {
      querystring: z.object({ type: z.string().optional() }),
      response: { 200: z.object({ success: z.boolean(), data: z.array(categorySchema) }) },
    },
  }, async (request) => {
    const { type } = request.query;
    const categories = await prisma.knowledge_categories.findMany({
      where: { is_deleted: false, type: type || 'common' },
      orderBy: { created_at: 'desc' }
    });
    return { success: true, data: categories as any };
  });

  app.get('/api/knowledge/articles', {
    schema: {
      querystring: z.object({
        category_id: z.string().optional(),
        search: z.string().optional(),
        page: z.string().optional().default('1'),
        pageSize: z.string().optional().default('20'),
      }),
      response: {
        200: z.object({ success: z.boolean(), data: z.array(articleSchema), total: z.number() }),
      },
    },
  }, async (request) => {
    const { category_id, search, page, pageSize } = request.query;
    const p = parseInt(page);
    const ps = parseInt(pageSize);

    const where: any = {
      is_deleted: false,
      category_id: category_id ? Number(category_id) : undefined,
      OR: search ? [
        { title: { contains: search } },
        { summary: { contains: search } }
      ] : undefined
    };

    const [total, articles] = await Promise.all([
      prisma.knowledge_articles.count({ where }),
      prisma.knowledge_articles.findMany({
        where,
        include: { knowledge_categories: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      })
    ]);

    return {
      success: true,
      data: articles.map(a => ({ ...a, category_name: a.knowledge_categories?.name })) as any,
      total
    };
  });

  app.post('/api/knowledge/articles', {
    schema: {
      body: z.object({
        title: z.string(),
        content: z.string(),
        category_id: z.number().optional(),
        summary: z.string().optional(),
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, message: 'Unauthorized' });

    const body = request.body;
    const article = await prisma.knowledge_articles.create({
      data: {
        ...body,
        created_by: BigInt(userId),
        status: 'published',
        view_count: 0,
        like_count: 0,
      }
    });

    return { success: true, id: Number(article.id) };
  });

  app.post('/api/knowledge/articles/:id/view', {
    schema: { params: z.object({ id: z.string() }) },
  }, async (request) => {
    const { id } = request.params;
    await redis.hincrby('stats:knowledge:views', id, 1);
    return { success: true };
  });
}
