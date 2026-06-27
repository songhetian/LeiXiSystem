import { z } from 'zod'

export class HttpError extends Error {
  statusCode: number
  details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.details = details
  }
}

export function validateData<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new HttpError(400, '请求参数不合法', parsed.error.flatten())
  }
  return parsed.data
}

export const positiveIntSchema = z.coerce.number().int().positive()

export const idParamsSchema = z.object({
  id: positiveIntSchema,
})

export const optionalKeywordSchema = z
  .string()
  .trim()
  .max(100, '搜索关键字不能超过 100 个字符')
  .optional()
  .transform((value) => value || undefined)

export const statusSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, '状态值格式不合法')
  .optional()

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式必须为 HH:mm')

export const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), '日期格式不合法')

export function toDate(value: string) {
  return new Date(value)
}
