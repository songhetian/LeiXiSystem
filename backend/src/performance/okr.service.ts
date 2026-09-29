import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';

// OKR 目标创建 DTO
export interface OkrObjectiveCreateDto {
  title: string;
  type?: string;
  period: string;
  ownerId?: number | null;
  departmentId?: number | null;
  progress?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface OkrObjectiveUpdateDto extends Partial<OkrObjectiveCreateDto> {}

// OKR 关键结果创建 DTO
export interface OkrKeyResultCreateDto {
  objectiveId: number;
  title: string;
  initialValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  progress?: number;
}

export interface OkrKeyResultUpdateDto extends Partial<Omit<OkrKeyResultCreateDto, 'objectiveId'>> {}

@Injectable()
export class OkrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  // ===== OKR 目标 =====

  async createObjective(dto: OkrObjectiveCreateDto) {
    return this.prisma.okrObjective.create({
      data: {
        title: dto.title,
        type: dto.type ?? 'personal',
        period: dto.period,
        ownerId: dto.ownerId ?? null,
        departmentId: dto.departmentId ?? null,
        progress: dto.progress ?? 0,
        status: dto.status ?? 'active',
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
  }

  // ADR-0010：OKR 目标隔离
  //   all    → 全量
  //   部门范围 → 本部门及子部门的部门级 OKR（departmentId in 可见部门）
  //   仅本人  → ownerId = 本人（显式查询他人直接返回空集，不查库）
  async listObjectives(userId: number, ownerId?: number, type?: string) {
    const where: any = {};
    if (ownerId !== undefined) where.ownerId = ownerId;
    if (type !== undefined) where.type = type;

    const scope = await this.dataScope.visibleScope(userId);
    if (!scope.all) {
      if (scope.selfEmployeeId !== undefined) {
        if (ownerId !== undefined && ownerId !== scope.selfEmployeeId) {
          return { list: [], total: 0 };
        }
        where.ownerId = scope.selfEmployeeId;
      } else if (scope.ids.length > 0) {
        where.departmentId = { in: scope.ids };
      } else {
        return { list: [], total: 0 };
      }
    }

    const list = await this.prisma.okrObjective.findMany({
      where,
      orderBy: { id: 'asc' },
      include: { keyResults: { orderBy: { id: 'asc' } } },
    });
    return { list, total: list.length };
  }

  async updateObjective(id: number, dto: OkrObjectiveUpdateDto) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id } });
    if (!objective) {
      throw new NotFoundException({
        code: ERROR_CODES.OKR_OBJECTIVE_NOT_FOUND,
        message: 'OKR 目标不存在',
      });
    }
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof OkrObjectiveUpdateDto)[]) {
      if (dto[key] !== undefined) {
        data[key] = dto[key];
      }
    }
    // 未显式传 progress 时，基于关键结果平均进度重算；
    // 目标下没有 KR 时重算结果为 null（进度只能来自手工填写），此时不得覆盖原值。
    if (data.progress === undefined) {
      const recalculated = await this.recalcObjectiveProgress(id);
      if (recalculated !== null) {
        data.progress = recalculated;
      }
    }
    if (Object.keys(data).length === 0) {
      return objective;
    }
    return this.prisma.okrObjective.update({ where: { id }, data });
  }

  async removeObjective(id: number) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id } });
    if (!objective) {
      throw new NotFoundException({
        code: ERROR_CODES.OKR_OBJECTIVE_NOT_FOUND,
        message: 'OKR 目标不存在',
      });
    }
    await this.prisma.okrObjective.delete({ where: { id } });
    return { success: true };
  }

  // ===== OKR 关键结果 =====

  async createKeyResult(dto: OkrKeyResultCreateDto) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id: dto.objectiveId } });
    if (!objective) {
      throw new BadRequestException({
        code: ERROR_CODES.OKR_OBJECTIVE_NOT_FOUND,
        message: 'OKR 目标不存在',
      });
    }
    const initialValue = dto.initialValue ?? 0;
    const targetValue = dto.targetValue ?? 0;
    const currentValue = dto.currentValue ?? 0;
    const kr = await this.prisma.okrKeyResult.create({
      data: {
        objectiveId: dto.objectiveId,
        title: dto.title,
        initialValue,
        targetValue,
        currentValue,
        unit: dto.unit ?? null,
        progress: dto.progress ?? this.calcProgress(initialValue, targetValue, currentValue),
      },
    });
    // 新增后重算目标整体进度
    await this.recalcObjectiveProgress(dto.objectiveId);
    return kr;
  }

  // ADR-0010：关键结果随其目标归属，目标不可见时按「不存在」处理，避免越权读取
  async listKeyResults(userId: number, objectiveId: number) {
    const objectiveWhere: any = { id: objectiveId };
    const scope = await this.dataScope.visibleScope(userId);
    if (!scope.all) {
      if (scope.selfEmployeeId !== undefined) {
        objectiveWhere.ownerId = scope.selfEmployeeId;
      } else if (scope.ids.length > 0) {
        objectiveWhere.departmentId = { in: scope.ids };
      } else {
        throw new NotFoundException({
          code: ERROR_CODES.OKR_OBJECTIVE_NOT_FOUND,
          message: 'OKR 目标不存在',
        });
      }
    }
    const objective = await this.prisma.okrObjective.findUnique({ where: objectiveWhere });
    if (!objective) {
      throw new NotFoundException({
        code: ERROR_CODES.OKR_OBJECTIVE_NOT_FOUND,
        message: 'OKR 目标不存在',
      });
    }
    const list = await this.prisma.okrKeyResult.findMany({
      where: { objectiveId },
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async updateKeyResult(id: number, dto: OkrKeyResultUpdateDto) {
    const kr = await this.prisma.okrKeyResult.findUnique({ where: { id } });
    if (!kr) {
      throw new NotFoundException({
        code: ERROR_CODES.OKR_KEY_RESULT_NOT_FOUND,
        message: '关键结果不存在',
      });
    }
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof OkrKeyResultUpdateDto)[]) {
      if (dto[key] !== undefined) {
        data[key] = dto[key];
      }
    }
    // 未显式传 progress 时，根据新值自动重算该条 KR 进度
    if (data.progress === undefined) {
      data.progress = this.calcProgress(
        dto.initialValue ?? kr.initialValue.toNumber(),
        dto.targetValue ?? kr.targetValue.toNumber(),
        dto.currentValue ?? kr.currentValue.toNumber(),
      );
    }
    const updated = await this.prisma.okrKeyResult.update({ where: { id }, data });
    // 更新后重算目标整体进度
    await this.recalcObjectiveProgress(updated.objectiveId);
    return updated;
  }

  // ===== 内部工具 =====

  // 计算单条关键结果进度百分比（0-100）
  private calcProgress(initialValue: number, targetValue: number, currentValue: number): number {
    const initial = Number(initialValue) || 0;
    const target = Number(targetValue) || 0;
    const current = Number(currentValue) || 0;
    let progress: number;
    if (target === initial) {
      progress = current > 0 ? 100 : 0;
    } else {
      progress = ((current - initial) / (target - initial)) * 100;
    }
    return Math.max(0, Math.min(100, Math.round(progress)));
  }

  // 重算目标整体进度 = 关键结果进度的平均值。
  // 目标下没有任何 KR 时返回 null 且不落库：该目标的进度只能来自手工填写，
  // 若返回 0 并写库，改一次标题就会把用户填的进度静默清零。
  private async recalcObjectiveProgress(objectiveId: number): Promise<number | null> {
    const krs = await this.prisma.okrKeyResult.findMany({ where: { objectiveId }, select: { progress: true } });
    if (krs.length === 0) {
      return null;
    }
    const sum = krs.reduce((acc, k) => acc + k.progress, 0);
    const progress = Math.round(sum / krs.length);
    await this.prisma.okrObjective.update({ where: { id: objectiveId }, data: { progress } });
    return progress;
  }
}