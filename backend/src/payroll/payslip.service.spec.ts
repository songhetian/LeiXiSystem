import { Prisma } from '@prisma/client';
import { PayslipService } from './payslip.service';
import { DataScopeService } from '../common/data-scope.service';
import { LocalFallbackStore } from '../common/local-fallback-store';
import * as bcrypt from 'bcryptjs';

// 工资条金额定点化：totalAmount 必须由明细定点累加得出，并以 Prisma.Decimal 写入
function createMockPrisma() {
  return {
    payrollRun: {
      findUnique: jest.fn(),
    },
    payslip: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  } as any;
}

function createMockRedis(isEnabled = false) {
  return {
    isEnabled,
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as any;
}

/**
 * 真实进程内兜底存储（S23 / D3）。
 *
 * 门禁测试不再传第 4 个参数时会退化为「无本地通行证」，因此需要走门禁后校验的
 * 用例必须显式传入。构造会起定时清理，用例结束调用 onModuleDestroy 释放。
 */
function createLocalFallback(...verifiedUserIds: number[]): LocalFallbackStore {
  const local = new LocalFallbackStore();
  for (const userId of verifiedUserIds) {
    local.set(`payslip:privacy-ok:${userId}`, '1', 300);
  }
  return local;
}

describe('PayslipService.generateFromRun — 金额定点化', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;
  const redis = createMockRedis(false);

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope, redis);
  });

  afterEach(() => jest.clearAllMocks());

  it('批次不存在时抛 404（薪资域错误码 3004）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue(null);

    await expect(service.generateFromRun(99)).rejects.toMatchObject({
      response: { code: 3004 },
    });
    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });

  it('按员工分组明细，总额为明细定点累加并以 Prisma.Decimal 写入', async () => {
    // 明细金额刻意选择浮点不友好的数值：0.07 × 100 朴素累加会漂移
    const details = Array.from({ length: 100 }, () => ({
      employeeId: 1,
      itemCode: 'meal',
      itemName: '餐补',
      amount: new Prisma.Decimal('0.07'),
    }));
    details.push({
      employeeId: 1,
      itemCode: 'base',
      itemName: '基本工资',
      amount: new Prisma.Decimal('8333.33'),
    });
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details,
    });

    await service.generateFromRun(5);

    expect(prisma.payslip.createMany).toHaveBeenCalledTimes(1);
    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(1);
    expect(data[0].month).toBe('2026-08');
    expect(data[0].totalAmount).toBeInstanceOf(Prisma.Decimal);
    // 0.07 × 100 + 8333.33 = 8340.33，定点累加必须精确无漂移
    expect(data[0].totalAmount.toNumber()).toBe(8340.33);
    expect(data[0].totalAmount.decimalPlaces()).toBeLessThanOrEqual(2);
    // itemsJson 保留明细原文，供工资条详情展示
    expect(JSON.parse(data[0].itemsJson)).toHaveLength(101);
  });

  it('已存在工资条的员工跳过，不重复生成', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000') },
        { employeeId: 2, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('6000') },
      ],
    });
    prisma.payslip.findMany.mockResolvedValue([{ employeeId: 1 }]);

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(2);
    expect(data[0].totalAmount.toNumber()).toBe(6000);
  });

  it('无明细时不写库', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({ id: 5, month: '2026-08', details: [] });

    await service.generateFromRun(5);

    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });
});

describe('PayslipService — 工资条不存在（薪资域错误码 3011）', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let local: LocalFallbackStore;
  const dataScope = {} as DataScopeService;
  const redis = createMockRedis(false);

  beforeEach(() => {
    prisma = createMockPrisma();
    // Redis 未配置时门禁只认本地通行证，先给用户 1 置位，聚焦「工资条不存在」分支
    local = createLocalFallback(1);
    service = new PayslipService(prisma, dataScope, redis, local);
  });

  afterEach(() => {
    jest.clearAllMocks();
    local.onModuleDestroy();
  });

  it('getMyPayslipDetail：员工档案缺失时抛 3011 而非报销域 4004', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    await expect(service.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('getMyPayslipDetail：工资条不属于本人时抛 3011', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({ id: 9, employeeId: 2 });

    await expect(service.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('markAsViewed：工资条不属于本人时抛 3011', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({ id: 9, employeeId: 2 });

    await expect(service.markAsViewed(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });
});

/**
 * 工资条口径（CONTEXT.md 业务规则）：「工资条」展示 = 计算值 + 调整值。
 *
 * `generateFromRun` 只汇总 PayrollDetail 而漏掉 PayrollAdjustment，会导致
 * 工资条总额少算（调整项为负时员工福利被多计、为正时少发），明细区也缺调整项。
 */
describe('PayslipService.generateFromRun — 工资条 = 计算值 + 调整项', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let local: LocalFallbackStore;
  const dataScope = {} as DataScopeService;
  const redis = createMockRedis(false);

  beforeEach(() => {
    prisma = createMockPrisma();
    // 末位详情用例要过二级密码门禁：Redis 未配置时依赖本地通行证
    local = createLocalFallback(1);
    service = new PayslipService(prisma, dataScope, redis, local);
  });

  afterEach(() => {
    jest.clearAllMocks();
    local.onModuleDestroy();
  });

  it('调整项计入工资条总额与 itemsJson（type=adjustment）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000.00') },
        { employeeId: 1, itemCode: 'social', itemName: '社保代扣', amount: new Prisma.Decimal('-300.00') },
      ],
      adjustments: [
        { id: 11, employeeId: 1, itemCode: 'penalty', amount: new Prisma.Decimal('-100.00'), reason: '迟到扣款', createdBy: 9 },
        { id: 12, employeeId: 1, itemCode: 'allowance', amount: new Prisma.Decimal('200.00'), reason: '项目奖金', createdBy: 9 },
      ],
    });

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    // 5000 - 300 - 100 + 200 = 4800
    expect(data[0].totalAmount.toNumber()).toBe(4800);

    const items = JSON.parse(data[0].itemsJson);
    expect(items).toHaveLength(4);
    const adjustmentItems = items.filter((i: any) => i.type === 'adjustment');
    expect(adjustmentItems).toHaveLength(2);
    expect(adjustmentItems.map((i: any) => i.amount)).toEqual([-100, 200]);
  });

  it('明细项带 type 供工资条前端分组（正数=income，负数=deduction）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000.00') },
        { employeeId: 1, itemCode: 'social', itemName: '社保代扣', amount: new Prisma.Decimal('-300.00') },
      ],
      adjustments: [],
    });

    await service.generateFromRun(5);

    const items = JSON.parse(prisma.payslip.createMany.mock.calls[0][0].data[0].itemsJson);
    expect(items).toEqual([
      { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
      { code: 'social', name: '社保代扣', amount: -300, type: 'deduction' },
    ]);
  });

  it('仅有调整项（无明细）的员工也要出工资条', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [],
      adjustments: [
        { id: 11, employeeId: 2, itemCode: 'penalty', amount: new Prisma.Decimal('-50.00'), reason: '迟到扣款', createdBy: 9 },
      ],
    });

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(2);
    expect(data[0].totalAmount.toNumber()).toBe(-50);
  });

  it('getMyPayslipDetail：把 type=adjustment 的项拆到 adjustments 字段供前端单独展示', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({
      id: 9,
      employeeId: 1,
      month: '2026-08',
      totalAmount: new Prisma.Decimal('4800.00'),
      itemsJson: JSON.stringify([
        { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
        { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
      ]),
    });

    const detail = (await service.getMyPayslipDetail(1, 9)) as any;

    expect(detail.items).toHaveLength(2);
    expect(detail.adjustments).toEqual([
      { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
    ]);
  });
});

/**
 * 工资条二级密码门禁：薪资是高敏数据，查看明细前必须先通过登录密码二次验证
 * （验证通过后 Redis 标记 5 分钟内免重复输入）。
 * 3013 = 门禁未通过（详情接口），3014 = 密码错误（验证接口）——过滤器会用
 * 中央表文案覆盖 message，两个场景文案不同，必须用不同码区分。
 */
describe('PayslipService — 工资条二级密码门禁（3013/3014）', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let local: LocalFallbackStore;
  const dataScope = {} as DataScopeService;
  const PASSWORD_HASH = bcrypt.hashSync('secret123', 10);

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis(true);
    // 每个用例一份干净的真实兜底存储，避免通行证跨用例串
    local = createLocalFallback();
    service = new PayslipService(prisma, dataScope, redis, local);
  });

  afterEach(() => {
    jest.clearAllMocks();
    local.onModuleDestroy();
  });

  describe('verifyPassword', () => {
    it('登录密码正确：写入 5 分钟验证标记并返回 verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        status: 'active',
        deletedAt: null,
      });

      const result = await service.verifyPassword(1, 'secret123');

      expect(result).toEqual({ verified: true, expiresInSeconds: 300 });
      expect(redis.set).toHaveBeenCalledWith('payslip:privacy-ok:1', '1', 300);
    });

    it('验证通过后同步写入进程内通行证，5 分钟后自动失效（Redis 断连时的兜底）', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        status: 'active',
        deletedAt: null,
      });

      await service.verifyPassword(1, 'secret123');

      const key = 'payslip:privacy-ok:1';
      expect(local.get(key)).toBe('1');

      // 超过 PRIVACY_TTL_SECONDS（300s）后必须重新验证
      const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 301 * 1000);
      expect(local.get(key)).toBeNull();
      clock.mockRestore();
    });

    it('密码错误：抛 401 3014，不写验证标记', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        status: 'active',
        deletedAt: null,
      });

      await expect(service.verifyPassword(1, 'wrong')).rejects.toMatchObject({
        response: { code: 3014 },
      });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('账号停用：即使密码正确也拒绝', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        status: 'disabled',
        deletedAt: null,
      });

      await expect(service.verifyPassword(1, 'secret123')).rejects.toMatchObject({
        response: { code: 3014 },
      });
    });

    it('账号已软删除：即使密码正确也拒绝', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        status: 'active',
        deletedAt: new Date(),
      });

      await expect(service.verifyPassword(1, 'secret123')).rejects.toMatchObject({
        response: { code: 3014 },
      });
    });

    it('用户不存在：抛 401 3014（不暴露账号是否存在）', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyPassword(1, 'secret123')).rejects.toMatchObject({
        response: { code: 3014 },
      });
    });

    // ---- 独立隐私二级密码（users.privacy_password_hash）----

    it('已设置隐私密码：登录密码不再可用（只认隐私密码）', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        privacyPasswordHash: bcrypt.hashSync('654321', 10),
        status: 'active',
        deletedAt: null,
      });

      await expect(service.verifyPassword(1, 'secret123')).rejects.toMatchObject({
        response: { code: 3014 },
      });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('已设置隐私密码：隐私密码验证通过并写标记', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        privacyPasswordHash: bcrypt.hashSync('654321', 10),
        status: 'active',
        deletedAt: null,
      });

      const result = await service.verifyPassword(1, '654321');

      expect(result).toEqual({ verified: true, expiresInSeconds: 300 });
      expect(redis.set).toHaveBeenCalledWith('payslip:privacy-ok:1', '1', 300);
    });

    it('未设置隐私密码（null）：回退校验登录密码（存量用户兼容）', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: PASSWORD_HASH,
        privacyPasswordHash: null,
        status: 'active',
        deletedAt: null,
      });

      const result = await service.verifyPassword(1, 'secret123');

      expect(result).toEqual({ verified: true, expiresInSeconds: 300 });
    });
  });

  describe('getMyPayslipDetail 门禁', () => {
    it('未通过二级密码验证：抛 403 3013，不返回明细', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
        response: { code: 3013 },
      });
      expect(prisma.payslip.findUnique).not.toHaveBeenCalled();
    });

    it('已通过验证（标记存在）：正常返回明细', async () => {
      redis.get.mockResolvedValue('1');
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.payslip.findUnique.mockResolvedValue({
        id: 9,
        employeeId: 1,
        month: '2026-08',
        totalAmount: new Prisma.Decimal('100.00'),
        itemsJson: JSON.stringify([
          { code: 'base', name: '基本工资', amount: 100, type: 'income' },
        ]),
      });

      const detail = (await service.getMyPayslipDetail(1, 9)) as any;

      expect(detail.items).toHaveLength(1);
    });

    it('Redis 未配置且本地无通行证：仍要求二次验证（3013），不再 fail-open', async () => {
      const disabledRedis = createMockRedis(false);
      const svc = new PayslipService(prisma, dataScope, disabledRedis, local);

      await expect(svc.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
        response: { code: 3013 },
      });
      // 门禁在查询工资条之前拦截，避免用 3011 暴露「该 id 是否存在」
      expect(prisma.payslip.findUnique).not.toHaveBeenCalled();
    });

    it('Redis 未配置但本地已有通行证：正常返回明细', async () => {
      const disabledRedis = createMockRedis(false);
      const svc = new PayslipService(prisma, dataScope, disabledRedis, local);
      local.set('payslip:privacy-ok:1', '1', 300);
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.payslip.findUnique.mockResolvedValue({
        id: 9,
        employeeId: 1,
        month: '2026-08',
        totalAmount: new Prisma.Decimal('100.00'),
        itemsJson: JSON.stringify([
          { code: 'base', name: '基本工资', amount: 100, type: 'income' },
        ]),
      });

      const detail = (await svc.getMyPayslipDetail(1, 9)) as any;

      expect(detail.items).toHaveLength(1);
    });

    // 回归：Redis 已配置但连接不可达时 RedisService.get 返回 null（set 也静默失败）。
    // 若只写/只读 Redis，用户输对密码拿到 verified=true 后打开详情仍然 403，形成死循环。
    it('Redis 故障（isEnabled=true 但 get 返回 null）：本地通行证放行，不再 403', async () => {
      local.set('payslip:privacy-ok:1', '1', 300);
      redis.get.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ id: 1 });
      prisma.payslip.findUnique.mockResolvedValue({
        id: 9,
        employeeId: 1,
        month: '2026-08',
        totalAmount: new Prisma.Decimal('100.00'),
        itemsJson: JSON.stringify([
          { code: 'base', name: '基本工资', amount: 100, type: 'income' },
        ]),
      });

      const detail = (await service.getMyPayslipDetail(1, 9)) as any;

      expect(detail.items).toHaveLength(1);
    });
  });
});

/**
 * 工资条列表的月份筛选：controller 此前不接收 month，service 也不过滤，
 * 用户在页面上选月份后列表纹丝不动 —— 筛选控件存在但形同虚设。
 */
describe('PayslipService.getMyPayslips — 月份筛选', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;
  const redis = createMockRedis(false);

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope, redis);
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
    prisma.payslip.findMany.mockResolvedValue([]);
    prisma.payslip.count.mockResolvedValue(0);
  });

  afterEach(() => jest.clearAllMocks());

  it('传 month 时按月过滤，findMany 与 count 用同一 where 口径', async () => {
    await service.getMyPayslips(1, 1, 10, '2026-09');

    const expectedWhere = { employeeId: 7, month: '2026-09' };
    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    // count 与 findMany 条件必须一致，否则会出现「列表 0 条但总数 12」的错位分页
    expect(prisma.payslip.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('不传 month 时不过滤，返回该员工全部月份', async () => {
    await service.getMyPayslips(1, 1, 10);

    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 7 } }),
    );
    expect(prisma.payslip.count).toHaveBeenCalledWith({ where: { employeeId: 7 } });
  });

  it('month 传空串视同未筛选（前端清空月份后不应查不到任何数据）', async () => {
    await service.getMyPayslips(1, 1, 10, '');

    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 7 } }),
    );
  });
});

/**
 * 列表/详情派生字段：Prisma 的 Payslip 实体只有 total_amount 与 items_json，
 * 页面上要展示的「基本工资 / 应发合计 / 扣款合计 / 实发工资」必须由 items_json 汇总得出。
 * 此前两个接口都直接透传实体，导致这四列在工资条页面全是空白。
 */
describe('PayslipService — 工资条派生金额字段', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let local: LocalFallbackStore;
  const dataScope = {} as DataScopeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    // 详情用例要过二级密码门禁：Redis 未配置时依赖本地通行证
    local = createLocalFallback(1);
    service = new PayslipService(prisma, dataScope, createMockRedis(false), local);
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
  });

  afterEach(() => {
    jest.clearAllMocks();
    local.onModuleDestroy();
  });

  const makePayslip = (items: unknown[], totalAmount = '0.00') => ({
    id: 9,
    runId: 5,
    employeeId: 7,
    month: '2026-09',
    totalAmount: new Prisma.Decimal(totalAmount),
    status: 'unviewed',
    viewedAt: null,
    itemsJson: JSON.stringify(items),
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  });

  it('列表补齐 baseSalary / totalIncome / totalDeduction / netSalary', async () => {
    const items = [
      { code: 'base', name: '基本工资', amount: 8000, type: 'income' },
      { code: 'bonus', name: '绩效奖金', amount: 1500, type: 'income' },
      { code: 'social', name: '社保代扣', amount: -800, type: 'deduction' },
      { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
    ];
    prisma.payslip.findMany.mockResolvedValue([makePayslip(items, '8600.00')]);
    prisma.payslip.count.mockResolvedValue(1);

    const result = await service.getMyPayslips(1, 1, 10);
    const row = (result.list as any[])[0];

    expect(row.baseSalary).toBe('8000.00');
    // 应发只算 income 项（调整项不参与「应发合计」，详情页把调整项单独成块，
    // 并进应发会重复计算）
    expect(row.totalIncome).toBe('9500.00');
    expect(row.totalDeduction).toBe('-800.00');
    // 调整项单列一桶：年度累计页要能算出「应发 + 调整 + 扣款 = 实发」
    expect(row.adjustmentTotal).toBe('-100.00');
    // 实发以批次落库的 total_amount 为准（含调整项），不重复计算
    expect(row.netSalary).toBe('8600.00');
    // 对账恒等式
    expect(
      Number(row.totalIncome) + Number(row.adjustmentTotal) + Number(row.totalDeduction),
    ).toBeCloseTo(Number(row.netSalary), 2);
  });

  it('正数调整项计入 adjustmentTotal，不影响应发合计', async () => {
    const items = [
      { code: 'base', name: '基本工资', amount: 8000, type: 'income' },
      { code: 'social', name: '社保代扣', amount: -800, type: 'deduction' },
      { code: 'award', name: '季度奖励', amount: 500, type: 'adjustment' },
    ];
    prisma.payslip.findMany.mockResolvedValue([makePayslip(items, '7700.00')]);
    prisma.payslip.count.mockResolvedValue(1);

    const row = (await service.getMyPayslips(1, 1, 10)).list[0] as any;

    expect(row.totalIncome).toBe('8000.00');
    expect(row.totalDeduction).toBe('-800.00');
    expect(row.adjustmentTotal).toBe('500.00');
    expect(
      Number(row.totalIncome) + Number(row.adjustmentTotal) + Number(row.totalDeduction),
    ).toBeCloseTo(7700, 2);
  });

  it('汇总走 Decimal 定点累加，避免浮点漂移', async () => {
    const items = Array.from({ length: 100 }, () => ({
      code: 'meal',
      name: '餐补',
      amount: 0.07,
      type: 'income',
    }));
    prisma.payslip.findMany.mockResolvedValue([makePayslip(items, '7.00')]);
    prisma.payslip.count.mockResolvedValue(1);

    const row = (await service.getMyPayslips(1, 1, 10)).list[0] as any;

    // 朴素浮点累加 0.07 × 100 = 7.000000000000001
    expect(row.totalIncome).toBe('7.00');
  });

  it('items_json 损坏时降级为 0，不影响列表整体返回', async () => {
    prisma.payslip.findMany.mockResolvedValue([
      { ...makePayslip([], '100.00'), itemsJson: 'not-json' },
    ]);
    prisma.payslip.count.mockResolvedValue(1);

    const row = (await service.getMyPayslips(1, 1, 10)).list[0] as any;

    expect(row.totalIncome).toBe('0.00');
    expect(row.totalDeduction).toBe('0.00');
    expect(row.netSalary).toBe('100.00');
  });

  it('没有 base 项时 baseSalary 为 null（前端展示 --，而不是伪造的 0）', async () => {
    prisma.payslip.findMany.mockResolvedValue([
      makePayslip([{ code: 'bonus', name: '奖金', amount: 500, type: 'income' }], '500.00'),
    ]);
    prisma.payslip.count.mockResolvedValue(1);

    const row = (await service.getMyPayslips(1, 1, 10)).list[0] as any;

    expect(row.baseSalary).toBeNull();
  });

  it('详情同样补齐派生金额与员工归属信息', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 7,
      employeeNo: 'E007',
      name: '张三',
      department: { id: 3, name: '技术部' },
    });
    prisma.payslip.findUnique.mockResolvedValue(
      makePayslip(
        [
          { code: 'base', name: '基本工资', amount: 8000, type: 'income' },
          { code: 'social', name: '社保代扣', amount: -800, type: 'deduction' },
        ],
        '7200.00',
      ),
    );

    const detail = (await service.getMyPayslipDetail(1, 9)) as any;

    expect(detail.totalIncome).toBe('8000.00');
    expect(detail.totalDeduction).toBe('-800.00');
    expect(detail.netSalary).toBe('7200.00');
    expect(detail.employeeNo).toBe('E007');
    expect(detail.employeeName).toBe('张三');
    expect(detail.departmentName).toBe('技术部');
    expect(detail.items).toHaveLength(2);
  });
});

/**
 * 年度累计：员工对账需要「今年一共发了多少、扣了多少」。
 * 口径与列表/详情一致（应发只算 income，扣款为负数，实发取批次落库的 total_amount），
 * 累加用 Decimal 定点，跨年数据绝不能串进来。
 */
describe('PayslipService.getMyYearSummary — 年度累计', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope, createMockRedis(false));
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
    prisma.payslip.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  const makePayslip = (month: string, items: unknown[], totalAmount: string) => ({
    id: 9,
    employeeId: 7,
    month,
    totalAmount: new Prisma.Decimal(totalAmount),
    itemsJson: JSON.stringify(items),
  });

  it('按员工 + 年份过滤，只取当年工资条', async () => {
    await service.getMyYearSummary(1, '2026');

    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employeeId: 7, month: { startsWith: '2026-' } },
      }),
    );
  });

  it('应发/扣款/实发按 Decimal 定点累加，月份数取工资条条数', async () => {
    prisma.payslip.findMany.mockResolvedValue([
      makePayslip(
        '2026-01',
        [
          { code: 'base', name: '基本工资', amount: 8000, type: 'income' },
          { code: 'social', name: '社保代扣', amount: -800, type: 'deduction' },
          { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
        ],
        '7100.00',
      ),
      makePayslip(
        '2026-02',
        [
          { code: 'base', name: '基本工资', amount: 8000.07, type: 'income' },
          { code: 'social', name: '社保代扣', amount: -800, type: 'deduction' },
        ],
        '7200.07',
      ),
    ]);

    const summary = await service.getMyYearSummary(1, '2026');

    expect(summary).toEqual({
      year: '2026',
      months: 2,
      // 8000 + 8000.07，定点累加无 16000.070000000002 漂移
      totalIncome: '16000.07',
      totalDeduction: '-1600.00',
      // 1 月有一笔 -100 的迟到扣款（type=adjustment）：单列一桶后
      // 16000.07 - 100 - 1600 = 14300.07，恒等式成立
      adjustmentTotal: '-100.00',
      // 7100.00 + 7200.07
      netSalary: '14300.07',
    });
  });

  it('员工档案缺失时降级为全 0，不抛错', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    const summary = await service.getMyYearSummary(1, '2026');

    expect(summary).toEqual({
      year: '2026',
      months: 0,
      totalIncome: '0.00',
      totalDeduction: '0.00',
      adjustmentTotal: '0.00',
      netSalary: '0.00',
    });
    expect(prisma.payslip.findMany).not.toHaveBeenCalled();
  });

  it('items_json 损坏的月份降级为 0，实发仍按落库总额计入', async () => {
    prisma.payslip.findMany.mockResolvedValue([
      { id: 9, employeeId: 7, month: '2026-03', totalAmount: new Prisma.Decimal('100.00'), itemsJson: 'not-json' },
    ]);

    const summary = await service.getMyYearSummary(1, '2026');

    expect(summary.totalIncome).toBe('0.00');
    expect(summary.totalDeduction).toBe('0.00');
    expect(summary.netSalary).toBe('100.00');
  });
});

/**
 * 管理端工资条详情：HR 需要点开某个员工的某月工资条核对明细。
 * 与员工端一致返回派生金额与归属信息，但必须受数据权限约束——
 * 受限用户不能借 id 直接读到别的部门的工资条（越权与不存在的表现必须一致）。
 */
describe('PayslipService.getPayslipDetail — 管理端详情与数据权限', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: any;

  const payslipRow = {
    id: 9,
    employeeId: 11,
    month: '2026-08',
    totalAmount: new Prisma.Decimal('5200.00'),
    itemsJson: JSON.stringify([
      { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
      { code: 'social', name: '社保代扣', amount: -500, type: 'deduction' },
      { code: 'penalty', name: '迟到扣款', amount: 700, type: 'adjustment' },
    ]),
    status: 'unviewed',
    employee: {
      id: 11,
      employeeNo: 'E011',
      name: '张三',
      department: { id: 3, name: '技术部' },
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.payslip.findUnique.mockResolvedValue(payslipRow);
    dataScope = { visibleScope: jest.fn().mockResolvedValue({ all: true, ids: [] }) };
    service = new PayslipService(prisma, dataScope, createMockRedis(false));
  });

  afterEach(() => jest.clearAllMocks());

  it('全量数据权限：返回明细、派生金额与员工归属信息', async () => {
    const detail = (await service.getPayslipDetail(1, 9)) as any;

    expect(detail.employeeNo).toBe('E011');
    expect(detail.employeeName).toBe('张三');
    expect(detail.departmentName).toBe('技术部');
    expect(detail.items).toHaveLength(3);
    // 应发只算 income、扣款为负、实发取落库总额
    expect(detail.totalIncome).toBe('5000.00');
    expect(detail.totalDeduction).toBe('-500.00');
    expect(detail.netSalary).toBe('5200.00');
    // 调整项单独拆出，前端独立区块展示
    expect(detail.adjustments).toHaveLength(1);
  });

  it('部门受限用户可看本部门工资条', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [3] });

    await expect(service.getPayslipDetail(1, 9)).resolves.toBeTruthy();
  });

  it('部门受限用户看别的部门工资条：按不存在处理（3011），不泄露存在性', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [4] });

    await expect(service.getPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('无权访问任何范围（空 scope）时 fail-closed', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [] });

    await expect(service.getPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('仅本人范围：只能看自己的工资条', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 11 });

    await expect(service.getPayslipDetail(1, 9)).resolves.toBeTruthy();

    prisma.payslip.findUnique.mockResolvedValue({
      ...payslipRow,
      employeeId: 12,
      employee: { ...payslipRow.employee, id: 12 },
    });
    await expect(service.getPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('工资条不存在时抛 3011', async () => {
    prisma.payslip.findUnique.mockResolvedValue(null);

    await expect(service.getPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });
});

/**
 * 管理端工资条列表：HR 需要按「查看状态 / 部门」筛出目标人群
 * （例如筛出未查看的员工去催办），并受数据权限约束。
 */
describe('PayslipService.listPayslips — 查看状态与部门筛选', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.payslip.findMany.mockResolvedValue([]);
    prisma.payslip.count.mockResolvedValue(0);
    dataScope = { visibleScope: jest.fn().mockResolvedValue({ all: true }) };
    service = new PayslipService(prisma, dataScope, createMockRedis(false));
  });

  afterEach(() => jest.clearAllMocks());

  it('按查看状态过滤（unviewed），用于筛出未读名单催办', async () => {
    await service.listPayslips({ userId: 1, status: 'unviewed', page: 1, pageSize: 10 });

    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'unviewed' } }),
    );
    expect(prisma.payslip.count).toHaveBeenCalledWith({ where: { status: 'unviewed' } });
  });

  it('非法状态值不下发到查询条件（避免查出空列表却无提示）', async () => {
    await service.listPayslips({ userId: 1, status: 'oops', page: 1, pageSize: 10 });

    const where = prisma.payslip.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
  });

  it('按部门过滤', async () => {
    await service.listPayslips({ userId: 1, departmentId: 3, page: 1, pageSize: 10 });

    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employee: { departmentId: 3 } } }),
    );
  });

  it('状态 + 部门 + 批次条件可组合', async () => {
    await service.listPayslips({
      userId: 1,
      runId: 5,
      status: 'viewed',
      departmentId: 3,
      page: 1,
      pageSize: 10,
    });

    const where = prisma.payslip.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ runId: 5, status: 'viewed', employee: { departmentId: 3 } });
  });

  it('数据权限受限时，部门筛选与可见部门取交集（不可越权看别的部门）', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [3, 4], selfEmployeeId: undefined });

    await service.listPayslips({ userId: 1, departmentId: 8, page: 1, pageSize: 10 });

    // 8 不在可见范围内 → 交集为空，返回空集（不允许放开到部门 8）
    expect(prisma.payslip.findMany.mock.calls[0][0].where.employee).toEqual({
      departmentId: { in: [] },
    });
  });
});