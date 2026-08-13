import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastRecipientType } from '@prisma/client';

@Injectable()
export class BroadcastService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    status?: string;
    type?: string;
    page: number;
    pageSize: number;
    onlyPublished?: boolean;
    userId?: number;
  }) {
    const { status, type, page, pageSize, onlyPublished, userId } = params;
    const where: any = {};
    if (onlyPublished) {
      where.status = 'published';
    } else if (status) {
      where.status = status;
    }
    if (type) where.type = type;

    if (userId !== undefined && onlyPublished) {
      where.OR = [
        { recipientType: 'all' },
        {
          recipientType: 'department',
          recipients: {
            some: {
              recipientType: 'department',
              department: { employees: { some: { userId } } },
            },
          },
        },
        {
          recipientType: 'user',
          recipients: {
            some: { recipientType: 'user', userId },
          },
        },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include:
          onlyPublished !== true
            ? { recipients: true }
            : undefined,
      }),
      this.prisma.broadcast.count({ where }),
    ]);

    if (userId !== undefined && list.length > 0) {
      const ids = list.map(b => b.id);
      const reads = await this.prisma.broadcastRead.findMany({
        where: { userId, broadcastId: { in: ids } },
        select: { broadcastId: true },
      });
      const readSet = new Set(reads.map(r => r.broadcastId));
      list.forEach((b: any) => {
        b.read = readSet.has(b.id);
      });
    }

    return { list, total, page, pageSize };
  }

  async getDetail(id: number, userId?: number, withRecipients = false) {
    const bc = await this.prisma.broadcast.findUnique({
      where: { id },
      include: withRecipients ? { recipients: true } : undefined,
    });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    const result: any = { ...bc };
    if (userId !== undefined) {
      const read = await this.prisma.broadcastRead.findUnique({
        where: { broadcastId_userId: { broadcastId: id, userId } },
      });
      result.read = !!read;
    }
    return result;
  }

  async markRead(broadcastId: number, userId: number) {
    const bc = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    await this.prisma.broadcastRead.upsert({
      where: { broadcastId_userId: { broadcastId, userId } },
      update: {},
      create: { broadcastId, userId },
    });
    return { success: true };
  }

  async unreadCount(userId: number) {
    const where: any = { status: 'published' };
    where.OR = [
      { recipientType: 'all' },
      {
        recipientType: 'department',
        recipients: {
          some: {
            recipientType: 'department',
            department: { employees: { some: { userId } } },
          },
        },
      },
      {
        recipientType: 'user',
        recipients: { some: { recipientType: 'user', userId } },
      },
    ];
    const totalVisible = await this.prisma.broadcast.count({ where });
    const broadcastIds = await this.prisma.broadcast.findMany({
      where,
      select: { id: true },
    });
    const ids = broadcastIds.map(b => b.id);
    const readCount = ids.length > 0
      ? await this.prisma.broadcastRead.count({ where: { userId, broadcastId: { in: ids } } })
      : 0;
    return { count: Math.max(0, totalVisible - readCount) };
  }

  async create(params: {
    title: string;
    content?: string;
    type?: string;
    priority?: number;
    userId: number;
    recipientType?: 'all' | 'department' | 'user';
    recipientDepartmentIds?: number[];
    recipientUserIds?: number[];
  }) {
    const recipientType = params.recipientType || 'all';
    this.validateRecipients(recipientType, params.recipientDepartmentIds, params.recipientUserIds);

    const recipientsData = this.buildRecipientsData(
      recipientType,
      params.recipientDepartmentIds,
      params.recipientUserIds,
    );

    return this.prisma.broadcast.create({
      data: {
        title: params.title,
        content: params.content,
        type: params.type || 'notice',
        priority: params.priority || 0,
        recipientType,
        createdBy: params.userId,
        recipients: recipientsData.length > 0 ? { create: recipientsData } : undefined,
      },
      include: { recipients: true },
    });
  }

  async update(id: number, params: {
    title?: string;
    content?: string;
    type?: string;
    priority?: number;
    recipientType?: 'all' | 'department' | 'user';
    recipientDepartmentIds?: number[];
    recipientUserIds?: number[];
  }) {
    const bc = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    if (bc.status === 'published') {
      throw new ConflictException({ code: 6002, message: '已发布公告不可修改' });
    }

    const data: any = {};
    if (params.title !== undefined) data.title = params.title;
    if (params.content !== undefined) data.content = params.content;
    if (params.type !== undefined) data.type = params.type;
    if (params.priority !== undefined) data.priority = params.priority;

    const recipientType = params.recipientType ?? bc.recipientType;
    if (params.recipientType !== undefined || params.recipientDepartmentIds !== undefined || params.recipientUserIds !== undefined) {
      this.validateRecipients(recipientType, params.recipientDepartmentIds, params.recipientUserIds);
      data.recipientType = recipientType;
      const recipientsData = this.buildRecipientsData(
        recipientType,
        params.recipientDepartmentIds,
        params.recipientUserIds,
      );
      data.recipients = {
        deleteMany: {},
        create: recipientsData,
      };
    }

    return this.prisma.broadcast.update({
      where: { id },
      data,
      include: { recipients: true },
    });
  }

  async publish(id: number, userId: number) {
    const bc = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    if (bc.status === 'published') {
      throw new ConflictException({ code: 6002, message: '公告已发布' });
    }
    return this.prisma.broadcast.update({
      where: { id },
      data: { status: 'published', publishedBy: userId, publishedAt: new Date() },
    });
  }

  async delete(id: number) {
    const bc = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    await this.prisma.broadcast.delete({ where: { id } });
    return { success: true };
  }

  private validateRecipients(
    recipientType: string,
    departmentIds?: number[],
    userIds?: number[],
  ) {
    if (recipientType === 'department' && (!departmentIds || departmentIds.length === 0)) {
      throw new BadRequestException({ code: 6003, message: '部门类型必须指定接收部门' });
    }
    if (recipientType === 'user' && (!userIds || userIds.length === 0)) {
      throw new BadRequestException({ code: 6003, message: '人员类型必须指定接收人员' });
    }
  }

  private buildRecipientsData(
    recipientType: string,
    departmentIds?: number[],
    userIds?: number[],
  ): Array<{ recipientType: BroadcastRecipientType; departmentId?: number; userId?: number }> {
    if (recipientType === 'all') return [];
    if (recipientType === 'department') {
      return (departmentIds || []).map(did => ({ recipientType: BroadcastRecipientType.department, departmentId: did }));
    }
    if (recipientType === 'user') {
      return (userIds || []).map(uid => ({ recipientType: BroadcastRecipientType.user, userId: uid }));
    }
    return [];
  }
}
