import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../prisma'
import * as redis from '../utils/redis'
import { config } from '../config'

interface UserPermissionsCache {
  id: number
  username: string
  realName: string
  departmentId: number | null
  roles: string[]
  permissions: string[]
  sessionVersion: number
}

const CACHE_KEY_PREFIX = 'user:permissions:'

function getCacheKey(userId: number): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

export interface AuthUser {
  id: number
  username: string
  realName: string
  departmentId: number | null
  roles: string[]
  permissions: string[]
}

interface JwtPayload {
  userId: number
  sessionVersion?: number
}

function isValidCacheData(data: unknown): data is UserPermissionsCache {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const cache = data as Record<string, unknown>
  return (
    typeof cache.id === 'number' &&
    typeof cache.username === 'string' &&
    typeof cache.realName === 'string' &&
    (cache.departmentId === null || typeof cache.departmentId === 'number') &&
    Array.isArray(cache.roles) &&
    cache.roles.every((role: unknown) => typeof role === 'string') &&
    Array.isArray(cache.permissions) &&
    cache.permissions.every((perm: unknown) => typeof perm === 'string') &&
    typeof cache.sessionVersion === 'number'
  )
}

async function fetchUserFromDB(userId: number) {
  return prisma.user.findUnique({
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
}

type DBUser = NonNullable<Awaited<ReturnType<typeof fetchUserFromDB>>>

function extractRolesAndPermissions(user: DBUser): { roles: string[]; permissions: string[] } {
  const roles = user.userRoles.map((ur) => ur.role.name)
  const permissions = Array.from(
    new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.code),
      ),
    ),
  )
  return { roles, permissions }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = (await request.jwtVerify()) as JwtPayload
    const { userId, sessionVersion: tokenSessionVersion } = decoded

    const token = request.server.jwt.lookupToken(request)

    const cacheKey = getCacheKey(userId)
    const cacheData = await redis.get(cacheKey)

    if (cacheData && tokenSessionVersion !== undefined) {
      try {
        const parsed = JSON.parse(cacheData)
        if (isValidCacheData(parsed) && parsed.sessionVersion === tokenSessionVersion) {
          request.user = {
            id: parsed.id,
            username: parsed.username,
            realName: parsed.realName,
            departmentId: parsed.departmentId,
            roles: parsed.roles,
            permissions: parsed.permissions,
          }
          return
        }
      } catch (parseError) {
        console.error('[Auth] 缓存数据解析失败:', parseError instanceof Error ? parseError.message : String(parseError))
      }
    }

    const user = await fetchUserFromDB(userId)

    if (!user || user.status !== 'active') {
      return reply.status(401).send({ code: 401, message: '用户不存在或已禁用' })
    }

    if (user.sessionToken && user.sessionToken !== token) {
      return reply.status(401).send({ code: 401, message: '账号已在其他设备登录，请重新登录' })
    }

    if (tokenSessionVersion !== undefined && tokenSessionVersion !== user.sessionVersion) {
      return reply.status(401).send({ code: 401, message: '会话已失效，请重新登录' })
    }

    const { roles, permissions } = extractRolesAndPermissions(user)

    request.user = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      departmentId: user.departmentId,
      roles,
      permissions,
    }

    const cacheValue: UserPermissionsCache = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      departmentId: user.departmentId,
      roles,
      permissions,
      sessionVersion: user.sessionVersion,
    }
    await redis.set(cacheKey, JSON.stringify(cacheValue))
  } catch (error) {
    return reply.status(401).send({ code: 401, message: 'Token 无效或已过期' })
  }
}
