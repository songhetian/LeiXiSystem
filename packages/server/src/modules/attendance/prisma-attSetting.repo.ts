import type { PrismaClient } from '@prisma/client';
import type { AttSettingView } from '@leixi/shared';

type AttSettingPrisma = Pick<PrismaClient, 'workAttendanceSetting'>;

/** schema 默认值：无单例记录时的兜底（与 schema @default 对齐，作为独立来源） */
const DEFAULTS: AttSettingView = {
  earlyClockInMinutes: 5,
  lateClockOutMinutes: 5,
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  absentHours: 4,
  allowMakeup: true,
  makeupDeadlineDays: 7,
  requireApprovalForMakeup: true,
  notifyOnLate: true,
  notifyOnEarlyLeave: true,
  notifyOnAbsent: true,
  enableTimeCheck: true,
};

function toView(r: {
  earlyClockInMinutes: number;
  lateClockOutMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absentHours: number;
  allowMakeup: boolean;
  makeupDeadlineDays: number;
  requireApprovalForMakeup: boolean;
  notifyOnLate: boolean;
  notifyOnEarlyLeave: boolean;
  notifyOnAbsent: boolean;
  enableTimeCheck: boolean;
}): AttSettingView {
  return {
    earlyClockInMinutes: r.earlyClockInMinutes,
    lateClockOutMinutes: r.lateClockOutMinutes,
    lateMinutes: r.lateMinutes,
    earlyLeaveMinutes: r.earlyLeaveMinutes,
    absentHours: r.absentHours,
    allowMakeup: r.allowMakeup,
    makeupDeadlineDays: r.makeupDeadlineDays,
    requireApprovalForMakeup: r.requireApprovalForMakeup,
    notifyOnLate: r.notifyOnLate,
    notifyOnEarlyLeave: r.notifyOnEarlyLeave,
    notifyOnAbsent: r.notifyOnAbsent,
    enableTimeCheck: r.enableTimeCheck,
  };
}

/**
 * Prisma 实现的 AttSettingRepo：系统级单例配置（id 恒为 1）。
 * upsert 保证无论是否存在记录都能取到/更新单例。
 */
export function createPrismaAttSettingRepo(prisma: AttSettingPrisma) {
  return {
    async getSetting(): Promise<AttSettingView> {
      const row = await prisma.workAttendanceSetting.findUnique({ where: { id: 1 } });
      return row ? toView(row) : { ...DEFAULTS };
    },

    async updateSetting(data: AttSettingView): Promise<AttSettingView> {
      const row = await prisma.workAttendanceSetting.upsert({
        where: { id: 1 },
        update: { ...data },
        create: { id: 1, ...data },
      });
      return toView(row);
    },
  };
}