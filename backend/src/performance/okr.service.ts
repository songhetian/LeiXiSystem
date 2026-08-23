import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async listObjectives(ownerId?: number, type?: string) {
    const where: any = {};
    if (ownerId !== undefined) where.ownerId = ownerId;
    if (type !== undefined) where.type = type;
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
      throw new NotFoundException({ code: 2001, message: 'OKR 目标不存在' });
    }
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto) as (keyof OkrObjectiveUpdateDto)[]) {
      if (dto[key] !== undefined) {
        data[key] = dto[key];
      }
    }
    // 未显式传 progress 时，基于关键结果平均进度重算
    if (data.progress === undefined) {
      data.progress = await this.recalcObjectiveProgress(id);
    }
    if (Object.keys(data).length === 0) {
      return objective;
    }
    return this.prisma.okrObjective.update({ where: { id }, data });
  }

  async removeObjective(id: number) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id } });
    if (!objective) {
      throw new NotFoundException({ code: 2001, message: 'OKR 目标不存在' });
    }
    await this.prisma.okrObjective.delete({ where: { id } });
    return { success: true };
  }

  // ===== OKR 关键结果 =====

  async createKeyResult(dto: OkrKeyResultCreateDto) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id: dto.objectiveId } });
    if (!objective) {
      throw new BadRequestException({ code: 2001, message: 'OKR 目标不存在' });
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

  async listKeyResults(objectiveId: number) {
    const objective = await this.prisma.okrObjective.findUnique({ where: { id: objectiveId } });
    if (!objective) {
      throw new NotFoundException({ code: 2001, message: 'OKR 目标不存在' });
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
      throw new NotFoundException({ code: 2001, message: '关键结果不存在' });
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

  // 重算目标整体进度 = 关键结果进度的平均值
  private async recalcObjectiveProgress(objectiveId: number): Promise<number> {
    const krs = await this.prisma.okrKeyResult.findMany({ where: { objectiveId }, select: { progress: true } });
    if (krs.length === 0) {
      return 0;
    }
    const sum = krs.reduce((acc, k) => acc + k.progress, 0);
    const progress = Math.round(sum / krs.length);
    await this.prisma.okrObjective.update({ where: { id: objectiveId }, data: { progress } });
    return progress;
  }
}