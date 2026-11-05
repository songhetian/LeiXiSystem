import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';

// 可选推送目标（伪角色）：存储的规范 token → 展示标签。
// 只服务于「非流程事件」（异常告警/资产领用）——这类事件没有审批流节点可勾选。
const PSEUDO_ROLES: Array<{ value: string; label: string }> = [
  { value: 'applicant', label: '业务发起人（本人）' },
  { value: 'dept_manager', label: '其所属部门主管' },
  { value: 'next_approver', label: '审批流下一环节待办人' },
  { value: 'task_audience', label: '任务指派受众' },
];
// 已被伪角色覆盖、不应再作为系统角色重复展示的角色名
const PSEUDO_COVERED = new Set(['申请人', '考生', '部门主管']);

/** 策略缓存时长：审批流转路径上每次节点切换都会读一次，60s 足够新且不打爆 DB */
const POLICY_TTL_MS = 60_000;

export interface NotificationSettingDto {
  eventType: string;
  /** null=未配置（按默认策略）；[]=显式关闭；[..]=指定收件方 */
  targetRoles: string[] | null;
  /** null=未配置（流程所有节点都通知）；[]=全部关闭；[..]=只通知这些节点 */
  targetNodes: string[] | null;
}

export interface NotificationPolicy {
  targetRoles: string[] | null;
  targetNodes: string[] | null;
}

export interface TargetRoleOption {
  value: string;
  label: string;
}

@Injectable()
export class NotificationSettingService {
  private readonly logger = new Logger(NotificationSettingService.name);
  private readonly policyCache = new Map<string, { value: NotificationPolicy; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  // 读取全部事件的通知设置（Json 列 → 字符串数组 / null）
  async list(): Promise<NotificationSettingDto[]> {
    const settings = await this.prisma.notificationSetting.findMany({
      orderBy: { id: 'asc' },
    });
    return settings.map((s) => ({
      eventType: s.eventType,
      targetRoles: this.normalizeNullable(s.targetRoles),
      targetNodes: this.normalizeNullable(s.targetNodes),
    }));
  }

  /**
   * 新建/更新某事件的通知策略。
   * 只更新传入的字段：前端「流程节点」页只提交 targetNodes，
   * 老的「非流程事件」页只提交 targetRoles，互不覆盖。
   */
  async setTargets(
    eventType: string,
    input: { targetRoles?: string[]; targetNodes?: string[] | null },
  ): Promise<NotificationSettingDto> {
    const event = (eventType ?? '').trim();
    if (!event) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '事件类型不能为空' });
    }

    // Prisma 的 JSON 列写 NULL 必须用 Prisma.DbNull，直接写 null 会被当成 JSON null
    // 或被类型系统拒绝（NullableJsonNullValueInput）。
    const data: { targetRoles?: string[]; targetNodes?: string[] | typeof Prisma.DbNull } = {};
    if (input?.targetRoles !== undefined) {
      data.targetRoles = this.requireStringArray(input.targetRoles, '目标角色');
    }
    if (input?.targetNodes !== undefined) {
      // null 是合法的「恢复默认（全通知）」指令，必须与「传了空数组（全关）」区分开：
      // 流程后续新增节点时，只有 NULL 才能让新节点默认继承通知。
      data.targetNodes =
        input.targetNodes === null
          ? Prisma.DbNull
          : this.requireStringArray(input.targetNodes, '通知节点');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: 'targetRoles 与 targetNodes 至少传一个',
      });
    }

    const saved = await this.prisma.notificationSetting.upsert({
      where: { eventType: event },
      update: data,
      create: {
        eventType: event,
        targetRoles: data.targetRoles ?? [],
        targetNodes: data.targetNodes ?? undefined,
      },
    });

    this.policyCache.delete(event);
    return {
      eventType: saved.eventType,
      targetRoles: this.normalizeNullable(saved.targetRoles),
      targetNodes: this.normalizeNullable(saved.targetNodes),
    };
  }

  /** 兼容旧调用（只改 targetRoles） */
  async setTargetRoles(eventType: string, targetRoles: string[]) {
    return this.setTargets(eventType, { targetRoles });
  }

  /**
   * 发送侧读取策略。
   * - 未配置返回 `{ targetRoles: null, targetNodes: null }`，调用方按默认策略发送；
   * - 查询失败也返回 null 策略（降级为默认发送），绝不因配置读不到而漏发业务通知。
   */
  async getPolicy(eventType: string): Promise<NotificationPolicy> {
    const cached = this.policyCache.get(eventType);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const row = await this.prisma.notificationSetting.findUnique({ where: { eventType } });
      const value: NotificationPolicy = {
        targetRoles: this.normalizeNullable(row?.targetRoles),
        targetNodes: this.normalizeNullable(row?.targetNodes),
      };
      this.policyCache.set(eventType, { value, expiresAt: Date.now() + POLICY_TTL_MS });
      return value;
    } catch (e) {
      this.logger.warn(`读取通知策略失败，降级为默认发送：${eventType} / ${(e as Error).message}`);
      return { targetRoles: null, targetNodes: null };
    }
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

  private requireStringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: `${field}必须是数组`,
      });
    }
    return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  /** Json 列 → string[]；非数组（含 null/异常结构）一律视为「未配置」 */
  private normalizeNullable(raw: unknown): string[] | null {
    if (!Array.isArray(raw)) return null;
    return raw.filter((r): r is string => typeof r === 'string');
  }
}
