import { z } from 'zod';

/**
 * 运行环境校验 schema（T19.1）。
 * 启动时由 ConfigModule 的 validate 函数调用，非法 env 直接 fail-fast。
 * 约束随垂直切片逐步收紧（min length / URL 格式 / 可选变量）。
 */
export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine((v) => v.startsWith('mysql://'), 'DATABASE_URL 必须是 mysql:// 协议'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET 至少 8 位'),
});

export type EnvConfig = z.infer<typeof envSchema>;
