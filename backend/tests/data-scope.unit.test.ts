import { DataScopeService } from '../src/common/data-scope.service';

// ADR-0010 部门数据隔离三档测试
// admin/hr → 全量 | manager → 本部门+子部门 | 其他 → 仅本人
describe('DataScopeService (unit) — ADR-0010 三档隔离', () => {
  let service: DataScopeService;
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      department: { findMany: jest.fn() },
    };
    redis = { isEnabled: false, get: jest.fn(), set: jest.fn(), del: jest.fn() };
    service = new DataScopeService(prisma, redis);
  });

  // ---- 第一档：admin/hr = 全量 ----
  it('admin 角色返回全量 { all: true }', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      roles: [{ role: { code: 'admin' } }],
      departments: [],
      employees: [],
    });
    const scope = await service.visibleScope(1);
    expect(scope.all).toBe(true);
    expect(scope.ids).toEqual([]);
    expect(scope.selfEmployeeId).toBeUndefined();
  });

  it('hr 角色返回全量 { all: true }', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      roles: [{ role: { code: 'hr' } }],
      departments: [],
      employees: [],
    });
    const scope = await service.visibleScope(2);
    expect(scope.all).toBe(true);
  });

  // ---- 第二档：manager = 本部门 + 递归子部门 ----
  it('manager 角色返回部门+子部门（递归）', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 3,
      roles: [{ role: { code: 'manager' } }],
      departments: [{ departmentId: 10 }],
      employees: [{ id: 100 }],
    });
    prisma.department.findMany
      .mockResolvedValueOnce([{ id: 11 }, { id: 12 }]) // managerId=100 管理的部门
      .mockResolvedValueOnce([
        // 全量部门，内存构建部门树
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 12, parentId: 10 },
        { id: 13, parentId: 11 },
      ]);
    const scope = await service.visibleScope(3);
    expect(scope.all).toBe(false);
    expect(scope.ids).toContain(10);
    expect(scope.ids).toContain(11);
    expect(scope.ids).toContain(12);
    expect(scope.ids).toContain(13);
    expect(scope.selfEmployeeId).toBeUndefined();
  });

  // ---- 第三档：普通员工 = 仅本人 ----
  it('staff 角色返回 selfEmployeeId（仅本人）', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      roles: [{ role: { code: 'staff' } }],
      departments: [{ departmentId: 10 }],
      employees: [{ id: 99 }],
    });
    prisma.department.findMany.mockResolvedValue([]);
    const scope = await service.visibleScope(4);
    expect(scope.all).toBe(false);
    expect(scope.ids).toEqual([]);
    expect(scope.selfEmployeeId).toBe(99);
  });

  it('无特殊角色的用户返回 selfEmployeeId', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 5,
      roles: [{ role: { code: 'employee' } }],
      departments: [{ departmentId: 20 }],
      employees: [{ id: 88 }],
    });
    prisma.department.findMany.mockResolvedValue([]);
    const scope = await service.visibleScope(5);
    expect(scope.all).toBe(false);
    expect(scope.selfEmployeeId).toBe(88);
  });

  it('普通员工但无关联 Employee 记录 → selfEmployeeId 为 undefined', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 6,
      roles: [{ role: { code: 'staff' } }],
      departments: [{ departmentId: 20 }],
      employees: [],
    });
    const scope = await service.visibleScope(6);
    expect(scope.all).toBe(false);
    expect(scope.ids).toEqual([]);
    expect(scope.selfEmployeeId).toBeUndefined();
  });
});
