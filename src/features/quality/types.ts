import { z } from 'zod';

// 质检评分规则 Schema
export const qualityRuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  criteria: z.string().nullable(),
  score_weight: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

// 质检会话 Schema (精简版，用于列表)
export const qualitySessionSchema = z.object({
  id: z.number(),
  session_no: z.string(),
  agent_name: z.string().nullable(),
  customer_name: z.string().nullable(),
  score: z.number().nullable(),
  grade: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
});

export type QualityRule = z.infer<typeof qualityRuleSchema>;
export type QualitySession = z.infer<typeof qualitySessionSchema>;

export interface QualityFilters {
  category?: string;
  status?: string;
  keyword?: string;
  date_range?: [Date | null, Date | null];
}
