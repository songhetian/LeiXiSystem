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

function getRawShape(schema: any): Record<string, z.ZodTypeAny> {
  return (schema as any).shape || {}
}

function buildShape(shape: Record<string, z.ZodTypeAny>): any {
  return z.object(shape)
}

export function safePick<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[]
): z.ZodObject<Pick<T, K>> {
  const shape = getRawShape(schema)
  const pickedShape: Record<string, z.ZodTypeAny> = {}
  for (const key of keys as string[]) {
    if (shape[key]) {
      pickedShape[key] = shape[key]
    }
  }
  return buildShape(pickedShape) as any
}

export function safeOmit<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[]
): z.ZodObject<Omit<T, K>> {
  const shape = getRawShape(schema)
  const omitSet = new Set(keys as string[])
  const omittedShape: Record<string, z.ZodTypeAny> = {}
  for (const key of Object.keys(shape)) {
    if (!omitSet.has(key)) {
      omittedShape[key] = shape[key]
    }
  }
  return buildShape(omittedShape) as any
}

export function safePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{
  [K in keyof T]?: z.ZodTypeAny
}> {
  const shape = getRawShape(schema)
  const partialShape: Record<string, z.ZodTypeAny> = {}
  for (const key of Object.keys(shape)) {
    partialShape[key] = shape[key].optional()
  }
  return buildShape(partialShape) as any
}

export function safeExtend<T extends z.ZodRawShape, U extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  extension: U
): z.ZodObject<T & U> {
  const shape = getRawShape(schema)
  const extendedShape: Record<string, z.ZodTypeAny> = { ...shape }
  for (const key of Object.keys(extension)) {
    extendedShape[key] = extension[key] as any
  }
  return buildShape(extendedShape) as any
}

export function partialUpdateSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{
  [K in keyof T]?: z.ZodTypeAny
}> {
  return safePartial(schema)
}

export function requireAtLeastOneField<T extends Record<string, unknown>>(data: T): T {
  if (Object.keys(data).length === 0) {
    throw new HttpError(400, '更新数据不能为空')
  }
  return data
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
