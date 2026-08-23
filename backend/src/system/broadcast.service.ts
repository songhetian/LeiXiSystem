import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastRecipientType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

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

  /**
   * 公开端点获取公告详情：校验发布状态 + 接收人范围
   * - 未发布 → NotFoundException (隐藏存在性)
   * - 非接收人 → ForbiddenException
   */
  async getPublicDetail(id: number, userId: number) {
    const bc = await this.prisma.broadcast.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!bc || bc.status !== 'published') {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    // 校验接收人范围
    await this.assertRecipient(bc, userId);

    const read = await this.prisma.broadcastRead.findUnique({
      where: { broadcastId_userId: { broadcastId: id, userId } },
    });
    return { ...bc, read: !!read };
  }

  async markRead(broadcastId: number, userId: number) {
    const bc = await this.prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { recipients: true },
    });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }

    // 校验公告是否已发布：未发布公告不可标记已读
    if (bc.status !== 'published') {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }

    // 校验用户是否为该公告的接收人
    await this.assertRecipient(bc, userId);

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
    const bc = await this.prisma.broadcast.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    if (bc.status === 'published') {
      throw new ConflictException({ code: 6002, message: '公告已发布' });
    }
    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'published', publishedBy: userId, publishedAt: new Date() },
    });

    // Notify all recipients. Wrapped in try/catch so a notification failure
    // never breaks the publish operation.
    try {
      const userIds = await this.resolveRecipientUserIds(bc);
      if (userIds.length > 0) {
        await this.notificationService.createMany(userIds, {
          title: bc.title,
          content: bc.content ?? undefined,
          type: 'broadcast',
          relatedId: bc.id,
          relatedType: 'broadcast',
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to create broadcast notifications for broadcast ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return updated;
  }

  async delete(id: number) {
    const bc = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!bc) {
      throw new NotFoundException({ code: 6001, message: '公告不存在' });
    }
    await this.prisma.broadcast.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Asserts that the given user is a valid recipient of the broadcast.
   *
   * - `all`        → everyone is a recipient
   * - `department` → user must be linked to an employee in one of the departments
   * - `user`       → user must be explicitly listed in the recipients
   */
  private async assertRecipient(
    bc: { recipientType: string; recipients: Array<{ recipientType: string; departmentId?: number | null; userId?: number | null }> },
    userId: number,
  ) {
    if (bc.recipientType === 'all') {
      return;
    }

    if (bc.recipientType === 'user') {
      const isUserRecipient = bc.recipients.some(
        r => r.recipientType === 'user' && r.userId === userId,
      );
      if (!isUserRecipient) {
        throw new ForbiddenException({ code: 6004, message: '用户非该公告接收人' });
      }
      return;
    }

    if (bc.recipientType === 'department') {
      const deptIds = bc.recipients
        .filter(r => r.recipientType === 'department' && r.departmentId != null)
        .map(r => r.departmentId as number);
      if (deptIds.length === 0) {
        throw new ForbiddenException({ code: 6004, message: '用户非该公告接收人' });
      }
      const employee = await this.prisma.employee.findFirst({
        where: { userId, departmentId: { in: deptIds } },
      });
      if (!employee) {
        throw new ForbiddenException({ code: 6004, message: '用户非该公告接收人' });
      }
      return;
    }
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

  /**
   * Resolves the concrete user IDs that should receive a broadcast, based on
   * the broadcast's `recipientType` and its stored recipient entries.
   *
   * - `all`        → every user in the system
   * - `department` → all users linked (via Employee.userId) to employees in
   *                   the specified departments
   * - `user`       → the explicitly listed user IDs
   */
  private async resolveRecipientUserIds(
    bc: { recipientType: string; recipients: Array<{ recipientType: string; departmentId?: number | null; userId?: number | null }> },
  ): Promise<number[]> {
    if (bc.recipientType === 'all') {
      const users = await this.prisma.user.findMany({ select: { id: true } });
      return users.map(u => u.id);
    }

    if (bc.recipientType === 'user') {
      return bc.recipients
        .filter(r => r.recipientType === 'user' && r.userId != null)
        .map(r => r.userId as number);
    }

    if (bc.recipientType === 'department') {
      const deptIds = bc.recipients
        .filter(r => r.recipientType === 'department' && r.departmentId != null)
        .map(r => r.departmentId as number);
      if (deptIds.length === 0) return [];
      const employees = await this.prisma.employee.findMany({
        where: { departmentId: { in: deptIds }, userId: { not: null } },
        select: { userId: true },
      });
      return employees.map(e => e.userId as number);
    }

    return [];
  }
}
