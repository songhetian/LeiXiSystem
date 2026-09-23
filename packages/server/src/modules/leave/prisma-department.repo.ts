import type { PrismaClient } from '@prisma/client';
import type { DepartmentNode } from './department-scope';

type DeptPrisma = Pick<PrismaClient, 'department' | 'user' | 'leave'>;

/**
 * Prisma 实现 DepartmentRepo：
 * - listTree 供部门隔离 scope 解析
 * - CRUD 供部门管理页；delete 带引用保护（有子部门/请假单/用户时拒绝）
 */
export function createPrismaDepartmentRepo(prisma: DeptPrisma) {
  return {
    async listTree(): Promise<DepartmentNode[]> {
      const rows = await prisma.department.findMany({
        select: { id: true, parentId: true },
      });
      return rows.map((r) => ({ id: r.id, parentId: r.parentId }));
    },

    async listDepartments(): Promise<{ id: number; name: string; parentId: number | null }[]> {
      const rows = await prisma.department.findMany({ orderBy: { id: 'asc' } });
      return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId }));
    },

    async createDepartment(data: {
      name: string;
      parentId: number | null;
    }): Promise<{ id: number }> {
      const row = await prisma.department.create({ data });
      return { id: row.id };
    },

    async updateDepartment(id: number, data: { name?: string; parentId?: number | null }): Promise<void> {
      await prisma.department.update({ where: { id }, data });
    },

    async deleteDepartment(
      id: number,
    ): Promise<'ok' | 'has_children' | 'has_leaves' | 'has_users' | 'not_found'> {
      const dept = await prisma.department.findUnique({ where: { id } });
      if (!dept) return 'not_found';
      const children = await prisma.department.count({ where: { parentId: id } });
      if (children > 0) return 'has_children';
      const leaves = await prisma.leave.count({ where: { departmentId: id } });
      if (leaves > 0) return 'has_leaves';
      const users = await prisma.user.count({ where: { departmentId: id } });
      if (users > 0) return 'has_users';
      await prisma.department.delete({ where: { id } });
      return 'ok';
    },
  };
}