import { BroadcastService } from './broadcast.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

// Mock PrismaService
function createMockPrisma() {
  return {
    broadcast: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    broadcastRead: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    broadcastRecipient: {
      findMany: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  } as any;
}

// Mock NotificationService
function createMockNotificationService() {
  return {
    createMany: jest.fn(),
  } as any;
}

describe('BroadcastService - markRead 接收人校验', () => {
  let service: BroadcastService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const notificationService = createMockNotificationService();
    service = new BroadcastService(prisma, notificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // recipientType=all → 任何用户可标记
  // ------------------------------------------------------------------
  it('recipientType=all 时任何用户都可以标记已读', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 1,
      recipientType: 'all',
      recipients: [],
      status: 'published',
    });
    prisma.broadcastRead.upsert.mockResolvedValue({});

    const result = await service.markRead(1, 999);

    expect(result).toEqual({ success: true });
    expect(prisma.broadcastRead.upsert).toHaveBeenCalledWith({
      where: { broadcastId_userId: { broadcastId: 1, userId: 999 } },
      update: {},
      create: { broadcastId: 1, userId: 999 },
    });
  });

  // ------------------------------------------------------------------
  // recipientType=department → 用户在接收部门内
  // ------------------------------------------------------------------
  it('recipientType=department 时部门内用户可以标记已读', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 2,
      recipientType: 'department',
      recipients: [
        { recipientType: 'department', departmentId: 10 },
        { recipientType: 'department', departmentId: 20 },
      ],
      status: 'published',
    });
    // 用户属于部门 10
    prisma.employee.findFirst.mockResolvedValue({ id: 1, departmentId: 10, userId: 5 });
    prisma.broadcastRead.upsert.mockResolvedValue({});

    const result = await service.markRead(2, 5);

    expect(result).toEqual({ success: true });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { userId: 5, departmentId: { in: [10, 20] } },
    });
  });

  // ------------------------------------------------------------------
  // recipientType=department → 用户不在接收部门内
  // ------------------------------------------------------------------
  it('recipientType=department 时非接收部门用户被拒绝', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 3,
      recipientType: 'department',
      recipients: [
        { recipientType: 'department', departmentId: 10 },
      ],
      status: 'published',
    });
    // 用户不属于部门 10
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.markRead(3, 5)).rejects.toThrow(ForbiddenException);
    expect(prisma.broadcastRead.upsert).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // recipientType=user → 用户在接收人列表中
  // ------------------------------------------------------------------
  it('recipientType=user 时接收人列表中的用户可以标记已读', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 4,
      recipientType: 'user',
      recipients: [
        { recipientType: 'user', userId: 5 },
        { recipientType: 'user', userId: 6 },
      ],
      status: 'published',
    });
    prisma.broadcastRead.upsert.mockResolvedValue({});

    const result = await service.markRead(4, 5);

    expect(result).toEqual({ success: true });
  });

  // ------------------------------------------------------------------
  // recipientType=user → 用户不在接收人列表中
  // ------------------------------------------------------------------
  it('recipientType=user 时非接收人被拒绝', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 5,
      recipientType: 'user',
      recipients: [
        { recipientType: 'user', userId: 5 },
        { recipientType: 'user', userId: 6 },
      ],
      status: 'published',
    });

    await expect(service.markRead(5, 999)).rejects.toThrow(ForbiddenException);
    expect(prisma.broadcastRead.upsert).not.toHaveBeenCalled();
  });

  // 非接收人曾使用未注册码 6004（error-codes.ts 只登记到 6003）：
  // 异常过滤器取不到中央文案，只能回退抛出 message，提示随调用点漂移。
  // 归位为已登记的 6004 → 文案唯一真相源。
  it('非接收人应返回已注册码 6004，且中央文案为「用户非该公告接收人」', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 5,
      recipientType: 'user',
      recipients: [{ recipientType: 'user', userId: 5 }],
      status: 'published',
    });

    const err = await service.markRead(5, 999).catch((e) => e);
    const payload = (err as any)?.getResponse?.() ?? (err as any)?.response ?? err;

    expect(payload.code).toBe(ERROR_CODES.BROADCAST_NOT_RECIPIENT);
    expect(messageOf(payload.code)).toBe('用户非该公告接收人');
  });

  // ------------------------------------------------------------------
  // 公告不存在
  // ------------------------------------------------------------------
  it('公告不存在时抛出 NotFoundException', async () => {
    prisma.broadcast.findUnique.mockResolvedValue(null);

    await expect(service.markRead(999, 1)).rejects.toThrow(NotFoundException);
  });
});

describe('BroadcastService - 公开查看链路（批次七）', () => {
  let service: BroadcastService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const notificationService = createMockNotificationService();
    service = new BroadcastService(prisma, notificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // getPublicDetail：已发布 + 接收人 → 返回 read
  // ------------------------------------------------------------------
  it('getPublicDetail 返回已发布公告并标注是否已读', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 1, title: '公告1', status: 'published', recipientType: 'all', recipients: [],
    });
    prisma.broadcastRead.findUnique.mockResolvedValue(null);

    const result = await service.getPublicDetail(1, 999);

    expect(result.read).toBe(false);
    expect(prisma.broadcastRead.findUnique).toHaveBeenCalledWith({
      where: { broadcastId_userId: { broadcastId: 1, userId: 999 } },
    });
  });

  // ------------------------------------------------------------------
  // getPublicDetail：未发布 → 隐藏存在性
  // ------------------------------------------------------------------
  it('getPublicDetail 未发布公告抛出 NotFoundException', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 2, status: 'draft', recipientType: 'all', recipients: [],
    });

    await expect(service.getPublicDetail(2, 1)).rejects.toThrow(NotFoundException);
  });

  // ------------------------------------------------------------------
  // getPublicDetail：非接收人被拒绝
  // ------------------------------------------------------------------
  it('getPublicDetail 非接收人被拒绝', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 3, status: 'published', recipientType: 'user',
      recipients: [{ recipientType: 'user', userId: 5 }],
    });

    await expect(service.getPublicDetail(3, 999)).rejects.toThrow(ForbiddenException);
  });

  // ------------------------------------------------------------------
  // unreadCount：可见总数 - 已读数
  // ------------------------------------------------------------------
  it('unreadCount 计算 可见总数 - 已读数', async () => {
    prisma.broadcast.count.mockResolvedValue(5);
    prisma.broadcast.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    prisma.broadcastRead.count.mockResolvedValue(2);

    const result = await service.unreadCount(1);

    expect(result.count).toBe(3);
  });

  // ------------------------------------------------------------------
  // unreadCount：无可见公告时返回 0
  // ------------------------------------------------------------------
  it('unreadCount 无可见公告时返回 0', async () => {
    prisma.broadcast.count.mockResolvedValue(0);
    prisma.broadcast.findMany.mockResolvedValue([]);

    const result = await service.unreadCount(1);

    expect(result.count).toBe(0);
    expect(prisma.broadcastRead.count).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // list(onlyPublished)：按接收人过滤 + 标注 read 并统计 total
  // ------------------------------------------------------------------
  it('list onlyPublished 过滤已发布并按 userId 标注 read', async () => {
    prisma.broadcast.findMany.mockResolvedValue([
      { id: 1, title: 'A', recipientType: 'all' },
      { id: 2, title: 'B', recipientType: 'all' },
    ]);
    prisma.broadcast.count.mockResolvedValue(2);
    prisma.broadcastRead.findMany.mockResolvedValue([{ broadcastId: 1 }]);

    const result = await service.list({ page: 1, pageSize: 20, onlyPublished: true, userId: 5 } as any);

    expect(result.total).toBe(2);
    expect(result.list).toHaveLength(2);
    const items = result.list as any[];
    expect(items[0].read).toBe(true);
    expect(items[1].read).toBe(false);
    // 仅已发布 → 不 include recipients
    const callArg = prisma.broadcast.findMany.mock.calls[0][0];
    expect(callArg.where.status).toBe('published');
    expect(callArg.where.OR).toBeDefined();
    expect(callArg.include).toBeUndefined();
  });
});

/**
 * 公告发布时的通知投递对象必须是「可登录的启用账号」：
 * 停用、待审批（pending）与软删除账号不应收到站内通知。
 */
describe('BroadcastService - 发布通知的接收人范围', () => {
  let service: BroadcastService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notificationService: { createMany: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    notificationService = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };
    service = new BroadcastService(prisma, notificationService as any);
    prisma.broadcast.update.mockResolvedValue({ id: 1, status: 'published' });
  });

  afterEach(() => jest.clearAllMocks());

  it('recipientType=all 只取启用且未软删的账号', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 1, title: '全员公告', content: 'x', status: 'draft', recipientType: 'all', recipients: [],
    });
    prisma.user.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);

    await service.publish(1, 99);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active', deletedAt: null },
      }),
    );
    expect(notificationService.createMany).toHaveBeenCalledWith([7, 8], expect.anything());
  });

  it('recipientType=department 只取关联启用账号的员工', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 2, title: '部门公告', content: 'x', status: 'draft', recipientType: 'department',
      recipients: [{ recipientType: 'department', departmentId: 10 }],
    });
    prisma.employee.findMany.mockResolvedValue([{ userId: 7 }]);

    await service.publish(2, 99);

    const where = prisma.employee.findMany.mock.calls[0][0].where;
    expect(where.user).toEqual({ is: { status: 'active', deletedAt: null } });
    expect(notificationService.createMany).toHaveBeenCalledWith([7], expect.anything());
  });

  it('recipientType=user 显式名单同样过滤掉停用/软删账号', async () => {
    prisma.broadcast.findUnique.mockResolvedValue({
      id: 3, title: '定向公告', content: 'x', status: 'draft', recipientType: 'user',
      recipients: [{ recipientType: 'user', userId: 7 }, { recipientType: 'user', userId: 8 }],
    });
    prisma.user.findMany.mockResolvedValue([{ id: 7 }]);

    await service.publish(3, 99);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [7, 8] }, status: 'active', deletedAt: null },
      }),
    );
    expect(notificationService.createMany).toHaveBeenCalledWith([7], expect.anything());
  });
});
