import type { Prisma, PrismaClient } from '@prisma/client';
import type { ReimburseView, ReimburseItemInput } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type ReimburseRow = Prisma.ReimburseGetPayload<{
  include: {
    applicant: { select: { realName: true } };
    department: { select: { name: true } };
    category: { select: { name: true } };
    items: {
      include: { category: { select: { name: true } } };
      orderBy: { id: 'asc' };
    };
  };
}>;

type ReimbursePrisma = Pick<PrismaClient, 'reimburse'>;

/** 把 scope 翻译成 Prisma where：隔离关键防线——subtree 强制限定 departmentId 集合 */
function scopeWhere(scope: DepartmentScope): Prisma.ReimburseWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(l: ReimburseRow): ReimburseView {
  return {
    id: l.id,
    categoryId: l.categoryId,
    categoryName: l.category?.name ?? null,
    reason: l.reason,
    amount: l.amount.toNumber(),
    status: l.status,
    applicantId: l.applicantId,
    departmentId: l.departmentId,
    applicantName: l.applicant.realName,
    departmentName: l.department.name,
    createdAt: l.createdAt.toISOString(),
    items: l.items.map((it) => ({
      id: it.id,
      reimburseId: it.reimburseId,
      categoryId: it.categoryId,
      categoryName: it.category.name,
      amount: it.amount.toNumber(),
      note: it.note,
    })),
  };
}

/**
 * Prisma 实现的 ReimburseRepo：所有查询都基于外部注入的 scope 过滤，
 * 调用方（路由层）必须先解析当前用户 scope 再传入，杜绝越权。
 * 报销总额由服务端 = 分项之和计算，不信任前端提交的 amount。
 */
export function createPrismaReimburseRepo(prisma: ReimbursePrisma) {
  return {
    async listReimburses(scope: DepartmentScope): Promise<ReimburseView[]> {
      const rows = await prisma.reimburse.findMany({
        where: scopeWhere(scope),
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
          category: { select: { name: true } },
          items: {
            include: { category: { select: { name: true } } },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { id: 'desc' },
      });
      return rows.map(toView);
    },

    /** 创建报销：分项一次性提交，总额 = 分项之和，主类别 = 首条分项类别 */
    async createReimburse(data: {
      reason: string;
      items: ReimburseItemInput[];
      applicantId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const total = data.items.reduce((acc, it) => acc + Number(it.amount), 0);
      const first = data.items[0];
      const row = await prisma.reimburse.create({
        data: {
          type: '分项报销',
          reason: data.reason,
          amount: total,
          applicantId: data.applicantId,
          departmentId: data.departmentId,
          categoryId: first ? first.categoryId : null,
          items: {
            create: data.items.map((it) => ({
              categoryId: it.categoryId,
              amount: it.amount,
              note: it.note ?? null,
            })),
          },
        },
      });
      return { id: row.id };
    },

    async getReimburseById(id: number): Promise<ReimburseView | null> {
      const row = await prisma.reimburse.findUnique({
        where: { id },
        include: {
          applicant: { select: { realName: true } },
          department: { select: { name: true } },
          category: { select: { name: true } },
          items: {
            include: { category: { select: { name: true } } },
            orderBy: { id: 'asc' },
          },
        },
      });
      return row ? toView(row) : null;
    },

    async setStatus(id: number, status: string): Promise<void> {
      await prisma.reimburse.update({ where: { id }, data: { status } });
    },
  };
}