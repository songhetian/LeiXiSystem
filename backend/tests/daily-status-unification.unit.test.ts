// 日报状态口径统一（缺陷 P1-4）
//
// 现状：`attendance_daily.status` 有两条写入路径，语义不同——
//   A 日报生成：mergeLeaveMakeupIntoDaily（认识 makeup / weekend / holiday，且会覆盖 absent）
//   B 重算：resolveDailyStatus（只看 leaveDays / absentMinutes / punchCount / late / early）
// 后果：周末行（status=weekend）经重算且无打卡 → 被判成 absent → 月报 absentDays 增加
//       → 算薪按缺勤扣款多扣；补卡行会被抹掉 makeup 标记。
//
// 本用例锁定「两路径必须给出同一结果」，这是统一口径的客观判据。
import { describe, it, expect } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { resolveDailyStatus } from '../src/attendance/daily-status';
import { buildDaily } from '../src/attendance/engine/attendance-engine';
import {
  mergeLeaveMakeupIntoDaily,
  type LeaveRecordInput,
  type MakeupRecordInput,
} from '../src/attendance/engine/daily-status-merger';

const fullLeave: LeaveRecordInput[] = [{ status: 'approved', days: 1, isFullDay: true }];
const halfLeave: LeaveRecordInput[] = [{ status: 'approved', days: 0.5, isFullDay: false }];
const oneMakeup: MakeupRecordInput[] = [{ status: 'approved', punchTime: '09:00' }];

describe('日报状态口径统一（P1-4）', () => {
  it('周末行无打卡 → 仍是 weekend，不得被重算成缺勤', () => {
    expect(
      resolveDailyStatus({
        punchCount: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0),
        isWeekend: true,
      }),
    ).toBe('weekend');
  });

  it('法定节假日行无打卡 → 仍是 holiday', () => {
    expect(
      resolveDailyStatus({
        punchCount: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0),
        isHoliday: true,
      }),
    ).toBe('holiday');
  });

  it('已通过补卡 → makeup', () => {
    expect(
      resolveDailyStatus({
        punchCount: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0),
        makeupCount: 1,
      }),
    ).toBe('makeup');
  });

  it('优先级与日报生成一致：法定 > 休息日 > 请假 > 补卡', () => {
    const base = {
      punchCount: 2,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(1),
      fullDayLeave: true,
      makeupCount: 1,
    };
    expect(resolveDailyStatus({ ...base, isHoliday: true, isWeekend: true })).toBe('holiday');
    expect(resolveDailyStatus({ ...base, isWeekend: true })).toBe('weekend');
    expect(resolveDailyStatus({ ...base })).toBe('leave');
  });

  it('半天请假不改变当天状态（不把迟到洗成请假）', () => {
    expect(
      resolveDailyStatus({
        punchCount: 2,
        lateMinutes: 12,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0.5),
      }),
    ).toBe('late');
  });

  it('等价性：对同一组输入，两条路径必须给出相同状态', () => {
    const scenarios: Array<{
      name: string;
      punches: string[];
      leaves: LeaveRecordInput[];
      makeups: MakeupRecordInput[];
      isWeekend?: boolean;
      isHoliday?: boolean;
    }> = [
      { name: '正常出勤', punches: ['09:00', '18:00'], leaves: [], makeups: [] },
      { name: '无打卡工作日', punches: [], leaves: [], makeups: [] },
      { name: '全天请假', punches: [], leaves: fullLeave, makeups: [] },
      { name: '半天请假', punches: ['09:00', '18:00'], leaves: halfLeave, makeups: [] },
      { name: '补卡日', punches: [], leaves: [], makeups: oneMakeup },
      { name: '周末无打卡', punches: [], leaves: [], makeups: [], isWeekend: true },
      { name: '周末到岗', punches: ['09:00', '18:00'], leaves: [], makeups: [], isWeekend: true },
      { name: '法定节假日', punches: [], leaves: [], makeups: [], isHoliday: true },
      { name: '周末且全天请假（休息日优先）', punches: [], leaves: fullLeave, makeups: [], isWeekend: true },
      { name: '法定且全天请假（法定优先）', punches: [], leaves: fullLeave, makeups: [], isHoliday: true },
      { name: '补卡日且全天请假（请假优先）', punches: [], leaves: fullLeave, makeups: oneMakeup },
    ];

    for (const s of scenarios) {
      const times = s.punches.map((t) => ({ time: t }));
      const shift = { start: '09:00', end: '18:00', isNextDay: false };
      const merged = mergeLeaveMakeupIntoDaily(
        // 用真实引擎产出基础状态，避免手工构造 late/early
        buildDaily(times, shift),
        s.leaves,
        s.makeups,
        { isWeekend: s.isWeekend, isHoliday: s.isHoliday },
      );

      const resolved = resolveDailyStatus({
        punchCount: merged.punchCount,
        lateMinutes: merged.lateMinutes,
        earlyMinutes: merged.earlyMinutes,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(merged.leaveDays),
        fullDayLeave: merged.fullDayLeave,
        isWeekend: s.isWeekend,
        isHoliday: s.isHoliday,
        makeupCount: merged.makeupCount,
      });

      expect({ name: s.name, status: resolved }).toEqual({ name: s.name, status: merged.status });
    }
  });
});
