import { Injectable, ConflictException, UnprocessableEntityException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 班次字段类型（对齐旧项目 work_shifts 表结构）
export interface ShiftCreateDto {
  name: string;
  startTime: string;
  endTime: string;
  isNextDay?: boolean;
  restDuration?: number;
  lateThreshold?: number;
  earlyThreshold?: number;
  useGlobalThreshold?: boolean;
  color?: string;
  departmentId?: number | null;
  description?: string;
  isActive?: boolean;
}

export interface ShiftUpdateDto extends Partial<ShiftCreateDto> {}

// 班次聚合（S04）：跨天标志校验（C1）；时间冲突 → 2001
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: ShiftCreateDto) {
    const { startTime, endTime, isNextDay } = dto;
    // 校验：非跨天班次结束必须晚于开始（C1）
    if (!isNextDay && endTime <= startTime) {
      throw new UnprocessableEntityException({ code: 2001, message: '班次结束时间必须晚于开始时间（或标记跨天）' });
    }
    // 默认值：useGlobalThreshold=true, isActive=true
    const data = {
      ...dto,
      isNextDay: isNextDay ?? false,
      useGlobalThreshold: dto.useGlobalThreshold ?? true,
      isActive: dto.isActive ?? true,
    };
    try {
      return await this.prisma.shift.create({ data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2001, message: '班次名称已存在' });
      }
      throw e;
    }
  }

  async list() {
    const list = await this.prisma.shift.findMany({
      orderBy: { id: 'asc' },
      include: { department: { select: { id: true, name: true } } },
    });
    return { list, total: list.length };
  }

  async update(id: number, dto: ShiftUpdateDto) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException({ code: 2001, message: '班次不存在' });
    }

    const startTime = dto.startTime ?? shift.startTime;
    const endTime = dto.endTime ?? shift.endTime;
    const isNextDay = dto.isNextDay ?? shift.isNextDay;

    if (!isNextDay && endTime <= startTime) {
      throw new UnprocessableEntityException({ code: 2001, message: '班次结束时间必须晚于开始时间（或标记跨天）' });
    }

    // 只传递显式提供的字段
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if (dto[key as keyof ShiftUpdateDto] !== undefined) {
        data[key] = dto[key as keyof ShiftUpdateDto];
      }
    }

    try {
      return await this.prisma.shift.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2001, message: '班次名称已存在' });
      }
      throw e;
    }
  }

  async remove(id: number) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new NotFoundException({ code: 2001, message: '班次不存在' });
    }
    const used = await this.prisma.schedule.count({ where: { shiftId: id }, take: 1 });
    if (used > 0) {
      throw new BadRequestException({ code: 2001, message: '该班次已被排班使用，无法删除' });
    }
    await this.prisma.shift.delete({ where: { id } });
    return { success: true };
  }
}
