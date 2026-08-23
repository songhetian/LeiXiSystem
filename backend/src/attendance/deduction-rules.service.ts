import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 扣款规则字段类型（对齐 DeductionRule 模型）
export interface DeductionRuleCreateDto {
  name: string;
  type: string;
  method: string;
  amount?: number | null;
  percentage?: number | null;
  multiplier?: number | null;
  leaveType?: string | null;
  enabled?: boolean;
  description?: string;
}

export interface DeductionRuleUpdateDto extends Partial<DeductionRuleCreateDto> {}

// 扣款规则服务
@Injectable()
export class DeductionRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: DeductionRuleCreateDto) {
    const data: any = {
      ...dto,
      enabled: dto.enabled ?? true,
    };
    try {
      return await this.prisma.deductionRule.create({ data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException({ code: 2001, message: '存在重名或冲突的扣款规则' });
      }
      throw e;
    }
  }

  async list() {
    const list = await this.prisma.deductionRule.findMany({
      orderBy: { id: 'asc' },
    });
    return { list, total: list.length };
  }

  async update(id: number, dto: DeductionRuleUpdateDto) {
    const rule = await this.prisma.deductionRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException({ code: 2001, message: '扣款规则不存在' });
    }
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if ((dto as any)[key] !== undefined) {
        data[key] = (dto as any)[key];
      }
    }
    try {
      return await this.prisma.deductionRule.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException({ code: 2001, message: '存在重名或冲突的扣款规则' });
      }
      throw e;
    }
  }

  async remove(id: number) {
    const rule = await this.prisma.deductionRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException({ code: 2001, message: '扣款规则不存在' });
    }
    await this.prisma.deductionRule.delete({ where: { id } });
    return { success: true };
  }
}