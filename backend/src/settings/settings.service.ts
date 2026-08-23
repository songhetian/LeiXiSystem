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

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.systemSetting.findUnique({ where: { key } });

      const result = await tx.systemSetting.upsert({
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

      const oldValue = existing?.value;
      const newValue = input.value;

      if (oldValue !== newValue) {
        await tx.systemSettingHistory.create({
          data: {
            settingKey: key,
            oldValue,
            newValue,
            changedBy: updatedBy,
          },
        });
      }

      return result;
    });
  }

  async bulkUpsert(items: Array<{ key: string } & UpsertInput>, updatedBy?: number) {
    return this.prisma.$transaction(async (tx) => {
      // 一次性批量预读现有值，避免在循环内逐条 findUnique（消除 N+1 读）
      const keys = items.map((it) => it.key);
      const existingRows = await tx.systemSetting.findMany({
        where: { key: { in: keys } },
      });
      const existingMap = new Map(existingRows.map((r) => [r.key, r.value]));

      const results = [];
      for (const it of items) {
        const oldValue = existingMap.get(it.key);
        const group = it.group ?? 'general';

        const result = await tx.systemSetting.upsert({
          where: { key: it.key },
          update: {
            value: it.value,
            label: it.label,
            description: it.description,
            updatedBy,
          },
          create: {
            key: it.key,
            value: it.value,
            label: it.label,
            description: it.description,
            group,
            updatedBy,
          },
        });

        const newValue = it.value;

        if (oldValue !== newValue) {
          await tx.systemSettingHistory.create({
            data: {
              settingKey: it.key,
              oldValue: oldValue ?? null,
              newValue,
              changedBy: updatedBy,
            },
          });
        }

        results.push(result);
      }
      return results;
    });
  }

  async remove(key: string) {
    await this.prisma.systemSetting.delete({ where: { key } });
  }

  async getHistory(key?: string) {
    const where = key ? { settingKey: key } : {};
    return this.prisma.systemSettingHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
    });
  }
}
