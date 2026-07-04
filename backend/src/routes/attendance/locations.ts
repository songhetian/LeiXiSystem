import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { idParamsSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../../utils/validation'

const locationTypeSchema = z.enum(['gps', 'wifi', 'both'])

const listQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: locationTypeSchema.optional(),
  status: statusSchema,
  departmentId: positiveIntSchema.optional(),
})

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: locationTypeSchema,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  radiusMeters: z.coerce.number().int().min(10).max(5000).optional().default(100),
  wifiSsid: z.string().trim().max(100).optional().nullable(),
  wifiBssid: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const updateSchema = partialUpdateSchema(createSchema)

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  gps: 'GPS定位',
  wifi: 'WiFi打卡',
  both: 'GPS + WiFi',
}

/**
 * 计算两个经纬度点之间的距离（米）
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // 地球半径（米）
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

export default async function locationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取打卡位置列表
  fastify.get('/locations', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.type) where.type = query.type
    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId

    const [total, list] = await Promise.all([
      prisma.attendanceLocation.count({ where }),
      prisma.attendanceLocation.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        include: {
          department: { select: { id: true, name: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取打卡位置详情
  fastify.get('/locations/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const location = await prisma.attendanceLocation.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
      },
    })

    if (!location) return { code: 404, message: '打卡位置不存在' }

    return { code: 0, data: location }
  })

  // 创建打卡位置
  fastify.post('/locations', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createSchema, request.body)

    const location = await prisma.attendanceLocation.create({
      data: body,
    })

    return { code: 0, message: '创建成功', data: location }
  })

  // 更新打卡位置
  fastify.put('/locations/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(updateSchema, request.body)
    requireAtLeastOneField(data)

    const location = await prisma.attendanceLocation.findUnique({ where: { id } })
    if (!location) return { code: 404, message: '打卡位置不存在' }

    const updated = await prisma.attendanceLocation.update({
      where: { id },
      data: data,
    })

    return { code: 0, message: '更新成功', data: updated }
  })

  // 删除打卡位置
  fastify.delete('/locations/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const location = await prisma.attendanceLocation.findUnique({ where: { id } })
    if (!location) return { code: 404, message: '打卡位置不存在' }

    await prisma.attendanceLocation.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  // 打卡位置校验
  fastify.post('/locations/verify', async (request: FastifyRequest<{
    Body: {
      latitude?: number
      longitude?: number
      wifiSsid?: string
      wifiBssid?: string
    }
  }>) => {
    const { latitude, longitude, wifiSsid, wifiBssid } = request.body

    const activeLocations = await prisma.attendanceLocation.findMany({
      where: { status: 'active' },
    })

    let matchedLocation = null
    let matchedBy = ''

    for (const loc of activeLocations) {
      // GPS 校验
      if ((loc.type === 'gps' || loc.type === 'both') && latitude && longitude && loc.latitude && loc.longitude) {
        const distance = haversineDistance(
          Number(latitude),
          Number(longitude),
          Number(loc.latitude),
          Number(loc.longitude)
        )
        if (distance <= loc.radiusMeters) {
          matchedLocation = loc
          matchedBy = `GPS（距离 ${distance} 米）`
          break
        }
      }

      // WiFi 校验
      if ((loc.type === 'wifi' || loc.type === 'both') && wifiSsid && loc.wifiSsid) {
        if (wifiSsid.toLowerCase() === loc.wifiSsid.toLowerCase()) {
          matchedLocation = loc
          matchedBy = 'WiFi'
          break
        }
      }
    }

    return {
      code: 0,
      data: {
        valid: matchedLocation !== null,
        location: matchedLocation,
        matchedBy,
      },
    }
  })
}
