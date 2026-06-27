import { PrismaClient } from '@prisma/client'

const enableQueryLog = process.env.PRISMA_QUERY_LOG === 'true'
const slowQueryThreshold = Number(process.env.PRISMA_SLOW_QUERY_MS || 300)

const prisma = new PrismaClient({
  log: enableQueryLog
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ]
    : ['error', 'warn'],
})

if (enableQueryLog) {
  ;(prisma as any).$on('query', (event: { duration: number; model?: string; action?: string; query?: string }) => {
    if (event.duration >= slowQueryThreshold) {
      console.warn('[Prisma slow query]', {
        duration: event.duration,
        model: event.model,
        action: event.action,
        query: event.query,
      })
    }
  })
}

export default prisma
