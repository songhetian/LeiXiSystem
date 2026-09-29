import { OkrService } from './okr.service';
import { DataScopeService, DataScope } from '../common/data-scope.service';

// ADR-0010：OKR 数据隔离
//   all → 全部；部门范围 → 本部门及子部门的部门级 OKR；仅本人 → ownerId = 本人。
function createMockPrisma() {
  return {
    okrObjective: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    okrKeyResult: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

describe('OkrService 数据隔离', () => {
  let service: OkrService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let scope: DataScope;

  beforeEach(() => {
    prisma = createMockPrisma();
    scope = { all: true, ids: [] };
    const dataScope = {
      visibleScope: jest.fn().mockImplementation(async () => scope),
    } as unknown as DataScopeService;
    service = new OkrService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listObjectives', () => {
    it('admin/hr（all）不加范围限制，ownerId 与 type 过滤照常生效', async () => {
      scope = { all: true, ids: [] };

      await service.listObjectives(1, 8, 'personal');

      const whereArg = prisma.okrObjective.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ ownerId: 8, type: 'personal' });
    });

    it('部门管理者只可见本部门及子部门的部门级 OKR', async () => {
      scope = { all: false, ids: [3, 4] };

      await service.listObjectives(1, undefined, 'team');

      const whereArg = prisma.okrObjective.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBe('team');
      expect(whereArg.departmentId).toEqual({ in: [3, 4] });
    });

    it('仅本人档强制只查本人 OKR', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      await service.listObjectives(1);

      const whereArg = prisma.okrObjective.findMany.mock.calls[0][0].where;
      expect(whereArg.ownerId).toBe(77);
    });

    it('仅本人档显式查询他人 OKR 时返回空集，且不查询数据库', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      const result = await service.listObjectives(1, 99);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.okrObjective.findMany).not.toHaveBeenCalled();
    });

    it('既无部门范围又未绑定员工时返回空集，且不查询数据库', async () => {
      scope = { all: false, ids: [] };

      const result = await service.listObjectives(1);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.okrObjective.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listKeyResults', () => {
    it('KR 归属目标：目标不在可见范围内时按「不存在」处理，不泄露数据', async () => {
      scope = { all: false, ids: [3] };
      prisma.okrObjective.findUnique.mockResolvedValue(null);

      await expect(service.listKeyResults(1, 55)).rejects.toBeTruthy();
      expect(prisma.okrKeyResult.findMany).not.toHaveBeenCalled();
    });
  });

  /**
   * 目标进度有两种来源：手工填写（create/update 传 progress）与按 KR 平均值重算。
   * 未传 progress 时程序会调用 recalcObjectiveProgress，而它在「目标下无任何 KR」
   * 时返回 0 —— 于是对无 KR 的目标改个标题，就会把用户手工填的进度静默清零。
   */
  describe('updateObjective - 无 KR 目标的手工进度不得被清零', () => {
    beforeEach(() => {
      prisma.okrObjective.update.mockImplementation(async (args: any) => args.data);
    });

    it('无 KR 的目标仅改标题时保留原 progress，且不额外写入', async () => {
      prisma.okrObjective.findUnique.mockResolvedValue({ id: 9, title: '旧标题', progress: 80 });
      prisma.okrKeyResult.findMany.mockResolvedValue([]);

      await service.updateObjective(9, { title: '新标题' });

      const data = prisma.okrObjective.update.mock.calls.at(-1)![0].data;
      expect(data.title).toBe('新标题');
      expect(data.progress).toBeUndefined();
    });

    it('有 KR 的目标未显式传 progress 时，仍按 KR 平均进度重算', async () => {
      prisma.okrObjective.findUnique.mockResolvedValue({ id: 9, title: '旧标题', progress: 0 });
      prisma.okrKeyResult.findMany.mockResolvedValue([{ progress: 60 }, { progress: 80 }]);

      await service.updateObjective(9, { title: '新标题' });

      const data = prisma.okrObjective.update.mock.calls.at(-1)![0].data;
      expect(data.progress).toBe(70);
    });
  });
});