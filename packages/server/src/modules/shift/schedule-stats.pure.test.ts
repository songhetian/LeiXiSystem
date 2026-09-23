import { describe, it, expect } from 'vitest';
import { buildScheduleStats } from './schedule-stats.pure';
import type { ScheduleView } from '@leixi/shared';

function row(partial: Partial<ScheduleView>): ScheduleView {
  return {
    id: 1,
    scheduleDate: '2026-09-01',
    isRestDay: false,
    userId: 1,
    userName: '张三',
    departmentId: 2,
    departmentName: '研发部',
    shiftId: 1,
    shiftName: '早班',
    startTime: '09:00',
    endTime: '18:00',
    color: '#3B82F6',
    workHours: 9,
    ...partial,
  };
}

describe('buildScheduleStats 排班统计纯函数', () => {
  const opts = { month: '2026-09' };

  it('出勤/休息/累计工时：仅统计目标月份，工时保留 1 位小数', () => {
    const rows = [
      row({ scheduleDate: '2026-09-02', workHours: 9 }),
      row({ scheduleDate: '2026-09-03', isRestDay: true, workHours: 0 }),
      row({ scheduleDate: '2026-09-05', workHours: 10 }),
      row({ scheduleDate: '2026-08-31', workHours: 12 }), // 非目标月，忽略
    ];
    const result = buildScheduleStats(rows, opts);
    expect(result).toHaveLength(1);
    const s = result[0]!;
    expect(s.userName).toBe('张三');
    expect(s.shiftDays).toBe(2);
    expect(s.restDays).toBe(1);
    expect(s.totalWorkHours).toBe(19);
    expect(s.avgWorkHours).toBe(9.5);
  });

  it('休息日均不累计工时，即使误传 workHours 也不计入', () => {
    const rows = [
      row({ scheduleDate: '2026-09-02', isRestDay: true, workHours: 9 }),
      row({ scheduleDate: '2026-09-03', workHours: 9.5 }),
    ];
    const result = buildScheduleStats(rows, opts);
    const s = result[0]!;
    expect(s.restDays).toBe(1);
    expect(s.shiftDays).toBe(1);
    expect(s.totalWorkHours).toBe(9.5);
    expect(s.avgWorkHours).toBe(9.5);
  });

  it('多员工独立分组，各自携带部门名', () => {
    const rows = [
      row({ userId: 1, userName: '张三', departmentName: '研发部', scheduleDate: '2026-09-02', workHours: 9 }),
      row({ userId: 2, userName: '李四', departmentName: '市场部', scheduleDate: '2026-09-02', workHours: 8 }),
      row({ userId: 2, userName: '李四', departmentName: '市场部', scheduleDate: '2026-09-03', isRestDay: true, workHours: 0 }),
    ];
    const result = buildScheduleStats(rows, opts);
    expect(result).toHaveLength(2);
    const zhang = result.find((s) => s.userId === 1)!;
    const li = result.find((s) => s.userId === 2)!;
    expect(zhang.shiftDays).toBe(1);
    expect(zhang.restDays).toBe(0);
    expect(li.departmentName).toBe('市场部');
    expect(li.shiftDays).toBe(1);
    expect(li.restDays).toBe(1);
  });

  it('纯休息：出勤 0 时日均工时为 0', () => {
    const rows = [row({ scheduleDate: '2026-09-02', isRestDay: true, workHours: 0 })];
    const s = buildScheduleStats(rows, opts)[0]!;
    expect(s.shiftDays).toBe(0);
    expect(s.restDays).toBe(1);
    expect(s.totalWorkHours).toBe(0);
    expect(s.avgWorkHours).toBe(0);
  });

  it('无目标月份数据返回空数组', () => {
    const rows = [row({ scheduleDate: '2026-08-01', workHours: 9 })];
    expect(buildScheduleStats(rows, opts)).toHaveLength(0);
  });
});