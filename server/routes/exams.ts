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
