import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService, DataScope } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  // ===== 绩效周期 =====

  async createCycle(dto: PerformanceCycleCreateDto) {
    // 校验结束日期不能早于开始日期
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_DATE_INVALID,
        message: '周期结束日期必须晚于或等于开始日期',
      });
    }
    const status = dto.status ?? 'draft';
    try {
      return await this.prisma.performanceCycle.create({
        data: { ...dto, status: status as CycleStatus },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException({
          code: ERROR_CODES.PERFORMANCE_CYCLE_NAME_EXISTS,
          message: '绩效周期名称已存在',
        });
      }
      throw e;
    }
  }

  // 绩效周期是公司级时间周期，无部门维度，故不做数据隔离
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
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_NOT_FOUND,
        message: '绩效周期不存在',
      });
    }
    // 状态切换校验：仅允许 draft/active/closed 三种状态
    if (dto.status !== undefined && !CYCLE_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_STATUS_INVALID,
        message: '非法状态，仅支持 draft/active/closed',
      });
    }
    // 日期先后校验：库中 startDate/endDate 是 @db.Date（Prisma 返回 Date，
    // UTC 午夜），DTO 是 'YYYY-MM-DD' 字符串。混比（Date < string）恒为 false，
    // 因此必须先统一归一化为日期字符串再比较。
    const startDate = this.toDateString(dto.startDate ?? cycle.startDate);
    const endDate = this.toDateString(dto.endDate ?? cycle.endDate);
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_DATE_INVALID,
        message: '周期结束日期必须晚于或等于开始日期',
      });
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

  /**
   * 归一化为 'YYYY-MM-DD'：@db.Date 列由 Prisma 返回 UTC 午夜的 Date，
   * 用 toISOString 取日期部分与时区无关；DTO 直接截取前 10 位。
   */
  private toDateString(value: string | Date | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  async removeCycle(id: number) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_NOT_FOUND,
        message: '绩效周期不存在',
      });
    }
    // 已激活或已关闭的周期不允许删除
    if (cycle.status !== 'draft') {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_NOT_DELETED,
        message: '仅草稿状态的绩效周期可删除',
      });
    }
    await this.prisma.performanceCycle.delete({ where: { id } });
    return { success: true };
  }

  // ===== 绩效目标 =====

  async createGoal(dto: PerformanceGoalCreateDto) {
    // 校验周期存在
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } });
    if (!cycle) {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_NOT_FOUND,
        message: '绩效周期不存在',
      });
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

  // ADR-0010：绩效目标按员工具备部门归属隔离
  //   all    → 全量
  //   部门范围 → 本部门及子部门员工的目标
  //   仅本人  → employeeId = 本人（显式查询他人直接返回空集，不查库）
  async listGoals(userId: number, cycleId?: number, employeeId?: number) {
    const where: any = {};
    if (cycleId !== undefined) where.cycleId = cycleId;
    if (employeeId !== undefined) where.employeeId = employeeId;

    const scope = await this.dataScope.visibleScope(userId);
    if (!scope.all) {
      if (scope.selfEmployeeId !== undefined) {
        if (employeeId !== undefined && employeeId !== scope.selfEmployeeId) {
          return { list: [], total: 0 };
        }
        where.employeeId = scope.selfEmployeeId;
      } else if (scope.ids.length > 0) {
        where.employeeId = { in: await this.scopedEmployeeIds(scope, employeeId) };
      } else {
        return { list: [], total: 0 };
      }
    }

    const list = await this.prisma.performanceGoal.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async updateGoal(id: number, dto: PerformanceGoalUpdateDto) {
    const goal = await this.prisma.performanceGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_GOAL_NOT_FOUND,
        message: '绩效目标不存在',
      });
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
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_GOAL_NOT_FOUND,
        message: '绩效目标不存在',
      });
    }
    await this.prisma.performanceGoal.delete({ where: { id } });
    return { success: true };
  }

  // ===== 绩效评估 =====

  async createReview(dto: PerformanceReviewCreateDto) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } });
    if (!cycle) {
      throw new BadRequestException({
        code: ERROR_CODES.PERFORMANCE_CYCLE_NOT_FOUND,
        message: '绩效周期不存在',
      });
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

  // ADR-0010：绩效评估与目标同构，按被评估员工的部门归属隔离
  async listReviews(userId: number, cycleId?: number, employeeId?: number) {
    const where: any = {};
    if (cycleId !== undefined) where.cycleId = cycleId;
    if (employeeId !== undefined) where.employeeId = employeeId;

    const scope = await this.dataScope.visibleScope(userId);
    if (!scope.all) {
      if (scope.selfEmployeeId !== undefined) {
        if (employeeId !== undefined && employeeId !== scope.selfEmployeeId) {
          return { list: [], total: 0 };
        }
        where.employeeId = scope.selfEmployeeId;
      } else if (scope.ids.length > 0) {
        where.employeeId = { in: await this.scopedEmployeeIds(scope, employeeId) };
      } else {
        return { list: [], total: 0 };
      }
    }

    const list = await this.prisma.performanceReview.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async updateReview(id: number, dto: PerformanceReviewUpdateDto) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_REVIEW_NOT_FOUND,
        message: '绩效评估不存在',
      });
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
      throw new NotFoundException({
        code: ERROR_CODES.PERFORMANCE_REVIEW_NOT_FOUND,
        message: '绩效评估不存在',
      });
    }
    await this.prisma.performanceReview.delete({ where: { id } });
    return { success: true };
  }

  /**
   * ADR-0010：把「可见部门范围」收敛为员工 id 集合。
   * performance_goals / performance_reviews 只存 employeeId、没有 employee 关系字段，
   * 因此不能写 where.employee = { departmentId: { in: ids } }（非法 Prisma 参数 → 500）。
   * 显式传入的 employeeId 也会与范围求交集，避免越出可见部门。
   */
  private async scopedEmployeeIds(scope: DataScope, employeeId?: number): Promise<number[]> {
    const employees = await this.prisma.employee.findMany({
      where: { departmentId: { in: scope.ids } },
      select: { id: true },
    });
    return employees.map((e) => e.id).filter((id) => employeeId === undefined || id === employeeId);
  }
}