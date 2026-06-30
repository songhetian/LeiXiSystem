import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { config } from '../config'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { buildLoginAttemptKeys, assertLoginAllowed, recordLoginFailure, clearLoginFailures } from '../services/loginSecurity'
import { validateData } from '../utils/validation'

const loginSchema = z.object({
  username: z.string().trim().min(1, '用户名不能为空').max(50, '用户名不能超过 50 个字符'),
  password: z.string().min(1, '密码不能为空').max(128, '密码不能超过 128 个字符'),
})

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '原密码不能为空').max(128),
  newPassword: z.string().min(8, '新密码至少 8 位').max(128),
})

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request: FastifyRequest<{
    Body: { username: string; password: string }
  }>, reply: FastifyReply) => {
    const { username, password } = validateData(loginSchema, request.body)
    const attemptKeys = buildLoginAttemptKeys(username, request.ip)
    assertLoginAllowed(attemptKeys)

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        realName: true,
        email: true,
        phone: true,
        avatar: true,
        departmentId: true,
        isDeptManager: true,
        status: true,
        sessionVersion: true,
        failedLoginAttempts: true,
        loginLockedUntil: true,
        department: { select: { name: true } },
        employee: { select: { employeeNo: true } },
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      recordLoginFailure(attemptKeys)
      setAudit(request, { action: 'auth.login.failed', module: 'auth', requestData: { username, reason: 'user_not_found' } })
      return reply.status(401).send({ code: 401, message: '用户名或密码错误' })
    }

    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      setAudit(request, { action: 'auth.login.blocked', module: 'auth', requestData: { username, reason: 'account_locked', lockedUntil: user.loginLockedUntil } })
      setAfter(request, { userId: user.id })
      return reply.status(423).send({ code: 423, message: '登录失败次数过多，账号已临时锁定' })
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)

    if (!isValidPassword) {
      recordLoginFailure(attemptKeys)
      const failedLoginAttempts = user.failedLoginAttempts + 1
      const loginLockedUntil = failedLoginAttempts >= config.security.loginMaxFailures
        ? new Date(Date.now() + config.security.loginLockMinutes * 60 * 1000)
        : null
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts, loginLockedUntil },
      })
      setAudit(request, { action: 'auth.login.failed', module: 'auth', requestData: { username, reason: 'invalid_password' } })
      setAfter(request, { userId: user.id, failedLoginAttempts, locked: Boolean(loginLockedUntil) })
      return reply.status(401).send({ code: 401, message: '用户名或密码错误' })
    }

    if (user.status !== 'active') {
      setAudit(request, { action: 'auth.login.failed', module: 'auth', requestData: { username, reason: 'inactive_user' } })
      setAfter(request, { userId: user.id })
      return reply.status(403).send({ code: 403, message: '账号已被禁用，请联系管理员' })
    }

    const token = fastify.jwt.sign(
      { userId: user.id, username: user.username, sessionVersion: user.sessionVersion },
      { expiresIn: config.jwt.expiresIn },
    )

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        sessionToken: token,
        sessionCreatedAt: new Date(),
        failedLoginAttempts: 0,
        loginLockedUntil: null,
      },
    })
    clearLoginFailures(attemptKeys)

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    )

    reply.setCookie(config.cookie.name, token, {
      path: config.cookie.path,
      httpOnly: config.cookie.httpOnly,
      sameSite: config.cookie.sameSite,
      secure: config.cookie.secure,
      maxAge: config.jwt.expiresInSeconds,
    })

    const response = {
      code: 0,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.realName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          departmentId: user.departmentId,
          departmentName: user.department?.name,
          employeeNo: user.employee?.employeeNo,
          isDeptManager: user.isDeptManager,
          roles,
          permissions,
        },
      },
    }
    setAudit(request, { action: 'auth.login', module: 'auth', requestData: { username } })
    setAfter(request, { userId: user.id })

    return response
  })

  fastify.post('/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    await prisma.user.update({
      where: { id: request.user.id },
      data: { sessionToken: null, sessionCreatedAt: null, sessionVersion: { increment: 1 } },
    })

    reply.clearCookie(config.cookie.name, {
      path: config.cookie.path,
      httpOnly: config.cookie.httpOnly,
      sameSite: config.cookie.sameSite,
      secure: config.cookie.secure,
    })

    return { code: 0, message: '登出成功' }
  })

  fastify.get('/me', { preHandler: [authMiddleware] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: {
        department: true,
        employee: true,
        position: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return { code: 404, message: '用户不存在' }
    }

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    )

    return {
      code: 0,
      data: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        departmentId: user.departmentId,
        departmentName: user.department?.name,
        positionName: user.position?.name,
        employeeNo: user.employee?.employeeNo,
        isDeptManager: user.isDeptManager,
        roles,
        permissions,
      },
    }
  })

  fastify.post('/change-password', { preHandler: [authMiddleware] }, async (request: FastifyRequest<{
    Body: { oldPassword: string; newPassword: string }
  }>, reply) => {
    const { oldPassword, newPassword } = validateData(changePasswordSchema, request.body)

    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
    })

    if (!user) {
      return reply.status(404).send({ code: 404, message: '用户不存在' })
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isValid) {
      return reply.status(400).send({ code: 400, message: '原密码错误' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: request.user.id },
      data: {
        passwordHash: hashedPassword,
        sessionToken: null,
        sessionCreatedAt: null,
        sessionVersion: { increment: 1 },
      },
    })

    return { code: 0, message: '密码修改成功' }
  })
}
