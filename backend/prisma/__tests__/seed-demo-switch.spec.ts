import { seedBusiness, seedPermissions, isDemoSeedEnabled, PERMISSIONS } from '../seed';
import { seedRealData } from '../seed-real-data';

const seedRealDataMock = seedRealData as unknown as jest.Mock;

// 演示业务数据由 seedRealData 统一写入；开关是否正确，就看它是否被调用
jest.mock('../seed-real-data', () => ({
  seedRealData: jest.fn().mockResolvedValue(undefined),
}));

/**
 * 构造 Prisma 桩：未显式覆写的模型方法一律返回 undefined。
 * 这样「本不该被调用的模型」在测试里会留下调用记录，可直接断言。
 * 覆写项与自动桩**合并**（而非整体替换），演示路径额外用到的方法无需重复声明。
 */
function createPrismaMock(overrides: Record<string, any> = {}) {
  const modelCache = new Map<string, any>();

  const modelOf = (name: string) => {
    if (!modelCache.has(name)) modelCache.set(name, { ...(overrides[name] ?? {}) });
    const model = modelCache.get(name);
    return new Proxy(model, {
      get(target, method: string) {
        if (!target[method]) target[method] = jest.fn().mockResolvedValue(undefined);
        return target[method];
      },
    });
  };

  const prisma = new Proxy({} as any, {
    get(_t, prop: string) {
      if (prop === '$disconnect') return jest.fn().mockResolvedValue(undefined);
      return modelOf(prop);
    },
  });

  return { prisma, modelOf };
}

function buildMocks() {
  const userUpserts: any[] = [];
  const { prisma, modelOf } = createPrismaMock({
    permission: {
      upsert: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue(PERMISSIONS.map((p, i) => ({ ...p, id: i + 1 }))),
    },
    role: {
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: create.code === 'admin' ? 1 : 2, ...create })),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 2, code: 'staff' }),
    },
    user: {
      upsert: jest.fn().mockImplementation(({ where, create }: any) => {
        userUpserts.push(where.username);
        return Promise.resolve({ id: where.username === 'admin' ? 1 : 2, ...create });
      }),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 13, employeeNo: 'E013' }),
    },
    department: {
      findFirst: jest.fn().mockResolvedValue(null),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 3, name: '客服部' }),
    },
    // 演示审批单：findFirst 判重 → create 返回实例 → 记录/请假明细写入
    approvalInstance: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 100 }),
    },
    // 演示知识库：分类要返回真实 id，否则后续建文章取不到 categoryId
    knowledgeCategory: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data })),
    },
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    },
    vacationType: {
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 9, ...create })),
    },
    approvalWorkflow: { upsert: jest.fn().mockResolvedValue({ id: 5 }) },
    // seed 只在「流程下还没有节点」时铺默认节点（先 findFirst 判空再 create），
    // 不再按 nodeKey upsert —— 否则会把管理员改配置时删掉的节点复活。
    approvalWorkflowNode: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 6 }),
    },
  });

  return { prisma, modelOf, userUpserts };
}

describe('seed 演示数据开关（SEED_DEMO）', () => {
  const originalEnv = process.env.SEED_DEMO;
  const originalRedis = process.env.REDIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    // 避免 seed 里的权限缓存失效逻辑在测试中真的去连 Redis
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SEED_DEMO;
    else process.env.SEED_DEMO = originalEnv;
    if (originalRedis !== undefined) process.env.REDIS_URL = originalRedis;
  });

  it('SEED_DEMO 未设置时默认写入演示数据（开发/试用行为不变）', () => {
    delete process.env.SEED_DEMO;
    expect(isDemoSeedEnabled()).toBe(true);
  });

  it('SEED_DEMO=false 时关闭演示数据', () => {
    process.env.SEED_DEMO = 'false';
    expect(isDemoSeedEnabled()).toBe(false);
  });

  it('SEED_DEMO=false：只建基础数据，不写演示员工/知识库/公告，也不建 staff 演示账号', async () => {
    process.env.SEED_DEMO = 'false';
    const { prisma, modelOf, userUpserts } = buildMocks();

    await seedBusiness(prisma, { demo: false });

    // 演示业务数据整体跳过
    expect(seedRealDataMock).not.toHaveBeenCalled();
    expect(modelOf('knowledgeArticle').findFirst).not.toHaveBeenCalled();
    expect(modelOf('broadcast').create).not.toHaveBeenCalled();
    // 演示账号 staff 不创建，管理员仍保留（否则无人可登录）
    expect(userUpserts).toEqual(['admin']);
    // 基础配置仍然写入：系统设置 + 默认审批流程
    expect(modelOf('systemSetting').create).toHaveBeenCalled();
    expect(modelOf('approvalWorkflow').upsert).toHaveBeenCalled();
  });

  it('SEED_DEMO=true：写入演示数据并创建 staff 演示账号', async () => {
    process.env.SEED_DEMO = 'true';
    const { prisma, userUpserts } = buildMocks();

    await seedBusiness(prisma, { demo: true });

    expect(seedRealDataMock).toHaveBeenCalledTimes(1);
    expect(userUpserts).toEqual(['admin', 'staff']);
  });

  it('seedPermissions 在 demo=false 时只创建 admin', async () => {
    const { prisma, userUpserts } = buildMocks();

    const result = await seedPermissions(prisma, { demo: false });

    expect(userUpserts).toEqual(['admin']);
    expect(result.staff).toBeNull();
    expect(result.admin.id).toBe(1);
  });
});
