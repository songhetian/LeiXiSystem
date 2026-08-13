import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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
  }) {
    const notification = await this.prisma.notification.create({
      data: params,
    });

    this.eventEmitter.emit('notification.created', notification);

    return notification;
  }

  async createMany(users: number[], params: {
    title: string;
    content?: string;
    type?: string;
    relatedId?: number;
    relatedType?: string;
  }) {
    if (users.length === 0) return { count: 0 };
    const data = users.map(userId => ({ userId, ...params }));
    const result = await this.prisma.notification.createMany({ data });

    for (const userId of users) {
      this.eventEmitter.emit('notification.created', { userId, ...params });
    }

    return { count: result.count };
  }
}
