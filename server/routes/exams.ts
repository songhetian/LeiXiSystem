import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';

// 1. 定义巅峰序列化 Schema (题型枚举全还原)
export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'essay']),
  content: z.string(),
  options: z.array(z.string()).optional(),
  correct_answer: z.any(),
  score: z.number(),
});

export const examSchema = z.object({
  id: z.number(),
  title: z.string(),
  category_id: z.number().nullable(),
  duration: z.number(),
  total_score: z.number().transform(Number),
  pass_score: z.number().transform(Number),
  status: z.string(),
  questions: z.string().optional(),
  created_at: z.date().or(z.string()),
});

export default async function examRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // --- 分类架构闭环 ---
  app.get('/api/exams/categories', {
    schema: { response: { 200: z.object({ success: z.boolean(), data: z.array(z.any()) }) } }
  }, async () => {
    const cats = await prisma.exam_categories.findMany({ where: { status: 'active' } });
    return { success: true, data: cats as any };
  });

  app.get('/api/exams/list', {
    schema: {
      querystring: z.object({
        status: z.string().optional(),
        keyword: z.string().optional(),
        page: z.string().optional().default('1'),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(examSchema.extend({ creator_name: z.string().optional() })),
          total: z.number(),
        }),
      },
    },
  }, async (request) => {
    const page = Number(request.query.page || '1');
    const where = {
      status: request.query.status && request.query.status !== 'all' ? request.query.status as any : undefined,
      title: request.query.keyword ? { contains: request.query.keyword } : undefined,
    };

    const [total, rows] = await Promise.all([
      prisma.exams.count({ where }),
      prisma.exams.findMany({
        where,
        include: { users: { select: { real_name: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
    ]);

    return {
      success: true,
      total,
      data: rows.map((row) => ({
        ...row,
        total_score: Number(row.total_score),
        pass_score: Number(row.pass_score),
        creator_name: row.users?.real_name,
      })) as any,
    };
  });

  app.get('/api/exams/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean(), data: examSchema }),
      },
    },
  }, async (request, reply) => {
    const exam = await prisma.exams.findUnique({ where: { id: Number(request.params.id) } });
    if (!exam) return reply.code(404).send({ success: false, data: {} as any });

    return {
      success: true,
      data: {
        ...exam,
        total_score: Number(exam.total_score),
        pass_score: Number(exam.pass_score),
      } as any,
    };
  });

  app.post('/api/exams', {
    schema: {
      body: z.object({
        title: z.string().min(1),
        duration: z.number().optional(),
        pass_score: z.number().optional(),
        questions: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.boolean(), id: z.number() }) },
    },
  }, async (request) => {
    const userId = (request as any).user?.id;
    const body = request.body;
    const questions = JSON.parse(body.questions || '[]');
    const totalScore = questions.reduce((sum: number, q: any) => sum + Number(q.score || 0), 0);

    const exam = await prisma.exams.create({
      data: {
        title: body.title,
        duration: body.duration || 60,
        pass_score: body.pass_score || 60,
        total_score: totalScore,
        question_count: questions.length,
        questions: body.questions || '[]',
        created_by: userId,
      },
    });

    return { success: true, id: exam.id };
  });

  app.put('/api/exams/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        title: z.string().min(1).optional(),
        duration: z.number().optional(),
        pass_score: z.number().optional(),
        questions: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.boolean() }) },
    },
  }, async (request) => {
    const body = request.body;
    const questions = JSON.parse(body.questions || '[]');
    const totalScore = questions.reduce((sum: number, q: any) => sum + Number(q.score || 0), 0);

    await prisma.exams.update({
      where: { id: Number(request.params.id) },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.duration !== undefined ? { duration: body.duration } : {}),
        ...(body.pass_score !== undefined ? { pass_score: body.pass_score } : {}),
        ...(body.questions !== undefined
          ? {
              questions: body.questions,
              question_count: questions.length,
              total_score: totalScore,
            }
          : {}),
      },
    });

    return { success: true };
  });

  app.post('/api/exams/assessment/start', {
    schema: {
      body: z.object({ planId: z.number() }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            result_id: z.number(),
            duration: z.number(),
            questions: z.array(z.any()),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ success: false, data: {} as any });

    const plan = await prisma.assessment_plans.findUnique({
      where: { id: request.body.planId },
      include: { exams: true },
    });

    if (!plan) return reply.code(404).send({ success: false, data: {} as any });

    const result = await prisma.assessment_results.create({
      data: {
        plan_id: plan.id,
        exam_id: plan.exam_id,
        user_id: userId,
        attempt_number: 1,
        start_time: new Date(),
        status: 'in_progress',
      },
    });

    return {
      success: true,
      data: {
        result_id: result.id,
        duration: plan.exams.duration,
        questions: JSON.parse(plan.exams.questions || '[]'),
      },
    };
  });

  // --- 试卷管理 (物理清除 Raw SQL) ---
  app.put('/api/exams/assessment/answer', {
    schema: {
      body: z.object({
        resultId: z.number(),
        questionId: z.string(),
        answer: z.string(),
      })
    }
  }, async (request) => {
    const { resultId, questionId, answer } = request.body;
    
    // 规约执行：使用纯净 Prisma upsert 代替 Raw SQL
    // 假设 answer_records 表已在 schema 中定义了 result_id_question_id 唯一索引
    await prisma.answer_records.upsert({
      where: {
        result_id_question_id: {
          result_id: resultId,
          question_id: questionId
        }
      },
      update: { user_answer: answer },
      create: {
        result_id: resultId,
        question_id: questionId,
        user_answer: answer,
        created_at: new Date()
      }
    });

    return { success: true };
  });

  // 物理还原：全题型自动评分引擎
  app.post('/api/exams/assessment/submit', {
    schema: { body: z.object({ resultId: z.number() }) }
  }, async (request) => {
    const { resultId } = request.body;

    return await prisma.$transaction(async (tx) => {
      const result = await tx.assessment_results.findUnique({
        where: { id: resultId },
        include: { exams: true }
      });

      if (!result) throw new Error('Result not found');

      const userAnswers = await tx.answer_records.findMany({ where: { result_id: resultId } });
      const questions = JSON.parse(result.exams.questions || '[]');
      
      let totalScore = 0;
      let hasEssay = false;

      for (const q of questions) {
        const userAns = userAnswers.find(ua => ua.question_id === String(q.id));
        if (!userAns) continue;

        let isCorrect = false;
        if (q.type === 'essay') {
          hasEssay = true;
          continue; // 主观题跳过自动评分
        }

        // 逻辑还原：多选与判断的匹配算法
        if (q.type === 'multiple_choice') {
          const userArr = JSON.parse(userAns.user_answer || '[]').sort();
          const correctArr = q.correct_answer.sort();
          isCorrect = JSON.stringify(userArr) === JSON.stringify(correctArr);
        } else {
          isCorrect = userAns.user_answer === q.correct_answer;
        }

        if (isCorrect) {
          totalScore += Number(q.score);
          await tx.answer_records.update({
            where: { id: userAns.id },
            data: { is_correct: true, score: Number(q.score) }
          });
        }
      }

      await tx.assessment_results.update({
        where: { id: resultId },
        data: {
          score: totalScore,
          status: hasEssay ? 'submitted' : 'graded',
          submit_time: new Date()
        }
      });

      return { success: true, score: totalScore, status: hasEssay ? 'pending_manual' : 'completed' };
    });
  });
}
