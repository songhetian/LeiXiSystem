import { NotificationService } from './notification.service';
import { NotificationChannel } from './channels';
import { InAppNotificationProvider } from './channels/in-app-notification.provider';
import { EmailNotificationProvider } from './channels/email-notification.provider';
import { SmsNotificationProvider } from './channels/sms-notification.provider';

const mockPrisma: any = {
  notification: {
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockEventEmitter: any = {
  emit: jest.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();

    const inAppProvider = new InAppNotificationProvider();
    const emailProvider = new EmailNotificationProvider();
    const smsProvider = new SmsNotificationProvider();

    service = new NotificationService(
      mockPrisma,
      mockEventEmitter,
      [inAppProvider, emailProvider, smsProvider],
    );
  });

  describe('create', () => {
    it('默认只发站内通知（channels 字段包含 in_app: sent）', async () => {
      const mockNotification = {
        id: 1,
        userId: 1,
        title: '测试通知',
        channels: { in_app: 'pending' },
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        channels: { in_app: 'sent' },
      });

      const result = await service.create({
        userId: 1,
        title: '测试通知',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          title: '测试通知',
          channels: { in_app: 'pending' },
        },
      });
      expect(mockPrisma.notification.update).toHaveBeenCalled();
      expect(result.channels as any).toEqual({ in_app: 'sent' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.created', expect.any(Object));
    });

    it('指定多渠道时各渠道都被调用', async () => {
      const mockNotification = {
        id: 1,
        userId: 1,
        title: '测试通知',
        channels: { in_app: 'pending', email: 'pending', sms: 'pending' },
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        channels: { in_app: 'sent', email: 'failed', sms: 'failed' },
      });

      const result = await service.create({
        userId: 1,
        title: '测试通知',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          title: '测试通知',
          channels: { in_app: 'pending', email: 'pending', sms: 'pending' },
        },
      });
      expect((result.channels as any).in_app).toBe('sent');
      expect((result.channels as any).email).toBe('failed');
      expect((result.channels as any).sms).toBe('failed');
    });

    it('未实现的渠道（email/sms）会被标记为 failed 而非抛出异常', async () => {
      const mockNotification = {
        id: 1,
        userId: 1,
        title: '测试通知',
        channels: { email: 'pending' },
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        channels: { email: 'failed' },
      });

      await expect(
        service.create({
          userId: 1,
          title: '测试通知',
          channels: [NotificationChannel.EMAIL],
        }),
      ).resolves.toBeDefined();

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { channels: { email: 'failed' } },
      });
    });

    it('未知渠道会被标记为 skipped', async () => {
      const mockNotification = {
        id: 1,
        userId: 1,
        title: '测试通知',
        channels: { wechat: 'pending' },
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        channels: { wechat: 'skipped' },
      });

      const result = await service.create({
        userId: 1,
        title: '测试通知',
        channels: ['wechat' as NotificationChannel],
      });

      expect((result.channels as any).wechat).toBe('skipped');
    });
  });

  describe('createMany', () => {
    it('批量创建通知，默认只发站内通知', async () => {
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createMany([1, 2], {
        title: '批量通知',
      });

      expect(result.count).toBe(2);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, title: '批量通知', channels: { in_app: 'pending' } },
          { userId: 2, title: '批量通知', channels: { in_app: 'pending' } },
        ],
      });
    });

    it('批量创建通知支持多渠道', async () => {
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createMany([1, 2], {
        title: '批量通知',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });

      expect(result.count).toBe(2);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, title: '批量通知', channels: { in_app: 'pending', email: 'pending' } },
          { userId: 2, title: '批量通知', channels: { in_app: 'pending', email: 'pending' } },
        ],
      });
    });

    it('空用户数组返回 count: 0', async () => {
      const result = await service.createMany([], { title: '测试' });
      expect(result.count).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
