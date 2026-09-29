import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationProvider, NotificationChannel, NotificationChannels, ChannelStatus, NOTIFICATION_PROVIDERS } from './channels';
import { NotificationClientInterface } from './notification-client.interface';
import { ERROR_CODES } from '../common/error-codes';

@Injectable()
export class NotificationService implements NotificationClientInterface {
  private providerMap: Map<NotificationChannel, NotificationProvider>;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(NOTIFICATION_PROVIDERS) private providers: NotificationProvider[],
  ) {
    this.providerMap = new Map();
    for (const provider of providers) {
      this.providerMap.set(provider.channel, provider);
    }
  }

  async list(userId: number, params: { page: number; pageSize: number; read?: boolean; type?: string }) {
    const { page, pageSize, read, type } = params;
    const where: any = { userId };
    if (read !== undefined) where.read = read;
    if (type) where.type = type;

    const [total, list] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { list, total, page, pageSize };
  }

  async unreadCount(userId: number) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markRead(id: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException({ code: 7001, message: '通知不存在' });
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException({ code: 7002, message: '无权操作此通知' });
    }
    if (notification.read) {
      return { success: true };
    }

    await this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { count: result.count };
  }

  async create(params: {
    userId: number;
    title: string;
    content?: string;
    type?: string;
    relatedId?: number;
    relatedType?: string;
    channels?: NotificationChannel[];
  }) {
    const { channels: channelList = [NotificationChannel.IN_APP], ...rest } = params;

    const channels: NotificationChannels = {};
    for (const ch of channelList) {
      channels[ch] = 'pending';
    }

    const notification = await this.prisma.notification.create({
      data: {
        ...rest,
        channels,
      },
    });

    const updatedChannels = await this.sendToChannels(channelList, rest);

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { channels: updatedChannels },
    });

    this.eventEmitter.emit('notification.created', updated);

    return updated;
  }

  async createMany(users: number[], params: {
    title: string;
    content?: string;
    type?: string;
    relatedId?: number;
    relatedType?: string;
    channels?: NotificationChannel[];
  }) {
    if (users.length === 0) return { count: 0 };

    const { channels: channelList = [NotificationChannel.IN_APP], ...restParams } = params;

    const chunks: NotificationChannels = {};
    for (const ch of channelList) {
      chunks[ch] = 'pending';
    }

    // 分批落库，避免全员公告在单条 INSERT 中插入上千行而超数据库包大小上限
    const BATCH_SIZE = 500;
    let totalCreated = 0;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batchUsers = users.slice(i, i + BATCH_SIZE);
      const data = batchUsers.map((userId) => ({ userId, ...restParams, channels: chunks }));
      const result = await this.prisma.notification.createMany({ data });
      totalCreated += result.count;
    }

    for (const userId of users) {
      await this.sendToChannels(channelList, { userId, ...restParams });
      this.eventEmitter.emit('notification.created', { userId, ...restParams });
    }

    return { count: totalCreated };
  }

  /**
   * 业务撤销/回滚时清理关联通知（跨模块调用入口，见 NotificationClientInterface）。
   * 例：算薪批次撤回会删除工资条，此时必须同步删除「工资条已发布」通知，
   * 否则用户点开通知会落到已不存在的单据。
   */
  async removeByRelated(
    relatedType: string,
    relatedId: number,
  ): Promise<{ count: number }> {
    const result = await this.prisma.notification.deleteMany({
      where: { relatedType, relatedId },
    });
    return { count: result.count };
  }

  /**
   * 通知中心发送（批次八）：管理员按目标范围向用户批量发送站内通知。
   * - targetType=user       → 直接发送给指定 userIds
   * - targetType=department → 查询部门下启用用户再批量发送
   * - targetType=all        → 查询全部启用用户再批量发送
   * 复用 createMany 走多通道/分批落库链路。
   */
  async send(params: {
    title: string;
    content?: string;
    type?: string;
    targetType: 'all' | 'department' | 'user';
    departmentIds?: number[];
    userIds?: number[];
  }) {
    const { title, content, type, targetType, departmentIds, userIds } = params;

    if (!title || !title.trim()) {
      throw new BadRequestException({
        code: ERROR_CODES.NOTIFICATION_TITLE_REQUIRED,
        message: '通知标题不能为空',
      });
    }

    let targets: number[];
    if (targetType === 'user') {
      const ids = userIds ?? [];
      if (ids.length === 0) {
        throw new BadRequestException({
          code: ERROR_CODES.NOTIFICATION_RECIPIENT_REQUIRED,
          message: '请选择接收人员',
        });
      }
      targets = ids;
    } else if (targetType === 'department') {
      const deptIds = departmentIds ?? [];
      if (deptIds.length === 0) {
        throw new BadRequestException({
          code: ERROR_CODES.NOTIFICATION_DEPARTMENT_REQUIRED,
          message: '请选择接收部门',
        });
      }
      const users = await this.prisma.user.findMany({
        where: { departmentId: { in: deptIds }, status: 'active', deletedAt: null },
        select: { id: true },
      });
      targets = users.map(u => u.id);
    } else {
      const users = await this.prisma.user.findMany({
        where: { status: 'active', deletedAt: null },
        select: { id: true },
      });
      targets = users.map(u => u.id);
    }

    return this.createMany(targets, { title, content, type });
  }

  private async sendToChannels(
    channelList: NotificationChannel[],
    payload: {
      userId: number;
      title: string;
      content?: string;
      type?: string;
      relatedId?: number;
      relatedType?: string;
    },
  ): Promise<NotificationChannels> {
    const result: NotificationChannels = {};

    for (const channel of channelList) {
      const provider = this.providerMap.get(channel);
      if (!provider) {
        result[channel] = 'skipped';
        continue;
      }

      try {
        const status: ChannelStatus = await provider.send(payload);
        result[channel] = status;
      } catch (error) {
        result[channel] = 'failed';
      }
    }

    return result;
  }
}
