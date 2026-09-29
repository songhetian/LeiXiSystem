import { HelpdeskService } from './helpdesk.service';
import { messageOf } from '../common/error-messages';

// Mock PrismaService（沿用 attendance/settings.service.spec 的写法）
function createMockPrisma() {
  return {
    helpdeskTicket: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    helpdeskSla: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    employee: { findMany: jest.fn() },
  } as any;
}

// 构造一条工单行（列表 select 后的形状）
function makeTicket(id: number) {
  return {
    id,
    ticketNo: `TK${id}`,
    title: `工单${id}`,
    description: `描述${id}`,
    category: null,
    priority: 'medium',
    status: 'open',
    requesterId: null,
    assigneeId: null,
    dueAt: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
  };
}

describe('HelpdeskService - listTickets 服务端分页与字段裁剪', () => {
  let service: HelpdeskService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new HelpdeskService(prisma);
    prisma.employee.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('未传分页参数时默认第 1 页每页 10 条，并返回 total', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([makeTicket(1)]);
    prisma.helpdeskTicket.count.mockResolvedValue(42);

    const result = await service.listTickets({});

    expect(result.total).toBe(42);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.list).toHaveLength(1);
    expect(prisma.helpdeskTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(prisma.helpdeskTicket.count).toHaveBeenCalledWith({ where: {} });
  });

  it('按 page/pageSize 计算 skip，total 独立于当前页条数', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([makeTicket(1)]);
    prisma.helpdeskTicket.count.mockResolvedValue(100);

    const result = await service.listTickets({ page: 3, pageSize: 25 });

    expect(prisma.helpdeskTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 }),
    );
    expect(result).toMatchObject({ page: 3, pageSize: 25, total: 100 });
  });

  it('page/pageSize 非法（0 或负数）时回落默认值，不产生负数 skip', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([]);
    prisma.helpdeskTicket.count.mockResolvedValue(0);

    await service.listTickets({ page: 0, pageSize: -5 });

    expect(prisma.helpdeskTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('筛选条件写入 where，且 count 与 findMany 使用同一 where', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([]);
    prisma.helpdeskTicket.count.mockResolvedValue(0);

    await service.listTickets({ status: 'open', priority: 'high', assigneeId: 7 });

    const where = { status: 'open', priority: 'high', assigneeId: 7 };
    expect(prisma.helpdeskTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(prisma.helpdeskTicket.count).toHaveBeenCalledWith({ where });
  });

  it('显式声明 select 字段，且保留 description（工单编辑弹窗依赖该字段回填）', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([makeTicket(1)]);
    prisma.helpdeskTicket.count.mockResolvedValue(1);

    const result = await service.listTickets({});

    const args = prisma.helpdeskTicket.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.description).toBe(true);
    // 列表不使用的大字段/列不应被查出
    expect(args.select.slaId).toBeUndefined();
    expect(args.select.resolvedAt).toBeUndefined();
    expect(result.list[0].description).toBe('描述1');
  });

  it('仍为工单补充 requester / assignee 关联人员', async () => {
    prisma.helpdeskTicket.findMany.mockResolvedValue([
      { ...makeTicket(1), requesterId: 11, assigneeId: 12 },
    ]);
    prisma.helpdeskTicket.count.mockResolvedValue(1);
    prisma.employee.findMany.mockResolvedValue([
      { id: 101, userId: 11, name: '张三', employeeNo: 'E001' },
      { id: 102, userId: 12, name: '李四', employeeNo: 'E002' },
    ]);

    const result = await service.listTickets({});

    expect(result.list[0].requester).toEqual({ id: 101, name: '张三', employeeNo: 'E001' });
    expect(result.list[0].assignee).toEqual({ id: 102, name: '李四', employeeNo: 'E002' });
  });
});

// 捕获异常 payload：全局过滤器会用 ERROR_MESSAGES[code] 覆盖抛出 message，
// 因此错误码必须与语义一一对应，否则用户看到的提示会张冠李戴。
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

describe('HelpdeskService - 错误码不得复用考勤域 2001（班次语义）', () => {
  let service: HelpdeskService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new HelpdeskService(prisma);
    prisma.employee.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('工单不存在：使用工单专属错误码，中央文案为「工单不存在」', async () => {
    prisma.helpdeskTicket.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateTicket(999, { title: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('工单不存在');
  });

  it('工单编号重复：使用工单专属错误码，中央文案为「工单编号重复，请重试」', async () => {
    prisma.helpdeskTicket.create.mockRejectedValue({ code: 'P2002' });

    const payload = await catchPayload(() => service.createTicket({ title: '工单' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('工单编号重复，请重试');
  });

  it('SLA 不存在：使用 SLA 专属错误码，中央文案为「SLA 不存在」', async () => {
    prisma.helpdeskSla.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateSla(999, { name: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('SLA 不存在');
  });

  it('SLA 名称重复：使用 SLA 专属错误码，中央文案为「SLA 名称已存在」', async () => {
    prisma.helpdeskSla.create.mockRejectedValue({ code: 'P2002' });

    const payload = await catchPayload(() => service.createSla({ name: 'SLA', priority: 'high' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('SLA 名称已存在');
  });

  it('SLA 被工单占用：中央文案为「该 SLA 已被工单使用，无法删除」', async () => {
    prisma.helpdeskSla.findUnique.mockResolvedValue({ id: 1, name: 'SLA' });
    prisma.helpdeskTicket.count.mockResolvedValue(1);

    const payload = await catchPayload(() => service.removeSla(1));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('该 SLA 已被工单使用，无法删除');
  });
});