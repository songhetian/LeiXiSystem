import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, validateData } from '../utils/validation'

const roleListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
})

const roleBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).optional().nullable(),
  level: z.coerce.number().int().min(1).max(99).optional().default(1),
  canViewAllDepts: z.coerce.boolean().optional().default(false),
  permissions: z.array(z.coerce.number().int().positive()).max(1000).optional().default([]),
})

const roleUpdateSchema = roleBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const userRoleParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
})

const userRolesBodySchema = z.object({
  roleIds: z.array(z.coerce.number().int().positive()).max(100).default([]),
})

export default async function rbacRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/roles', { preHandler: [requirePermission('rbac:view')] }, async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; keyword?: string }
  }>) => {
    const query = validateData(roleListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword } = query

    const where: any = {}
    if (keyword) where.name = { contains: keyword }

    const [total, list] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'asc' },
        include: {
          userRoles: true,
          rolePermissions: { include: { permission: true } },
        },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          level: r.level,
          isSystem: r.isSystem,
          canViewAllDepts: r.canViewAllDepts,
          userCount: r.userRoles.length,
          permissionCount: r.rolePermissions.length,
          permissions: r.rolePermissions.map((rp) => rp.permission.code),
          createdAt: r.createdAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/roles', { preHandler: [requirePermission('role:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(roleBodySchema, request.body)

    const role = await prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        level: body.level,
        canViewAllDepts: body.canViewAllDepts,
      },
    })

    if (body.permissions.length) {
      await prisma.rolePermission.createMany({
        data: body.permissions.map((permissionId: number) => ({
          roleId: role.id,
          permissionId,
        })),
      })
    }

    return { code: 0, message: '创建成功', data: role }
  })

  fastify.put('/roles/:id', { preHandler: [requirePermission('role:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id: roleId } = validateData(idParamsSchema, request.params)
    const body = validateData(roleUpdateSchema, request.body)

    await prisma.role.update({
      where: { id: roleId },
      data: {
        name: body.name,
        description: body.description,
        level: body.level,
        canViewAllDepts: body.canViewAllDepts,
      },
    })

    if (body.permissions) {
      await prisma.rolePermission.deleteMany({ where: { roleId } })
      if (body.permissions.length) {
        await prisma.rolePermission.createMany({
          data: body.permissions.map((permissionId: number) => ({
            roleId,
            permissionId,
          })),
        })
      }
    }

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/roles/:id', { preHandler: [requirePermission('role:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.role.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  fastify.get('/permissions/tree', { preHandler: [requirePermission('rbac:view')] }, async () => {
    const permissions = await prisma.permission.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    const buildTree = (parentId: number | null): any[] => {
      return permissions
        .filter((p) => p.parentId === parentId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          resource: p.resource,
          action: p.action,
          module: p.module,
          children: buildTree(p.id),
        }))
    }

    return { code: 0, data: buildTree(null) }
  })

  fastify.get('/permissions', { preHandler: [requirePermission('rbac:view')] }, async () => {
    const permissions = await prisma.permission.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return { code: 0, data: permissions }
  })

  fastify.get('/user-roles/:userId', { preHandler: [requirePermission('role:manage')] }, async (request: FastifyRequest<{
    Params: { userId: string }
  }>) => {
    const { userId } = validateData(userRoleParamsSchema, request.params)

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    })

    return {
      code: 0,
      data: {
        assignedRoles: userRoles.map((ur) => ur.roleId),
        roles: userRoles.map((ur) => ur.role),
      },
    }
  })

  fastify.post('/user-roles/:userId', { preHandler: [requirePermission('role:manage')] }, async (request: FastifyRequest<{
    Params: { userId: string }
    Body: { roleIds: number[] }
  }>) => {
    const { userId } = validateData(userRoleParamsSchema, request.params)
    const { roleIds } = validateData(userRolesBodySchema, request.body)
    const uid = userId

    await prisma.userRole.deleteMany({ where: { userId: uid } })

    if (roleIds.length) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: uid, roleId })),
      })
    }

    return { code: 0, message: '分配成功' }
  })
}
