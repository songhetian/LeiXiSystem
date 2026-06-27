import { FastifyReply, FastifyRequest } from 'fastify'

function isSuperAdmin(request: FastifyRequest) {
  return request.user?.roles?.includes('超级管理员')
}

export function hasPermission(request: FastifyRequest, permission: string) {
  const permissions = request.user?.permissions || []
  return isSuperAdmin(request) || permissions.includes('*') || permissions.includes(permission)
}

export function requirePermission(permission: string) {
  return async function permissionMiddleware(request: FastifyRequest, reply: FastifyReply) {
    if (!hasPermission(request, permission)) {
      return reply.status(403).send({
        code: 403,
        message: '没有权限执行此操作',
        requiredPermission: permission,
      })
    }
  }
}

export function requireAnyPermission(permissions: string[]) {
  return async function permissionMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const allowed = permissions.some((permission) => hasPermission(request, permission))

    if (!allowed) {
      return reply.status(403).send({
        code: 403,
        message: '没有权限执行此操作',
        requiredPermissions: permissions,
      })
    }
  }
}
