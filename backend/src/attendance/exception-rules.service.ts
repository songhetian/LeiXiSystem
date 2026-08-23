import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ===== 异常规则（exception-rules） =====
export interface ExceptionRuleCreateDto {
  name: string;
  type: string;
  description?: string;
  departmentId?: number | null;
  threshold?: number;
  thresholdMax?: number | null;
  autoResolve?: boolean;
  autoResolveType?: string | null;
  deductMinutes?: number;
  status?: string;
  sortOrder?: number;
}

export interface ExceptionRuleUpdateDto extends Partial<ExceptionRuleCreateDto> {}

// ===== 异常记录（exceptions） =====
export interface ExceptionCreateDto {
  employeeId: number;
  workDate: string | Date;
  type: string;
  description?: string;
  deductMinutes?: number;
  resolveType?: string;
}

export interface ExceptionListQuery {
  status?: string;
  type?: string;
  employeeId?: number;
  workDate?: string;
}

export interface ExceptionHandleDto {
  status: string;
  remark?: string;
  handledBy?: number;
}

// 异常规则与异常记录服务
@Injectable()
export class ExceptionRulesService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= 异常规则 CRUD =================

  private validateRule(dto: ExceptionRuleCreateDto, isUpdate = false) {
    const threshold = dto.threshold ?? (isUpdate ? undefined : 0);
    const thresholdMax = dto.thresholdMax ?? undefined;
    // 阈值下限不能超过上限（两者都填时校验）
    if (threshold !== undefined && thresholdMax !== undefined && threshold > thresholdMax) {
      throw new BadRequestException({ code: 2001, message: '阈值（threshold）不能大于阈值上限（thresholdMax）' });
    }
    // 扣款分钟数不能为负
    if (dto.deductMinutes !== undefined && dto.deductMinutes < 0) {
      throw new BadRequestException({ code: 2001, message: '扣款分钟数不能为负数' });
    }
  }

  async createRule(dto: ExceptionRuleCreateDto) {
    this.validateRule(dto);
    const data = {
      ...dto,
      threshold: dto.threshold ?? 0,
      autoResolve: dto.autoResolve ?? false,
      deductMinutes: dto.deductMinutes ?? 0,
      status: dto.status ?? 'enabled',
      sortOrder: dto.sortOrder ?? 0,
    } as any;
    try {
      return await this.prisma.attendanceExceptionRule.create({ data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException({ code: 2001, message: '存在重名或冲突的异常规则' });
      }
      throw e;
    }
  }

  async listRules() {
    const list = await this.prisma.attendanceExceptionRule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return { list, total: list.length };
  }

  async updateRule(id: number, dto: ExceptionRuleUpdateDto) {
    const rule = await this.prisma.attendanceExceptionRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException({ code: 2001, message: '异常规则不存在' });
    }
    // 合并已有值后做阈值校验
    const merged = { ...rule, ...dto } as ExceptionRuleCreateDto;
    this.validateRule(merged, true);
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if ((dto as any)[key] !== undefined) {
        data[key] = (dto as any)[key];
      }
    }
    return await this.prisma.attendanceExceptionRule.update({ where: { id }, data });
  }

  // 启停：status 在 enabled / disabled 之间切换
  async toggleRule(id: number) {
    const rule = await this.prisma.attendanceExceptionRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException({ code: 2001, message: '异常规则不存在' });
    }
    const nextStatus = rule.status === 'enabled' ? 'disabled' : 'enabled';
    return await this.prisma.attendanceExceptionRule.update({
      where: { id },
      data: { status: nextStatus },
    });
  }

  async removeRule(id: number) {
    const rule = await this.prisma.attendanceExceptionRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException({ code: 2001, message: '异常规则不存在' });
    }
    await this.prisma.attendanceExceptionRule.delete({ where: { id } });
    return { success: true };
  }

  // ================= 异常记录 =================

  async listExceptions(query: ExceptionListQuery) {
    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.employeeId) where.employeeId = Number(query.employeeId);
    if (query.workDate) where.workDate = new Date(query.workDate as string);

    const list = await this.prisma.attendanceException.findMany({
      where,
      orderBy: { workDate: 'desc' },
    });
    return { list, total: list.length };
  }

  // 生成异常记录
  async createException(dto: ExceptionCreateDto) {
    if (dto.deductMinutes !== undefined && dto.deductMinutes < 0) {
      throw new BadRequestException({ code: 2001, message: '扣款分钟数不能为负数' });
    }
    const data: any = {
      employeeId: dto.employeeId,
      workDate: new Date(dto.workDate as string),
      type: dto.type,
      description: dto.description,
      deductMinutes: dto.deductMinutes,
      resolveType: dto.resolveType,
      status: 'pending',
    };
    return await this.prisma.attendanceException.create({ data });
  }

  // 处理（置为已解决等状态）
  async handleException(id: number, dto: ExceptionHandleDto) {
    const exception = await this.prisma.attendanceException.findUnique({ where: { id } });
    if (!exception) {
      throw new NotFoundException({ code: 2001, message: '异常记录不存在' });
    }
    const data: Record<string, any> = {
      status: dto.status,
      remark: dto.remark,
    };
    if (dto.handledBy !== undefined) data.handledBy = Number(dto.handledBy);
    // 记录处理时间
    data.handledAt = new Date();
    return await this.prisma.attendanceException.update({ where: { id }, data });
  }

  async removeException(id: number) {
    const exception = await this.prisma.attendanceException.findUnique({ where: { id } });
    if (!exception) {
      throw new NotFoundException({ code: 2001, message: '异常记录不存在' });
    }
    await this.prisma.attendanceException.delete({ where: { id } });
    return { success: true };
  }
}