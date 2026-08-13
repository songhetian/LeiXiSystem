// S07 · 考勤规则引擎 单元测试（TDD RED 先行，移植 prototypes/engine-demo.mjs 7 用例）
// 引擎是纯函数、零框架依赖，可独立跑单测
import { describe, it, expect } from '@jest/globals';
import { buildDaily, type Shift, type PunchLog } from '../src/attendance/engine/attendance-engine';

describe('S07 · 考勤规则引擎（纯函数）', () => {
  const dayShift: Shift = { start: '08:00', end: '17:00', isNextDay: false };

  it('正常班次 → status=normal, late=0, overtime=0', () => {
    const r = buildDaily(
      [{ time: '08:00' }, { time: '17:00' }],
      dayShift,
    );
    expect(r.status).toBe('normal');
    expect(r.lateMinutes).toBe(0);
    expect(r.earlyMinutes).toBe(0);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.punchCount).toBe(2);
    expect(r.firstPunch).toBe('08:00');
    expect(r.lastPunch).toBe('17:00');
  });

  it('迟到30分钟 → lateMinutes=30, status=late', () => {
    const r = buildDaily(
      [{ time: '08:30' }, { time: '17:00' }],
      dayShift,
    );
    expect(r.lateMinutes).toBe(30);
    expect(r.status).toBe('late');
  });

  it('早退30分钟 → earlyMinutes=30, status=early', () => {
    const r = buildDaily(
      [{ time: '08:00' }, { time: '16:30' }],
      dayShift,
    );
    expect(r.earlyMinutes).toBe(30);
    expect(r.status).toBe('early');
  });

  it('加班60分钟 → overtimeMinutes=60', () => {
    const r = buildDaily(
      [{ time: '08:00' }, { time: '18:00' }],
      dayShift,
    );
    expect(r.overtimeMinutes).toBe(60);
    expect(r.status).toBe('normal');
  });

  it('迟到+早退 → status=late_early', () => {
    const r = buildDaily(
      [{ time: '08:15' }, { time: '16:45' }],
      dayShift,
    );
    expect(r.lateMinutes).toBe(15);
    expect(r.earlyMinutes).toBe(15);
    expect(r.status).toBe('late_early');
  });

  it('5次打卡 → status=abnormal（>4次标记异常）', () => {
    const r = buildDaily(
      [
        { time: '08:00' },
        { time: '10:00' },
        { time: '12:00' },
        { time: '14:00' },
        { time: '17:00' },
      ],
      dayShift,
    );
    expect(r.status).toBe('abnormal');
    expect(r.punchCount).toBe(5);
  });

  it('无打卡 → status=absent, punchCount=0', () => {
    const r = buildDaily([], dayShift);
    expect(r.status).toBe('absent');
    expect(r.punchCount).toBe(0);
  });

  describe('跨天班次（夜班）', () => {
    const nightShift: Shift = { start: '22:00', end: '06:00', isNextDay: true };

    it('跨天正常班次 → status=normal, 凌晨下班卡正确', () => {
      const r = buildDaily(
        [{ time: '22:00' }, { time: '06:00' }],
        nightShift,
      );
      expect(r.status).toBe('normal');
      expect(r.firstPunch).toBe('22:00');
      expect(r.lastPunch).toBe('06:00');
    });

    it('跨天班次加班10分钟 → overtimeMinutes=10', () => {
      const r = buildDaily(
        [{ time: '22:00' }, { time: '06:10' }],
        nightShift,
      );
      expect(r.overtimeMinutes).toBe(10);
      expect(r.status).toBe('normal');
    });

    it('跨天班次迟到20分钟（晚上22:20才到）→ lateMinutes=20', () => {
      const r = buildDaily(
        [{ time: '22:20' }, { time: '06:00' }],
        nightShift,
      );
      expect(r.lateMinutes).toBe(20);
      expect(r.status).toBe('late');
    });

    it('跨天班次早退15分钟（凌晨05:45走）→ earlyMinutes=15', () => {
      const r = buildDaily(
        [{ time: '22:00' }, { time: '05:45' }],
        nightShift,
      );
      expect(r.earlyMinutes).toBe(15);
      expect(r.status).toBe('early');
    });
  });
});
