import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

export interface UpsertInput {
  value: string;
  label?: string;
  description?: string;
  group?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(group?: string) {
    const where = group ? { group } : {};
    return this.prisma.systemSetting.findMany({ where, orderBy: { key: 'asc' } });
  }

  async get(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException({ code: ERROR_CODES.SETTING_NOT_FOUND, message: '设置项不存在' });
    }
    return setting;
  }

  async upsert(key: string, input: UpsertInput, updatedBy?: number) {
    const group = input.group ?? 'general';
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: input.value,
        label: input.label,
        description: input.description,
        updatedBy,
      },
      create: {
        key,
        value: input.value,
        label: input.label,
        description: input.description,
        group,
        updatedBy,
      },
    });
  }

  async bulkUpsert(items: Array<{ key: string } & UpsertInput>, updatedBy?: number) {
    return Promise.all(items.map((it) => this.upsert(it.key, it, updatedBy)));
  }

  async remove(key: string) {
    await this.prisma.systemSetting.delete({ where: { key } });
  }
}
