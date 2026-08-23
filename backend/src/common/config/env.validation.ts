import { z } from 'zod';

/**
 * 运行环境校验 schema。
 * 启动时由 ConfigModule 的 validate 函数调用，非法 env 直接 fail-fast。
 * 支持 URL 格式（DATABASE_URL / REDIS_URL）和分离格式（DB_HOST / DB_PORT 等）。
 * 分离格式由 config-builder 在校验前同步为 URL 写入 process.env。
 */
export const envSchema = z.object({
  // ===== 数据库（URL 或分离变量，二选一）=====
  DATABASE_URL: z.string().refine((v) => v.startsWith('mysql://'), 'DATABASE_URL 必须是 mysql:// 协议'),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),

  // ===== 必填：认证 =====
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 位'),

  // ===== 可选：运行环境 =====
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  PORT: z.string().optional(),

  // ===== 可选：安全基线 =====
  JWT_EXPIRES_IN: z.string().optional(),
  PREVIEW_SECRET: z.string().min(16, 'PREVIEW_SECRET 至少 16 位').optional(),

  // ===== 可选：Redis（URL 或分离变量，二选一）=====
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // ===== 可选：CORS（逗号分隔多域名）=====
  CORS_ORIGIN: z.string().optional(),

  // ===== 可选：阿里云 OSS（附件/报表导出，待接入）=====
  OSS_REGION: z.string().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_ACCESS_KEY: z.string().optional(),
  OSS_ACCESS_SECRET: z.string().optional(),
  OSS_ENDPOINT: z.string().optional(),

  // ===== 可选：邮件 SMTP（通知，待接入）=====
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
