import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// 工单创建入参
export interface HelpdeskTicketCreateDto {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  requesterId?: number;
  assigneeId?: number | null;
}

// 工单更新入参（状态/指派等）
export interface HelpdeskTicketUpdateDto {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assigneeId?: number | null;
}

// SLA 创建/更新入参
export interface HelpdeskSlaUpsertDto {
  name: string;
  priority: string;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
  enabled?: boolean;
}

@Injectable()
export class HelpdeskService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== 工单（ticket） =====

  // 创建工单：自动生成 ticketNo，并按 priority 匹配启用的 SLA 设置 dueAt
  async createTicket(dto: HelpdeskTicketCreateDto) {
    const ticketNo = `TK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // 按优先级匹配启用的 SLA（取第一个命中的）
    const sla = await this.prisma.helpdeskSla.findFirst({
      where: { priority: dto.priority ?? 'medium', enabled: true },
      orderBy: { id: 'asc' },
    });

    const data: Prisma.HelpdeskTicketUncheckedCreateInput = {
      ticketNo,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      priority: dto.priority ?? 'medium',
      status: 'open',
      requesterId: dto.requesterId,
      assigneeId: dto.assigneeId,
    };
    if (sla) {
      // 按 SLA 解决时限计算截止时间
      data.slaId = sla.id;
      data.dueAt = new Date(Date.now() + sla.resolutionMinutes * 60 * 1000);
    }

    try {
      const ticket = await this.prisma.helpdeskTicket.create({ data });
      return await this.findTicketById(ticket.id);
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2001, message: '工单编号重复' });
      }
      throw e;
    }
  }

  // 工单列表：可按 status / priority / assigneeId 过滤，并附带 requester / assignee 关联
  async listTickets(query: { status?: string; priority?: string; assigneeId?: number }) {
    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId !== undefined && query.assigneeId !== null) where.assigneeId = query.assigneeId;

    const list = await this.prisma.helpdeskTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { list: await this.enrichTicketPeople(list), total: list.length };
  }

  // 查询单个工单（带关联人员信息）
  private async findTicketById(id: number) {
    const ticket = await this.prisma.helpdeskTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException({ code: 2001, message: '工单不存在' });
    const enriched = await this.enrichTicketPeople([ticket]);
    return enriched[0];
  }

  // 为工单补充 requester / assignee 关联（关联到 User 的员工信息）
  private async enrichTicketPeople(tickets: any[]) {
    const ids = new Set<number>();
    for (const t of tickets) {
      if (t.requesterId) ids.add(t.requesterId);
      if (t.assigneeId) ids.add(t.assigneeId);
    }
    const peopleMap: Record<number, { id: number; name: string | null; employeeNo: string | null }> = {};
    if (ids.size) {
      const employees = await this.prisma.employee.findMany({
        where: { userId: { in: [...ids] } },
        select: { id: true, userId: true, name: true, employeeNo: true },
      });
      for (const emp of employees) {
        if (emp.userId) peopleMap[emp.userId] = { id: emp.id, name: emp.name, employeeNo: emp.employeeNo };
      }
    }
    return tickets.map((t) => ({
      ...t,
      requester: t.requesterId ? peopleMap[t.requesterId] ?? null : null,
      assignee: t.assigneeId ? peopleMap[t.assigneeId] ?? null : null,
    }));
  }

  // 更新工单：状态 / 指派等
  async updateTicket(id: number, dto: HelpdeskTicketUpdateDto) {
    await this.findTicketById(id);
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if (dto[key as keyof HelpdeskTicketUpdateDto] !== undefined) {
        data[key] = dto[key as keyof HelpdeskTicketUpdateDto];
      }
    }
    await this.prisma.helpdeskTicket.update({ where: { id }, data });
    return await this.findTicketById(id);
  }

  // 关闭工单：写入 resolvedAt
  async resolveTicket(id: number) {
    await this.findTicketById(id);
    const data: Record<string, any> = { status: 'resolved', resolvedAt: new Date() };
    await this.prisma.helpdeskTicket.update({ where: { id }, data });
    return await this.findTicketById(id);
  }

  async removeTicket(id: number) {
    await this.findTicketById(id);
    await this.prisma.helpdeskTicket.delete({ where: { id } });
    return { success: true };
  }

  // ===== SLA =====
  async listSlas() {
    const list = await this.prisma.helpdeskSla.findMany({ orderBy: [{ priority: 'asc' }, { id: 'asc' }] });
    return { list, total: list.length };
  }

  async createSla(dto: HelpdeskSlaUpsertDto) {
    try {
      return await this.prisma.helpdeskSla.create({
        data: {
          name: dto.name,
          priority: dto.priority,
          firstResponseMinutes: dto.firstResponseMinutes ?? 60,
          resolutionMinutes: dto.resolutionMinutes ?? 480,
          enabled: dto.enabled ?? true,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2001, message: 'SLA 名称已存在' });
      }
      throw e;
    }
  }

  async updateSla(id: number, dto: Partial<HelpdeskSlaUpsertDto>) {
    const sla = await this.prisma.helpdeskSla.findUnique({ where: { id } });
    if (!sla) throw new NotFoundException({ code: 2001, message: 'SLA 不存在' });
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if (dto[key as keyof HelpdeskSlaUpsertDto] !== undefined) {
        data[key] = dto[key as keyof HelpdeskSlaUpsertDto];
      }
    }
    try {
      return await this.prisma.helpdeskSla.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2001, message: 'SLA 名称已存在' });
      }
      throw e;
    }
  }

  async removeSla(id: number) {
    const sla = await this.prisma.helpdeskSla.findUnique({ where: { id } });
    if (!sla) throw new NotFoundException({ code: 2001, message: 'SLA 不存在' });
    // 如果 SLA 已被工单使用则不允许删除
    const used = await this.prisma.helpdeskTicket.count({ where: { slaId: id }, take: 1 });
    if (used > 0) {
      throw new BadRequestException({ code: 2001, message: '该 SLA 已被工单使用，无法删除' });
    }
    await this.prisma.helpdeskSla.delete({ where: { id } });
    return { success: true };
  }
}