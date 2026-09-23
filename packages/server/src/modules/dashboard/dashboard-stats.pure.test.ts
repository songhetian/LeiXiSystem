import { describe, it, expect } from 'vitest';
import { buildDashboardStats } from './dashboard-stats.pure';
import type {
  LeaveView,
  OvertimeStats,
  MakeupView,
  ReimburseView,
  AttendanceView,
  AttendanceExceptionView,
} from '@leixi/shared';

const MONTH = '2026-09';

function leave(p: Partial<LeaveView>): LeaveView {
  return {
    id: 1,
    type: '病假',
    reason: '',
    startAt: '2026-09-01',
    endAt: '2026-09-01',
    status: 'pending',
    applicantId: 1,
    departmentId: 2,
    applicantName: '张',
    departmentName: '研发部',
    ...p,
  };
}

function makeup(p: Partial<MakeupView>): MakeupView {
  return {
    id: 1,
    recordDate: '2026-09-01',
    clockType: 'check_in',
    clockTime: '09:05',
    reason: '',
    status: 'pending',
    applicantId: 1,
    departmentId: 2,
    applicantName: '张',
    departmentName: '研发部',
    ...p,
  };
}

function reimburse(p: Partial<ReimburseView>): ReimburseView {
  return {
    id: 1,
    categoryId: 1,
    categoryName: '餐饮',
    reason: '',
    amount: 100,
    status: 'pending',
    applicantId: 1,
    departmentId: 2,
    applicantName: '张',
    departmentName: '研发部',
    createdAt: '2026-09-10T08:00:00.000Z',
    items: [{ id: 1, reimburseId: 1, categoryId: 1, categoryName: '餐饮', amount: 100, note: null }],
    ...p,
  };
}

function attendance(p: Partial<AttendanceView>): AttendanceView {
  return {
    id: 1,
    date: '2026-09-01',
    checkIn: '09:00',
    checkOut: '18:00',
    note: '',
    userId: 1,
    departmentId: 2,
    applicantName: '张',
    departmentName: '研发部',
    ...p,
  };
}

function exception(p: Partial<AttendanceExceptionView>): AttendanceExceptionView {
  return {
    id: 1,
    type: 'late',
    date: '2026-09-01',
    minutes: 10,
    status: 'pending',
    remark: null,
    userId: 1,
    departmentId: 2,
    userName: '张',
    departmentName: '研发部',
    updatedAt: '2026-09-01T08:00:00.000Z',
    ...p,
  };
}

/** 空输入：各块指标为 0，topCategories 为空 */
describe('buildDashboardStats', () => {
  it('空输入返回全 0 骨架', () => {
    expect(buildDashboardStats({ month: MONTH })).toEqual({
      month: MONTH,
      approvals: { leave: 0, overtime: 0, makeup: 0, reimburse: 0, total: 0 },
      attendance: { records: 0, late: 0, earlyLeave: 0, missingPunch: 0, absent: 0 },
      trend: { leaves: 0, makeupCount: 0, overtimeHours: 0, reimburseCount: 0, reimburseAmount: 0 },
      scale: { departments: 0, employees: 0, topCategories: [] },
    });
  });

  it('待办审批：各模块 pending 计数累加 total', () => {
    const res = buildDashboardStats({
      month: MONTH,
      leaves: [leave({ status: 'pending' }), leave({ status: 'pending' }), leave({ status: 'approved' })],
      overtimeStats: { totalHours: 5, approvedCount: 1, pendingCount: 3, month: MONTH },
      makeups: [makeup({ status: 'pending' }), makeup({ status: 'rejected' })],
      reimburses: [reimburse({ status: 'pending' }), reimburse({ status: 'approved' })],
    });
    expect(res.approvals).toEqual({ leave: 2, overtime: 3, makeup: 1, reimburse: 1, total: 7 });
  });

  it('考勤概览：records 为本月打卡记录数，异常按本月 + 类型计数', () => {
    const res = buildDashboardStats({
      month: MONTH,
      attendances: [attendance({}), attendance({}), attendance({ date: '2026-08-31' }), attendance({ date: '2026-09-02' })],
      exceptions: [
        exception({ type: 'late' }),
        exception({ type: 'late' }),
        exception({ type: 'early_leave' }),
        exception({ type: 'missing_punch' }),
        exception({ type: 'absent' }),
        exception({ type: 'late', date: '2026-08-30' }),
      ],
    });
    expect(res.attendance.records).toBe(3);
    expect(res.attendance.late).toBe(2);
    expect(res.attendance.earlyLeave).toBe(1);
    expect(res.attendance.missingPunch).toBe(1);
    expect(res.attendance.absent).toBe(1);
  });

  it('月度趋势：只统计本月数据，加班时长用 stats.totalHours', () => {
    const res = buildDashboardStats({
      month: MONTH,
      leaves: [leave({}), leave({ startAt: '2026-09-02' }), leave({ startAt: '2026-09-03' }), leave({ startAt: '2026-08-20' })],
      makeups: [makeup({}), makeup({ recordDate: '2026-09-02' }), makeup({ recordDate: '2026-08-15' })],
      overtimeStats: { totalHours: 45, approvedCount: 9, pendingCount: 2, month: MONTH },
      reimburses: [
        reimburse({ id: 1, createdAt: '2026-09-01T00:00:00.000Z', amount: 100 }),
        reimburse({ id: 2, createdAt: '2026-09-02T00:00:00.000Z', amount: 200 }),
        reimburse({ id: 3, createdAt: '2026-08-05T00:00:00.000Z', amount: 999 }),
      ],
    });
    expect(res.trend.leaves).toBe(3);
    expect(res.trend.makeupCount).toBe(2);
    expect(res.trend.overtimeHours).toBe(45);
    expect(res.trend.reimburseCount).toBe(2);
    expect(res.trend.reimburseAmount).toBe(300);
  });

  it('规模：部门/员工数为透传值，topCategories 按本月分项聚合取 Top4 且空类别归「未分类」', () => {
    const res = buildDashboardStats({
      month: MONTH,
      reimburses: [
        reimburse({
          id: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          items: [
            { id: 1, reimburseId: 1, categoryId: 1, categoryName: '餐饮', amount: 100, note: null },
            { id: 2, reimburseId: 1, categoryId: 2, categoryName: '交通', amount: 50, note: null },
          ],
        }),
        reimburse({
          id: 2,
          createdAt: '2026-09-02T00:00:00.000Z',
          items: [{ id: 3, reimburseId: 2, categoryId: 1, categoryName: '餐饮', amount: 200, note: null }],
        }),
        reimburse({
          id: 4,
          createdAt: '2026-08-30T00:00:00.000Z',
          items: [{ id: 5, reimburseId: 4, categoryId: 1, categoryName: '餐饮', amount: 999, note: null }],
        }),
      ],
      departments: 4,
      employees: 9,
    });
    expect(res.scale.departments).toBe(4);
    expect(res.scale.employees).toBe(9);
    expect(res.scale.topCategories).toEqual([
      { name: '餐饮', amount: 300 },
      { name: '交通', amount: 50 },
    ]);
  });
});