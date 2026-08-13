// S07 · 考勤日报状态合并（请假/补卡）单元测试（TDD RED 先行）
import { describe, it, expect } from '@jest/globals';
import { buildDaily, type Shift } from '../src/attendance/engine/attendance-engine';
import {
  mergeLeaveMakeupIntoDaily,
  type LeaveRecordInput,
  type MakeupRecordInput,
} from '../src/attendance/engine/daily-status-merger';

describe('S07 · 考勤日报状态合并（请假/补卡/节假日）', () => {
  const dayShift: Shift = { start: '08:00', end: '17:00', isNextDay: false };
  const baseNormal = buildDaily([{ time: '08:00' }, { time: '17:00' }], dayShift);
  const baseAbsent = buildDaily([], dayShift);

  describe('请假记录合并', () => {
    it('全天请假（approved）→ status=leave，覆盖 absent', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 1, isFullDay: true },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, leaves, []);
      expect(r.status).toBe('leave');
      expect(r.leaveDays).toBe(1);
    });

    it('全天请假 → 覆盖 normal 状态', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 1, isFullDay: true },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, []);
      expect(r.status).toBe('leave');
    });

    it('半天请假 → status 保留原打卡状态，但 leaveDays=0.5', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 0.5, isFullDay: false },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, []);
      expect(r.status).toBe('normal');
      expect(r.leaveDays).toBe(0.5);
    });

    it('pending 状态的请假 → 不影响日报', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'pending', days: 1, isFullDay: true },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, leaves, []);
      expect(r.status).toBe('absent');
      expect(r.leaveDays).toBe(0);
    });

    it('rejected 状态的请假 → 不影响日报', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'rejected', days: 1, isFullDay: true },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, leaves, []);
      expect(r.status).toBe('absent');
      expect(r.leaveDays).toBe(0);
    });

    it('多个请假累加天数', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 0.5, isFullDay: false },
        { status: 'approved', days: 0.5, isFullDay: false },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, []);
      expect(r.leaveDays).toBe(1);
      expect(r.status).toBe('leave');
    });
  });

  describe('补卡记录合并', () => {
    it('已批准补卡 → status=makeup', () => {
      const makeups: MakeupRecordInput[] = [
        { status: 'approved', punchTime: '09:00' },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, [], makeups);
      expect(r.status).toBe('makeup');
    });

    it('pending 补卡 → 不影响', () => {
      const makeups: MakeupRecordInput[] = [
        { status: 'pending', punchTime: '09:00' },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, [], makeups);
      expect(r.status).toBe('absent');
    });

    it('补卡 + 原有打卡 → status=makeup（补卡优先）', () => {
      const makeups: MakeupRecordInput[] = [
        { status: 'approved', punchTime: '09:00' },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, [], makeups);
      expect(r.status).toBe('makeup');
    });
  });

  describe('优先级规则', () => {
    it('请假 > 补卡 → 状态为 leave', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 1, isFullDay: true },
      ];
      const makeups: MakeupRecordInput[] = [
        { status: 'approved', punchTime: '09:00' },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, makeups);
      expect(r.status).toBe('leave');
      expect(r.leaveDays).toBe(1);
    });

    it('节假日标记 → status=holiday（最高优先级）', () => {
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, [], [], { isHoliday: true });
      expect(r.status).toBe('holiday');
    });

    it('周末标记 → status=weekend', () => {
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, [], [], { isWeekend: true });
      expect(r.status).toBe('weekend');
    });

    it('优先级：holiday > weekend > leave > makeup > 打卡状态', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 1, isFullDay: true },
      ];
      const makeups: MakeupRecordInput[] = [
        { status: 'approved', punchTime: '09:00' },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, makeups, { isHoliday: true, isWeekend: true });
      expect(r.status).toBe('holiday');
    });
  });

  describe('边界场景', () => {
    it('无请假无补卡 → 保持原状态', () => {
      const r = mergeLeaveMakeupIntoDaily(baseNormal, [], []);
      expect(r.status).toBe('normal');
      expect(r.leaveDays).toBe(0);
    });

    it('空输入 → 保持原状态', () => {
      const r = mergeLeaveMakeupIntoDaily(baseAbsent, [], []);
      expect(r.status).toBe('absent');
      expect(r.leaveDays).toBe(0);
    });

    it('leaveDays 累加保留精度（0.3 + 0.3 = 0.6）', () => {
      const leaves: LeaveRecordInput[] = [
        { status: 'approved', days: 0.3, isFullDay: false },
        { status: 'approved', days: 0.3, isFullDay: false },
      ];
      const r = mergeLeaveMakeupIntoDaily(baseNormal, leaves, []);
      expect(r.leaveDays).toBeCloseTo(0.6, 5);
    });

    it('迟到+补卡 → 状态为 makeup，但保留迟到分钟数', () => {
      const lateResult = buildDaily([{ time: '08:30' }, { time: '17:00' }], dayShift);
      const makeups: MakeupRecordInput[] = [
        { status: 'approved', punchTime: '08:30' },
      ];
      const r = mergeLeaveMakeupIntoDaily(lateResult, [], makeups);
      expect(r.status).toBe('makeup');
      expect(r.lateMinutes).toBe(30);
    });
  });
});
