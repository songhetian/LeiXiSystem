import prisma from '../prisma'
import { del } from './redis'

const CACHE_KEY_PREFIX = 'user:permissions:'

function getCacheKey(userId: number): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

export async function invalidateUserPermissionsCache(userId: number): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId)
    await del(cacheKey)
  } catch (err) {
    console.error(`[PermissionCache] 失效用户权限缓存失败 userId=${userId}:`, err instanceof Error ? err.message : String(err))
  }
}

export async function invalidateRoleUsersCache(roleId: number): Promise<void> {
  try {
    const userRoles = await prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    })

    if (userRoles.length === 0) {
      return
    }

    const userIds = userRoles.map((ur) => ur.userId)
    await Promise.all(
      userIds.map((userId) => invalidateUserPermissionsCache(userId)),
    )
  } catch (err) {
    console.error(`[PermissionCache] 失效角色用户缓存失败 roleId=${roleId}:`, err instanceof Error ? err.message : String(err))
  }
}
