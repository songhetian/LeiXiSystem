import { describe, it, expect } from 'vitest';
import { buildAttendanceStats } from './attendance-stats.pure';
import type { AttendanceView } from '@leixi/shared';

function row(partial: Partial<AttendanceView>): AttendanceView {
  return {
    id: 1,
    date: '2026-09-01',
    checkIn: null,
    checkOut: null,
    note: '',
    userId: 1,
    departmentId: 2,
    applicantName: '张三',
    departmentName: '研发部',
    ...partial,
  };
}

describe('buildAttendanceStats 纯函数聚合', () => {
  const opts = { month: '2026-09', lateThreshold: '09:00', earlyThreshold: '18:00' };

  it('正常出勤：只统计目标月份，迟到/早退为 0，工时精确到 1 位小数', () => {
    const rows = [
      row({ date: '2026-09-02', checkIn: '09:00', checkOut: '18:00' }), // 9h
      row({ date: '2026-09-03', checkIn: '08:50', checkOut: '18:15' }),
      row({ date: '2026-08-30', checkIn: '09:00', checkOut: '18:00' }), // 非目标月，忽略
    ];
    const result = buildAttendanceStats(rows, opts);
    expect(result).toHaveLength(1);
    const s = result[0]!;
    expect(s.userName).toBe('张三');
    expect(s.presentDays).toBe(2);
    expect(s.normalDays).toBe(2);
    expect(s.lateCount).toBe(0);
    expect(s.earlyLeaveCount).toBe(0);
    // (9h + 9.42h)/2 ≈ 9.2；total = 9 + 9.4 = 18.4
    expect(s.avgWorkHours).toBe(9.2);
    expect(s.totalWorkHours).toBe(18.4);
  });

  it('迟到与早退判定：晚于阈值视为迟到，早于阈值视为早退', () => {
    const rows = [
      row({ date: '2026-09-02', checkIn: '09:05', checkOut: '18:00' }), // 迟到
      row({ date: '2026-09-03', checkIn: '09:00', checkOut: '17:30' }), // 早退
      row({ date: '2026-09-04', checkIn: '09:00', checkOut: '18:00' }), // 正常
    ];
    const result = buildAttendanceStats(rows, opts);
    expect(result).toHaveLength(1);
    expect(result[0]!.lateCount).toBe(1);
    expect(result[0]!.earlyLeaveCount).toBe(1);
    expect(result[0]!.normalDays).toBe(1);
    expect(result[0]!.presentDays).toBe(3);
  });

  it('只签到未签退（或相反）不算正常；只有签退判定早退', () => {
    const rows = [
      row({ date: '2026-09-02', checkIn: '09:00', checkOut: null }), // 只签到
      row({ date: '2026-09-03', checkIn: null, checkOut: '17:00' }), // 只签退且早退
    ];
    const result = buildAttendanceStats(rows, opts);
    const s = result[0]!;
    expect(s.presentDays).toBe(2);
    expect(s.normalDays).toBe(0);
    expect(s.lateCount).toBe(0);
    expect(s.earlyLeaveCount).toBe(1);
    expect(s.totalWorkHours).toBe(0);
    expect(s.avgWorkHours).toBe(0);
  });

  it('多员工独立分组，各自携带部门名', () => {
    const rows = [
      row({ userId: 1, applicantName: '张三', departmentName: '研发部', date: '2026-09-02', checkIn: '09:00', checkOut: '18:00' }),
      row({ userId: 2, applicantName: '李四', departmentName: '市场部', date: '2026-09-02', checkIn: '09:10', checkOut: '18:00' }),
    ];
    const result = buildAttendanceStats(rows, opts);
    expect(result).toHaveLength(2);
    const zhang = result.find((s) => s.userId === 1)!;
    const li = result.find((s) => s.userId === 2)!;
    expect(zhang.departmentName).toBe('研发部');
    expect(zhang.normalDays).toBe(1);
    expect(li.departmentName).toBe('市场部');
    expect(li.lateCount).toBe(1);
  });

  it('无目标月份数据返回空数组', () => {
    const rows = [row({ date: '2026-08-01', checkIn: '09:00' })];
    expect(buildAttendanceStats(rows, { ...opts, month: '2026-09' })).toHaveLength(0);
  });

  it('使用自定义阈值：宽松阈值下不判定迟到', () => {
    const rows = [row({ date: '2026-09-02', checkIn: '09:05', checkOut: '18:00' })];
    const result = buildAttendanceStats(rows, { ...opts, lateThreshold: '09:10' });
    expect(result[0]!.lateCount).toBe(0);
    expect(result[0]!.normalDays).toBe(1);
  });
});