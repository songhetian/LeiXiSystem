import { z } from 'zod'
import { config } from '../config'
import { HttpError } from './validation'

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(config.pagination.defaultPageSize),
})

export type NormalizedPagination = {
  page: number
  pageSize: number
  skip: number
  take: number
}

export function normalizePagination(query: unknown): NormalizedPagination {
  const parsed = paginationSchema.safeParse(query || {})
  if (!parsed.success) {
    throw new HttpError(400, '分页参数不合法', parsed.error.flatten())
  }

  const page = parsed.data.page
  const pageSize = Math.min(parsed.data.pageSize, config.pagination.maxPageSize)

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}
