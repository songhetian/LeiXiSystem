import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalGroupService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page: number; pageSize: number; keyword?: string; status?: number }) {
    const { page, pageSize, keyword, status } = params;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;

    const [total, list] = await Promise.all([
      this.prisma.approvalGroup.count({ where }),
      this.prisma.approvalGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          members: {
            include: {
              group: false,
            },
          },
        },
      }),
    ]);

    return { list, total, page, pageSize };
  }

  async detail(id: number) {
    const group = await this.prisma.approvalGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            group: false,
          },
        },
      },
    });
    if (!group) {
      throw new NotFoundException({ code: 6401, message: '审批组不存在' });
    }
    return group;
  }

  async create(params: { name: string; code: string; description?: string; memberIds?: number[]; createdBy: number }) {
    const existing = await this.prisma.approvalGroup.findUnique({
      where: { code: params.code },
    });
    if (existing) {
      throw new ConflictException({ code: 6402, message: '审批组编码已存在' });
    }

    const group = await this.prisma.approvalGroup.create({
      data: {
        name: params.name,
        code: params.code,
        description: params.description,
        createdBy: params.createdBy,
        members: params.memberIds && params.memberIds.length > 0
          ? { create: params.memberIds.map(userId => ({ userId })) }
          : undefined,
      },
      include: { members: true },
    });

    return group;
  }

  async update(id: number, params: { name?: string; description?: string; memberIds?: number[]; status?: number }) {
    const group = await this.prisma.approvalGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException({ code: 6401, message: '审批组不存在' });
    }

    const data: any = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.description !== undefined) data.description = params.description;
    if (params.status !== undefined) data.status = params.status;

    if (params.memberIds !== undefined) {
      data.members = {
        deleteMany: {},
        create: params.memberIds.map(userId => ({ userId })),
      };
    }

    const updated = await this.prisma.approvalGroup.update({
      where: { id },
      data,
      include: { members: true },
    });

    return updated;
  }

  async remove(id: number) {
    const group = await this.prisma.approvalGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException({ code: 6401, message: '审批组不存在' });
    }

    await this.prisma.approvalGroup.delete({ where: { id } });
    return { success: true };
  }

  async getGroupMembers(groupId: number): Promise<number[]> {
    const members = await this.prisma.approvalGroupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    return members.map(m => m.userId);
  }
}
