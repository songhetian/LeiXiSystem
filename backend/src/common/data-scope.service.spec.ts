import { DataScopeService } from './data-scope.service';

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
  },
};

const mockRedis: any = {
  isEnabled: true,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('DataScopeService (缓存)', () => {
  let service: DataScopeService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockRedis.isEnabled = true;
    service = new DataScopeService(mockPrisma, mockRedis);
  });

  it('应先查 Redis 缓存，命中则不查数据库', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ all: true, ids: [] }));
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await service.visibleScope(1);

    expect(result).toEqual({ all: true, ids: [] });
    expect(mockRedis.get).toHaveBeenCalledWith('datascope:user:1');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('缓存未命中时查数据库并写入缓存', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      roles: [{ role: { code: 'admin' } }],
      departments: [],
      employees: [],
    });

    const result = await service.visibleScope(1);

    expect(result).toEqual({ all: true, ids: [] });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'datascope:user:1',
      JSON.stringify({ all: true, ids: [] }),
      expect.any(Number),
    );
  });

  it('Redis 不可用时直接查数据库（降级）', async () => {
    mockRedis.isEnabled = false;
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      roles: [{ role: { code: 'hr' } }],
      departments: [],
      employees: [],
    });

    const result = await service.visibleScope(1);

    expect(result).toEqual({ all: true, ids: [] });
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('manager 角色应递归查询子部门并缓存完整结果', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      roles: [{ role: { code: 'manager' } }],
      departments: [{ departmentId: 10 }],
      employees: [],
    });
    // 单次查询全部部门，内存构建部门树，返回 10 及所有后代
    mockPrisma.department.findMany.mockResolvedValue([
      { id: 10, parentId: null },
      { id: 11, parentId: 10 },
      { id: 12, parentId: 10 },
      { id: 13, parentId: 11 },
    ]);

    const result = await service.visibleScope(1);

    expect(result.ids).toContain(10);
    expect(result.ids).toContain(11);
    expect(result.ids).toContain(12);
    expect(result.ids).toContain(13);
    expect(result.all).toBe(false);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it('普通员工返回仅本人范围', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      roles: [{ role: { code: 'employee' } }],
      departments: [],
      employees: [{ id: 100 }],
    });
    // 普通员工不管理任何部门
    mockPrisma.department.findMany.mockResolvedValue([]);

    const result = await service.visibleScope(1);

    expect(result.all).toBe(false);
    expect(result.ids).toEqual([]);
    expect(result.selfEmployeeId).toBe(100);
  });
});
