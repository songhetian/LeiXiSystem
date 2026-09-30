import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';

/** 单个工龄规则段：minYears <= 工龄 < maxYears 时使用 days */
export interface SeniorityRuleItem {
  minYears?: number;
  maxYears?: number;
  days: number;
}

export type SeniorityRule = SeniorityRuleItem[];

/** 月假额度：12 个元素，依次对应 1~12 月的每日额度（单位天） */
export type MonthlyDays = number[];

export interface VacationTypeInput {
  code: string;
  name: string;
  baseDays?: number;
  /** 有薪假不取消全勤奖；无薪假取消。缺省 false（保守：按无薪处理，避免多发） */
  isPaid?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  carryOverRatio?: number | null;
  carryOverMaxDays?: number | null;
  seniorityRule?: SeniorityRule | null;
  monthlyDays?: MonthlyDays | null;
}

/**
 * 假期类型管理（VacationType 表 CRUD）。
 *
 * 与现有业务的分工：
 *   - 本服务负责「类型」本身的配置（code/name/baseDays/seniorityRule/结转参数）；
 *   - vacation.service 的 calculateAnnualLeaveDays / carryOverBalances 等计算逻辑
 *     直接读取这些配置字段，无需改动。
 */
@Injectable()
export class VacationTypeService {
  constructor(private readonly prisma: PrismaService) {}

  /** 列表：按 sortOrder、id 升序，保证在 vacation.service 中同样按此序展示 */
  async list() {
    return this.prisma.vacationType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(input: VacationTypeInput) {
    this.validateSeniorityRule(input.seniorityRule);
    this.validateMonthlyDays(input.monthlyDays);
    return this.prisma.vacationType.create({
      data: this.toCreateData(input),
    });
  }

  async update(id: number, input: Partial<VacationTypeInput>) {
    const existing = await this.prisma.vacationType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.VACATION_TYPE_NOT_FOUND, message: '假期类型不存在' });
    }
    this.validateSeniorityRule(input.seniorityRule);
    this.validateMonthlyDays(input.monthlyDays);
    return this.prisma.vacationType.update({
      where: { id },
      data: this.toUpdateData(input),
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.vacationType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.VACATION_TYPE_NOT_FOUND, message: '假期类型不存在' });
    }
    // 已有余额引用时禁止删除，避免级联清空员工休假额度
    const refCount = await this.prisma.vacationBalance.count({
      where: { vacationTypeId: id },
    });
    if (refCount > 0) {
      throw new ConflictException({
        code: ERROR_CODES.VACATION_TYPE_IN_USE,
        message: `该假期类型已被 ${refCount} 条休假额度引用，请先处理相关余额后再删除`,
      });
    }
    // 请假记录对假期类型的外键为 Restrict（无级联），若此处放行，数据库会抛 P2003
    // 导致 500；必须提前拦成可读的 409，提示用户历史记录仍需保留该类型。
    const leaveCount = await this.prisma.leaveRecord.count({
      where: { vacationTypeId: id },
    });
    if (leaveCount > 0) {
      throw new ConflictException({
        code: ERROR_CODES.VACATION_TYPE_IN_USE,
        message: `该假期类型已被 ${leaveCount} 条请假记录引用，请先处理相关记录后再删除`,
      });
    }
    return this.prisma.vacationType.delete({ where: { id } });
  }

  /**
   * 校验工龄分段规则：必须是数组，每段须含 days。
   * 允许 undefined / null（视为无分段，回退 baseDays）。
   */
  validateSeniorityRule(rule?: SeniorityRule | null | unknown) {
    if (rule === undefined || rule === null) return;
    if (!Array.isArray(rule)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '工龄规则必须为数组' });
    }
    for (const item of rule as SeniorityRuleItem[]) {
      if (item === null || typeof item !== 'object' || typeof item.days !== 'number') {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '工龄规则的每一段都必须包含 days' });
      }
    }
  }

  /**
   * 校验月假额度：必须是长度 12 的数字数组（每项 >= 0），对应 1~12 月每日额度。
   * 允许 undefined / null（视为非月假类型，按年额度计算）。
   */
  validateMonthlyDays(days?: MonthlyDays | null | unknown) {
    if (days === undefined || days === null) return;
    if (!Array.isArray(days)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '月假额度必须为数组' });
    }
    if (days.length !== 12) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '月假额度必须包含 12 个月的天数' });
    }
    for (const day of days as unknown[]) {
      if (typeof day !== 'number' || !Number.isFinite(day) || day < 0) {
        throw new BadRequestException({
          code: ERROR_CODES.PARAM_INVALID,
          message: '月假额度的每个月必须为非负数字',
        });
      }
    }
  }

  /** 仅保留可写字段，seniorityRule 需按 Json 类型注入 */
  private toCreateData(input: VacationTypeInput): Prisma.VacationTypeCreateInput {
    return {
      code: input.code,
      name: input.name,
      baseDays: input.baseDays !== undefined ? new Prisma.Decimal(input.baseDays) : new Prisma.Decimal(0),
      isPaid: input.isPaid ?? false,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 999,
      ...(input.carryOverRatio !== undefined ? { carryOverRatio: input.carryOverRatio } : {}),
      ...(input.carryOverMaxDays !== undefined
        ? { carryOverMaxDays: input.carryOverMaxDays }
        : {}),
      ...(input.seniorityRule !== undefined && input.seniorityRule !== null
        ? { seniorityRule: input.seniorityRule as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.monthlyDays !== undefined && input.monthlyDays !== null
        ? { monthlyDays: input.monthlyDays as unknown as Prisma.InputJsonValue }
        : {}),
    };
  }

  private toUpdateData(input: Partial<VacationTypeInput>): Prisma.VacationTypeUpdateInput {
    const data: Prisma.VacationTypeUpdateInput = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.baseDays !== undefined) data.baseDays = new Prisma.Decimal(input.baseDays);
    if (input.isPaid !== undefined) data.isPaid = input.isPaid;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.carryOverRatio !== undefined) data.carryOverRatio = input.carryOverRatio;
    if (input.carryOverMaxDays !== undefined) data.carryOverMaxDays = input.carryOverMaxDays;
    if (input.seniorityRule !== undefined) data.seniorityRule = input.seniorityRule as unknown as Prisma.InputJsonValue;
    if (input.monthlyDays !== undefined) {
      data.monthlyDays = (input.monthlyDays ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue;
    }
    return data;
  }
}