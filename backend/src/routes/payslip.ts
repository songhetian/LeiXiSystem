import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { validateData } from '../utils/validation'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const PAYSLIP_ACCESS_EXPIRES_IN = '10m'

const payslipPasswordSchema = z
  .string()
  .min(6, '二级密码长度需为 6-32 位')
  .max(32, '二级密码长度需为 6-32 位')
  .regex(/^[\S]+$/, '二级密码不能包含空白字符')

const setPayslipPasswordSchema = z.object({
  password: payslipPasswordSchema,
  confirmPassword: payslipPasswordSchema,
}).refine((value) => value.password === value.confirmPassword, {
  message: '两次输入的二级密码不一致',
  path: ['confirmPassword'],
})

const changePayslipPasswordSchema = z.object({
  oldPassword: payslipPasswordSchema,
  newPassword: payslipPasswordSchema,
  confirmPassword: payslipPasswordSchema,
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: '两次输入的新二级密码不一致',
  path: ['confirmPassword'],
})

const verifyPayslipPasswordSchema = z.object({
  password: payslipPasswordSchema,
})

function validatePayslipPassword(password: string) {
  if (!password || password.length < 6 || password.length > 32) {
    return '二级密码长度需为 6-32 位'
  }
  return null
}

export default async function payslipRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/password-status', async (request) => {
    const password = await prisma.payslipPassword.findUnique({
      where: { userId: request.user.id },
      select: {
        id: true,
        isDefault: true,
        lastChangedAt: true,
        lockedUntil: true,
      },
    })

    return {
      code: 0,
      data: {
        hasPassword: Boolean(password),
        isDefault: password?.isDefault || false,
        lastChangedAt: password?.lastChangedAt || null,
        lockedUntil: password?.lockedUntil || null,
      },
    }
  })

  fastify.post('/set-password', async (request: FastifyRequest<{
    Body: { password: string; confirmPassword: string }
  }>, reply: FastifyReply) => {
    const { password } = validateData(setPayslipPasswordSchema, request.body)

    const existing = await prisma.payslipPassword.findUnique({
      where: { userId: request.user.id },
      select: { id: true },
    })

    if (existing) {
      return reply.status(400).send({ code: 400, message: '已设置二级密码，请使用修改功能' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.payslipPassword.create({
      data: {
        userId: request.user.id,
        passwordHash,
        isDefault: false,
      },
    })

    return { code: 0, message: '二级密码设置成功' }
  })

  fastify.post('/change-password', async (request: FastifyRequest<{
    Body: { oldPassword: string; newPassword: string; confirmPassword: string }
  }>, reply: FastifyReply) => {
    const { oldPassword, newPassword } = validateData(changePayslipPasswordSchema, request.body)

    const passwordRecord = await prisma.payslipPassword.findUnique({
      where: { userId: request.user.id },
    })

    if (!passwordRecord) {
      return reply.status(404).send({ code: 404, message: '未设置二级密码' })
    }

    const isValid = await bcrypt.compare(oldPassword, passwordRecord.passwordHash)
    if (!isValid) {
      return reply.status(401).send({ code: 401, message: '原二级密码错误' })
    }

    await prisma.payslipPassword.update({
      where: { userId: request.user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        isDefault: false,
        failedAttempts: 0,
        lockedUntil: null,
        lastChangedAt: new Date(),
      },
    })

    return { code: 0, message: '二级密码修改成功' }
  })

  fastify.post('/verify-password', async (request: FastifyRequest<{
    Body: { password: string }
  }>, reply: FastifyReply) => {
    const { password } = validateData(verifyPayslipPasswordSchema, request.body)

    const passwordRecord = await prisma.payslipPassword.findUnique({
      where: { userId: request.user.id },
    })

    if (!passwordRecord) {
      return reply.status(404).send({ code: 404, message: '未设置二级密码' })
    }

    if (passwordRecord.lockedUntil && passwordRecord.lockedUntil > new Date()) {
      return reply.status(423).send({
        code: 423,
        message: '二级密码错误次数过多，请稍后再试',
        lockedUntil: passwordRecord.lockedUntil,
      })
    }

    const isValid = await bcrypt.compare(password, passwordRecord.passwordHash)

    if (!isValid) {
      const failedAttempts = passwordRecord.failedAttempts + 1
      const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null

      await prisma.payslipPassword.update({
        where: { userId: request.user.id },
        data: { failedAttempts, lockedUntil },
      })

      return reply.status(401).send({
        code: 401,
        message: lockedUntil ? '二级密码错误次数过多，账号已临时锁定' : '二级密码错误',
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
        lockedUntil,
      })
    }

    await prisma.payslipPassword.update({
      where: { userId: request.user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    })

    const payslipAccessToken = fastify.jwt.sign(
      {
        userId: request.user.id,
        scope: 'payslip:view',
      },
      { expiresIn: PAYSLIP_ACCESS_EXPIRES_IN },
    )

    return {
      code: 0,
      message: '验证成功',
      data: {
        payslipAccessToken,
        expiresIn: PAYSLIP_ACCESS_EXPIRES_IN,
      },
    }
  })
}
