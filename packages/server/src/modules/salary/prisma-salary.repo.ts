import type { Prisma, PrismaClient } from '@prisma/client';
import type { SalaryView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type SalaryRow = Prisma.SalaryGetPayload<{
  include: {
    salaryUser: { select: { realName: true } };
    salaryDepartment: { select: { name: true } };
  };
}>;

type SalaryPrisma = Pick<PrismaClient, 'salary'>;

/** 把 scope 翻译成 Prisma where：隔离关键防线——subtree 强制限定 departmentId 集合 */
function scopeWhere(scope: DepartmentScope): Prisma.SalaryWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toView(l: SalaryRow): SalaryView {
  return {
    id: l.id,
    month: l.month,
    basic: l.basic.toNumber(),
    bonus: l.bonus.toNumber(),
    deduction: l.deduction.toNumber(),
    net: l.net.toNumber(),
    userId: l.userId,
    departmentId: l.departmentId,
    employeeName: l.salaryUser.realName,
    departmentName: l.salaryDepartment.name,
  };
}

/**
 * Prisma 实现的 SalaryRepo：无审批流，管理端按月为员工录入薪资单。
 * 所有查询都基于外部注入的 scope 过滤，调用方（路由层）必须先解析 scope 再传入，杜绝越权。
 */
export function createPrismaSalaryRepo(prisma: SalaryPrisma) {
  return {
    async listSalaries(scope: DepartmentScope): Promise<SalaryView[]> {
      const rows = await prisma.salary.findMany({
        where: scopeWhere(scope),
        include: {
          salaryUser: { select: { realName: true } },
          salaryDepartment: { select: { name: true } },
        },
        orderBy: [{ month: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toView);
    },

    async createSalary(data: {
      month: string; // YYYY-MM
      basic: number;
      bonus: number;
      deduction: number;
      net: number;
      userId: number;
      departmentId: number;
    }): Promise<{ id: number }> {
      const row = await prisma.salary.create({
        data: {
          month: data.month,
          basic: data.basic,
          bonus: data.bonus,
          deduction: data.deduction,
          net: data.net,
          userId: data.userId,
          departmentId: data.departmentId,
        },
      });
      return { id: row.id };
    },
  };
}