import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../prisma'

export interface AuthUser {
  id: number
  username: string
  realName: string
  departmentId: number | null
  roles: string[]
  permissions: string[]
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return reply.status(401).send({ code: 401, message: '未授权访问' })
    }

    const decoded = await request.jwtVerify()
    const { userId, sessionVersion } = decoded as { userId: number; sessionVersion?: number }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        realName: true,
        departmentId: true,
        status: true,
        sessionToken: true,
        sessionVersion: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { code: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user || user.status !== 'active') {
      return reply.status(401).send({ code: 401, message: '用户不存在或已禁用' })
    }

    if (user.sessionToken && user.sessionToken !== token) {
      return reply.status(401).send({ code: 401, message: '账号已在其他设备登录，请重新登录' })
    }

    if (sessionVersion !== undefined && sessionVersion !== user.sessionVersion) {
      return reply.status(401).send({ code: 401, message: '会话已失效，请重新登录' })
    }

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = Array.from(new Set(user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    )))

    ;(request as any).user = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      departmentId: user.departmentId,
      roles,
      permissions,
    }
  } catch (error) {
    return reply.status(401).send({ code: 401, message: 'Token 无效或已过期' })
  }
}
