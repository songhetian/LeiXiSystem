import { Prisma, type PrismaClient } from '@prisma/client';
import type { ReimburseCategoryView } from '@leixi/shared';

type CategoryPrisma = Pick<PrismaClient, 'reimburseCategory' | 'reimburseItem'>;

function toView(c: Prisma.ReimburseCategoryGetPayload<Record<string, never>>): ReimburseCategoryView {
  return { id: c.id, name: c.name, isActive: c.isActive, description: c.description };
}

/**
 * Prisma 实现的报销类别仓库：系统级配置，无部门隔离。
 * 删除保护：若已被报销分项或报销单引用则返回 in_use。
 */
export function createPrismaReimburseCategoryRepo(prisma: CategoryPrisma) {
  return {
    async listCategories(): Promise<ReimburseCategoryView[]> {
      const rows = await prisma.reimburseCategory.findMany({ orderBy: { id: 'asc' } });
      return rows.map(toView);
    },

    /** 创建：name 重复 → not_found 语义用 dup 标记 */
    async createCategory(data: { name: string; isActive?: boolean; description?: string | null }): Promise<
      { ok: true; id: number } | { ok: false; reason: 'dup' }
    > {
      try {
        const row = await prisma.reimburseCategory.create({
          data: { name: data.name, isActive: data.isActive ?? true, description: data.description ?? null },
        });
        return { ok: true, id: row.id };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, reason: 'dup' };
        throw e;
      }
    },

    /** 更新：不存在 → not_found；name 重复 → dup */
    async updateCategory(
      id: number,
      data: Partial<{ name: string; isActive: boolean; description: string | null }>,
    ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }> {
      try {
        await prisma.reimburseCategory.update({ where: { id }, data });
        return { ok: true };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === 'P2025') return { ok: false, reason: 'not_found' };
          if (e.code === 'P2002') return { ok: false, reason: 'dup' };
        }
        throw e;
      }
    },

    /** 删除：不存在 → not_found；被分项/报销单引用 → in_use */
    async deleteCategory(id: number): Promise<'ok' | 'not_found' | 'in_use'> {
      const itemRef = await prisma.reimburseItem.findFirst({ where: { categoryId: id }, select: { id: true } });
      if (itemRef) return 'in_use';
      try {
        await prisma.reimburseCategory.delete({ where: { id } });
        return 'ok';
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === 'P2025') return 'not_found';
          if (e.code === 'P2003') return 'in_use'; // FK 约束兜底
        }
        throw e;
      }
    },
  };
}