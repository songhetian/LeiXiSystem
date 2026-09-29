import { Prisma } from '@prisma/client';

/**
 * 加班转调休的折算口径（全仓唯一实现）。
 *
 * 比率由系统设置 `overtime_to_leave_hours` 决定（多少小时折算 1 天调休），
 * 缺省 8。审批通过折算与驳回/撤回扣回必须共用本模块，否则改设置后
 * 会出现「按新比率发放、按旧比率扣回」的余额漂移。
 */

export const OVERTIME_TO_LEAVE_HOURS_KEY = 'overtime_to_leave_hours';
export const DEFAULT_OVERTIME_TO_LEAVE_HOURS = 8;

type SettingReader = {
  systemSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<{ value: string | null } | null>;
  };
};

/**
 * 读取「多少小时折算 1 天调休」，设置缺失或值非法时回退默认 8。
 *
 * 刻意不吞读库异常：本函数在「审批通过发放」与「驳回/撤回扣回」两条路径上共用，
 * 且常处于事务中。若读库失败就静默回退 8，会造成按配置发放、按 8 扣回的余额漂移；
 * 事务内吞异常更会掩盖已中止的事务。读库异常一律上抛交由上层中断/重试。
 */
export async function getOvertimeToLeaveHours(client: SettingReader): Promise<number> {
  const setting = await client.systemSetting.findUnique({
    where: { key: OVERTIME_TO_LEAVE_HOURS_KEY },
  });
  const parsed = setting?.value ? parseInt(setting.value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_OVERTIME_TO_LEAVE_HOURS;
  return parsed;
}

/** 加班小时 → 调休天数（Decimal 运算，禁用浮点） */
export function overtimeHoursToLeaveDays(
  hours: Prisma.Decimal | number | string,
  hoursPerDay: number,
): Prisma.Decimal {
  return new Prisma.Decimal(hours).dividedBy(hoursPerDay);
}