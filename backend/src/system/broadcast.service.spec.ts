import { BroadcastService } from './broadcast.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

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

  // ------------------------------------------------------------------
  // 公告不存在
  // ------------------------------------------------------------------
  it('公告不存在时抛出 NotFoundException', async () => {
    prisma.broadcast.findUnique.mockResolvedValue(null);

    await expect(service.markRead(999, 1)).rejects.toThrow(NotFoundException);
  });
});
