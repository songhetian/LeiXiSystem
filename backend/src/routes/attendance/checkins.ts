import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { requireAnyPermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { normalizePagination } from '../../utils/pagination'
import { dateStringSchema, optionalKeywordSchema, validateData, safePick } from '../../utils/validation'
import { checkInStatusSchema } from '../../utils/schemas'

const dateRangeBaseQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  status: checkInStatusSchema,
})

export default async function checkinsRoutes(fastify: FastifyInstance) {
  fastify.get('/checkins', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:checkin:view'])] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }
  }>) => {
    const query = validateData(safePick(dateRangeBaseQuerySchema, ['employeeId', 'startDate', 'endDate', 'page', 'pageSize']), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { employeeId, startDate, endDate } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = {}

    if (employeeId) where.employeeId = Number(employeeId)
    if (startDate && endDate) {
      where.checkTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [total, list] = await Promise.all([
      prisma.attendanceCheckin.count({ where: { ...where, ...scopeWhere } }),
      prisma.attendanceCheckin.findMany({
        where: { ...where, ...scopeWhere },
        skip,
        take,
        orderBy: { checkTime: 'desc' },
        select: {
          id: true,
          userId: true,
          employeeId: true,
          deviceId: true,
          source: true,
          logType: true,
          checkTime: true,
          latitude: true,
          longitude: true,
          address: true,
          ipAddress: true,
          photoUrl: true,
          verified: true,
          createdAt: true,
          employee: {
            select: {
              employeeNo: true,
              user: {
                select: {
                  realName: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })
}