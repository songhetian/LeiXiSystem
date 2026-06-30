import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { enqueueNotification } from '../../plugins/notification'
import { validateData } from '../../utils/validation'

const clockInSchema = z.object({
  location: z.string().trim().max(100).optional(),
  type: z.enum(['in', 'out']),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  source: z.string().trim().max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  deviceId: z.string().trim().max(100).optional(),
  photoUrl: z.string().trim().url().max(500).optional(),
})

export default async function clockInRoutes(fastify: FastifyInstance) {
  fastify.post('/clock-in', async (request: FastifyRequest<{
    Body: {
      location?: string
      type: 'in' | 'out'
      latitude?: number
      longitude?: number
      source?: string
      deviceId?: string
      photoUrl?: string
    }
  }>) => {
    const userId = request.user.id
    const { location, type, latitude, longitude, source, deviceId, photoUrl } = validateData(clockInSchema, request.body)

    setAudit(request, {
      action: type === 'in' ? 'clock_in' : 'clock_out',
      module: 'attendance',
      requestData: { type, source, deviceId, location },
    })

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (!record) {
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          employeeId: employee.id,
          date: today,
          status: 'normal',
        },
      })
    }

    const now = new Date()
    const checkin = await prisma.attendanceCheckin.create({
      data: {
        userId,
        employeeId: employee.id,
        source: source || 'web',
        deviceId,
        logType: type,
        checkTime: now,
        latitude,
        longitude,
        address: location,
        photoUrl,
        ipAddress: request.ip,
        rawPayload: request.body as any,
        verified: false,
      },
    })

    const updateData: any = {}

    if (type === 'in') {
      updateData.checkIn = now
      updateData.locationIn = location

      const shiftStart = new Date(today)
      shiftStart.setHours(9, 0, 0, 0)
      if (now > shiftStart) {
        const lateMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60000)
        updateData.lateMinutes = lateMinutes
        updateData.status = 'late'
      }
    } else {
      updateData.checkOut = now
      updateData.locationOut = location

      const shiftEnd = new Date(today)
      shiftEnd.setHours(18, 0, 0, 0)
      if (now < shiftEnd) {
        const earlyMinutes = Math.round((shiftEnd.getTime() - now.getTime()) / 60000)
        updateData.earlyMinutes = earlyMinutes
        if (record.status === 'normal') {
          updateData.status = 'early'
        }
      }

      if (record.checkIn) {
        const workHours = ((now.getTime() - record.checkIn.getTime()) / 3600000).toFixed(2)
        updateData.workHours = parseFloat(workHours)
      }
    }

    captureBefore(request, record)
    record = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: updateData,
    })
    setAfter(request, { checkinId: checkin.id, attendanceRecordId: record.id })

    enqueueNotification(request, {
      userId,
      title: type === 'in' ? '上班打卡成功' : '下班打卡成功',
      content: `${type === 'in' ? '上班' : '下班'}打卡时间：${now.toLocaleTimeString('zh-CN')}${updateData.status === 'late' ? '（迟到）' : updateData.status === 'early' ? '（早退）' : ''}`,
      type: 'system',
      relatedId: record.id,
      relatedType: 'attendance',
    })

    return {
      code: 0,
      message: type === 'in' ? '上班打卡成功' : '下班打卡成功',
      data: { record, checkin },
    }
  })
}