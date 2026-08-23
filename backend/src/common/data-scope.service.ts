import { Injectable, Global } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from './redis/redis.service';

export interface DataScope {
  all: boolean;
  ids: number[];
  selfEmployeeId?: number;
}

const CACHE_TTL = 5 * 60;

function cacheKey(userId: number) {
  return `datascope:user:${userId}`;
}

// ADR-0010：部门数据隔离 —— 所有列表/详情/报表的"可见部门范围"统一从这里取
// 三档规则：admin/hr = 全量 | manager = 本部门+子部门 | 其他 = 仅本人
// 带 Redis 缓存：用户权限变化不大，5 分钟缓存大幅减少 DB 查询
@Global()
@Injectable()
export class DataScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async visibleScope(userId: number): Promise<DataScope> {
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(cacheKey(userId));
      if (cached) {
        try {
          return JSON.parse(cached) as DataScope;
        } catch {
          // 缓存解析失败，走 DB
        }
      }
    }

    const scope = await this.computeScope(userId);

    if (this.redis.isEnabled) {
      try {
        await this.redis.set(cacheKey(userId), JSON.stringify(scope), CACHE_TTL);
      } catch {
        // 写入失败不影响主流程
      }
    }

    return scope;
  }

  private async computeScope(userId: number): Promise<DataScope> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        departments: true,
        employees: { select: { id: true } },
      },
    });
    const roleCodes = user?.roles.map((ur) => ur.role.code) ?? [];

    if (roleCodes.some((c) => c === 'admin' || c === 'hr')) {
      return { all: true, ids: [] };
    }

    const employeeId = user?.employees?.[0]?.id;
    const deptIdSet = new Set<number>();

    const hasManagerRole = roleCodes.some((c) => c === 'manager' || c === 'dept_manager');
    if (hasManagerRole) {
      (user?.departments.map((d) => d.departmentId) ?? []).forEach((id) => deptIdSet.add(id));
    }

    if (employeeId) {
      const managedDepts = await this.prisma.department.findMany({
        where: { managerId: employeeId },
        select: { id: true },
      });
      managedDepts.forEach((d) => deptIdSet.add(d.id));
    }

    if (deptIdSet.size > 0) {
      const allDeptIds = await this.getAllChildDepartments(Array.from(deptIdSet));
      return { all: false, ids: allDeptIds };
    }

    return { all: false, ids: [], selfEmployeeId: employeeId };
  }

  /**
   * 一次性查询所有部门，在内存中构建子部门树，找出给定部门的所有后代部门 ID。
   * 替代原来的 N+1 逐层查询，将查询次数从 O(depth) 降为 O(1)。
   */
  private async getAllChildDepartments(rootDeptIds: number[]): Promise<number[]> {
    const allDepts = await this.prisma.department.findMany({
      select: { id: true, parentId: true },
    });

    const childrenMap = new Map<number | null, number[]>();
    for (const dept of allDepts) {
      const parentKey = dept.parentId ?? null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(dept.id);
    }

    const result = new Set<number>(rootDeptIds);
    const stack = [...rootDeptIds];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = childrenMap.get(current) ?? [];
      for (const child of children) {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      }
    }

    return Array.from(result);
  }

  async invalidateCache(userId: number) {
    if (!this.redis.isEnabled) return;
    try {
      await this.redis.del(cacheKey(userId));
    } catch {
      // ignore
    }
  }
}
