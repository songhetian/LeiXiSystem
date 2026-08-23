import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '@prisma/client';

// 绩效周期状态类型
type CycleStatus = $Enums.PerformanceCycleStatus;
const CYCLE_STATUSES: CycleStatus[] = ['draft', 'active', 'closed'];

// 绩效周期创建 DTO
export interface PerformanceCycleCreateDto {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  selfReviewDeadline?: string;
  managerReviewDeadline?: string;
  calibrationDeadline?: string;
  status?: CycleStatus;
}

export interface PerformanceCycleUpdateDto extends Partial<PerformanceCycleCreateDto> {}

// 绩效目标创建 DTO
export interface PerformanceGoalCreateDto {
  cycleId: number;
  employeeId: number;
  title: string;
  description?: string;
  weight?: number;
  targetValue?: string;
  actualValue?: string;
  progress?: number;
  status?: string;
  dueDate?: string;
}

export interface PerformanceGoalUpdateDto extends Partial<Omit<PerformanceGoalCreateDto, 'cycleId' | 'employeeId'>> {}

// 绩效评估创建 DTO
export interface PerformanceReviewCreateDto {
  cycleId: number;
  employeeId: number;
  reviewerId?: number | null;
  status?: string;
}

export interface PerformanceReviewUpdateDto extends Partial<PerformanceReviewCreateDto> {
  selfScore?: number;
  managerScore?: number;
  finalScore?: number;
  rating?: string;
  selfComment?: string;
  managerComment?: string;
  comment?: string;
  developmentPlan?: string;
  promotionRecommendation?: boolean;
}

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== 绩效周期 =====

  async createCycle(dto: PerformanceCycleCreateDto) {
    // 校验结束日期不能早于开始日期
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({ code: 2001, message: '周期结束日期必须晚于或等于开始日期' });
    }
    const status = dto.status ?? 'draft';
    try {
      return await this.prisma.performanceCycle.create({
        data: { ...dto, status: status as CycleStatus },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException({ code: 2001, message: '绩效周期名称已存在' });
      }
      throw e;
    }
  }

  async listCycles() {
    const list = await this.prisma.performanceCycle.findMany({
      orderBy: { id: 'asc' },
      // 关联目标与评估，返回数量统计
      include: {
        _count: { select: { goals: true, reviews: true } },
      },
    });
    return { list, total: list.length };
  }

  async updateCycle(id: number, dto: PerformanceCycleUpdateDto) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new NotFoundException({ code: 2001, message: '绩效周期不存在' });
    }
    // 状态切换校验：仅允许 draft/active/closed 三种状态
    if (dto.status !== undefined && !CYCLE_STATUSES.includes(dto.status)) {
      throw new BadRequestException({ code: 2001, message: '非法状态，仅支持 draft/active/closed' });
    }
    // 日期先后校验
    const startDate = dto.startDate ?? cycle.startDate;
    const endDate = dto.endDate ?? cycle.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException({ code: 2001, message: '周期结束日期必须晚于或等于开始日期' });
    }
    // 仅更新显式提供的字段
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof PerformanceCycleUpdateDto)[]) {
      if (dto[key] !== undefined) {
        data[key] = dto[key];
      }
    }
    if (data.status) {
      data.status = data.status as CycleStatus;
    }
    if (Object.keys(data).length === 0) {
      return cycle;
    }
    return this.prisma.performanceCycle.update({ where: { id }, data });
  }

  async removeCycle(id: number) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new NotFoundException({ code: 2001, message: '绩效周期不存在' });
    }
    // 已激活或已关闭的周期不允许删除
    if (cycle.status !== 'draft') {
      throw new BadRequestException({ code: 2001, message: '仅草稿状态的绩效周期可删除' });
    }
    await this.prisma.performanceCycle.delete({ where: { id } });
    return { success: true };
  }

  // ===== 绩效目标 =====

  async createGoal(dto: PerformanceGoalCreateDto) {
    // 校验周期存在
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } });
    if (!cycle) {
      throw new BadRequestException({ code: 2001, message: '绩效周期不存在' });
    }
    return this.prisma.performanceGoal.create({
      data: {
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        title: dto.title,
        description: dto.description,
        weight: dto.weight ?? 0,
        targetValue: dto.targetValue,
        actualValue: dto.actualValue,
        progress: dto.progress ?? 0,
        status: dto.status ?? 'pending',
        dueDate: dto.dueDate,
      },
    });
  }

  async listGoals(cycleId?: number, employeeId?: number) {
    const where: any = {};
    if (cycleId !== undefined) where.cycleId = cycleId;
    if (employeeId !== undefined) where.employeeId = employeeId;
    const list = await this.prisma.performanceGoal.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async updateGoal(id: number, dto: PerformanceGoalUpdateDto) {
    const goal = await this.prisma.performanceGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException({ code: 2001, message: '绩效目标不存在' });
    }
    // 仅更新显式提供的字段
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof PerformanceGoalUpdateDto)[]) {
      if (dto[key] !== undefined) {
        data[key] = dto[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return goal;
    }
    return this.prisma.performanceGoal.update({ where: { id }, data });
  }

  async removeGoal(id: number) {
    const goal = await this.prisma.performanceGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException({ code: 2001, message: '绩效目标不存在' });
    }
    await this.prisma.performanceGoal.delete({ where: { id } });
    return { success: true };
  }

  // ===== 绩效评估 =====

  async createReview(dto: PerformanceReviewCreateDto) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } });
    if (!cycle) {
      throw new BadRequestException({ code: 2001, message: '绩效周期不存在' });
    }
    return this.prisma.performanceReview.create({
      data: {
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        reviewerId: dto.reviewerId ?? null,
        status: dto.status ?? 'pending',
      },
    });
  }

  async listReviews(cycleId?: number, employeeId?: number) {
    const where: any = {};
    if (cycleId !== undefined) where.cycleId = cycleId;
    if (employeeId !== undefined) where.employeeId = employeeId;
    const list = await this.prisma.performanceReview.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async updateReview(id: number, dto: PerformanceReviewUpdateDto) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({ code: 2001, message: '绩效评估不存在' });
    }
    const { comment, ...rest } = dto;
    // 通用 comment 映射到 managerComment
    const data: Record<string, any> = { ...rest };
    if (comment !== undefined) {
      data.managerComment = comment;
    }
    // 仅保留显式提供的字段
    for (const key of Object.keys(data) as string[]) {
      if (data[key] === undefined) {
        delete data[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return review;
    }
    return this.prisma.performanceReview.update({ where: { id }, data });
  }

  async removeReview(id: number) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({ code: 2001, message: '绩效评估不存在' });
    }
    await this.prisma.performanceReview.delete({ where: { id } });
    return { success: true };
  }
}