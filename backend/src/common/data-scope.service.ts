import { Injectable, Global } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ADR-0010：部门数据隔离 —— 所有列表/详情/报表的"可见部门范围"统一从这里取
// 规则：admin/hr 角色 = 全量；否则 = 用户所属部门 + 递归子部门
@Global()
@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async visibleScope(userId: number): Promise<{ all: boolean; ids: number[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        departments: true,
      },
    });
    const roleCodes = user?.roles.map((ur) => ur.role.code) ?? [];
    if (roleCodes.some((c) => c === 'admin' || c === 'hr')) return { all: true, ids: [] };

    const deptIds = user?.departments.map((d) => d.departmentId) ?? [];
    const allIds = [...deptIds];
    let frontier = deptIds;
    while (frontier.length > 0) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const ids = children.map((c) => c.id);
      allIds.push(...ids);
      frontier = ids;
    }
    return { all: false, ids: allIds };
  }
}
