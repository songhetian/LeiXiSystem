import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../app';
import { RBACEngine } from '../lib/rbac';

// 1. 定义巅峰序列化 Schema
export const roleSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().nullable(),
  is_system: z.boolean(),
  created_at: z.date().or(z.string()),
});

export const permissionSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  module: z.string(),
  resource: z.string(),
  action: z.string(),
});

export default async function rbacRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // 获取所有角色 (预编译序列化)
  app.get('/api/rbac/roles', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(roleSchema),
        }),
      },
    },
  }, async () => {
    const roles = await prisma.roles.findMany({
      orderBy: { level: 'asc' }
    });
    return { success: true, data: roles as any };
  });

  // 获取角色详情 (带关联权限)
  app.get('/api/rbac/roles/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: roleSchema.extend({
            permissions: z.array(z.string())
          }),
        }),
      },
    },
  }, async (request) => {
    const roleId = Number(request.params.id);
    const role = await prisma.roles.findUnique({
      where: { id: roleId },
      include: {
        role_permissions: {
          include: { permissions: true }
        }
      }
    });

    if (!role) throw new Error('Role not found');

    return {
      success: true,
      data: {
        ...role,
        permissions: role.role_permissions.map(rp => rp.permissions.code)
      } as any
    };
  });

  // 更新角色权限 (规约执行：事务原子性与精准缓存清理)
  app.put('/api/rbac/roles/:id/permissions', {
    schema: {
      params: z.object({ id: z.string() }),
      body: z.object({
        permissionIds: z.array(z.number()),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const roleId = Number(request.params.id);
    const { permissionIds } = request.body;

    await prisma.$transaction(async (tx) => {
      // 1. 物理移除旧映射
      await tx.role_permissions.deleteMany({ where: { role_id: roleId } });

      // 2. 批量创建新映射
      await tx.role_permissions.createMany({
        data: permissionIds.map(pid => ({
          role_id: roleId,
          permission_id: pid
        }))
      });

      // 3. 规约执行：受影响用户缓存闭环
      const affectedUsers = await tx.user_roles.findMany({
        where: { role_id: roleId },
        select: { user_id: true }
      });

      // 精准失效缓存 (物理闭环)
      for (const user of affectedUsers) {
        await RBACEngine.invalidateUser(user.user_id);
      }
    });

    return { success: true };
  });
}
