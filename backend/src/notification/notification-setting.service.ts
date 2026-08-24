import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

// 可选推送目标（伪角色）：存储的规范 token → 展示标签
// 对齐参考 NotificationSettings 的『业务发起人/部门主管/审批流待办人/任务指派受众』
const PSEUDO_ROLES: Array<{ value: string; label: string }> = [
  { value: '申请人', label: '业务发起人 (本人)' },
  { value: '部门主管', label: '其所属部门主管' },
  { value: 'next_approver', label: '审批流下一环节待办人' },
  { value: 'task_audience', label: '任务指派受众' },
];
// 已被伪角色覆盖、不应再作为系统角色重复展示的角色名
const PSEUDO_COVERED = new Set(['申请人', '考生', '部门主管']);

export interface NotificationSettingDto {
  eventType: string;
  targetRoles: string[];
}

export interface TargetRoleOption {
  value: string;
  label: string;
}

@Injectable()
export class NotificationSettingService {
  private readonly logger = new Logger(NotificationSettingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 读取全部事件的通知设置（targetRoles 为 Json → 字符串数组）
  async list(): Promise<NotificationSettingDto[]> {
    const settings = await this.prisma.notificationSetting.findMany({
      orderBy: { id: 'asc' },
    });
    return settings.map((s) => ({
      eventType: s.eventType,
      targetRoles: this.normalizeRoles(s.targetRoles),
    }));
  }

  // 新建/更新某事件的目标角色（upsert）
  async setTargetRoles(eventType: string, targetRoles: string[]) {
    if (!Array.isArray(targetRoles)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '目标角色必须是数组' });
    }
    const roles: string[] = targetRoles.filter((r) => typeof r === 'string');
    return this.prisma.notificationSetting.upsert({
      where: { eventType },
      update: { targetRoles: roles },
      create: { eventType, targetRoles: roles },
    });
  }

  // 可选的推送目标：伪角色 + 数据库真实角色（去重伪角色覆盖名）
  async listRoles(): Promise<TargetRoleOption[]> {
    const dbRoles = await this.prisma.role.findMany({
      select: { name: true },
      orderBy: { id: 'asc' },
    });
    const systemRoles = dbRoles
      .filter((r) => !PSEUDO_COVERED.has(r.name))
      .map((r) => ({ value: r.name, label: r.name }));
    return [...PSEUDO_ROLES, ...systemRoles];
  }

  private normalizeRoles(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((r): r is string => typeof r === 'string');
  }
}