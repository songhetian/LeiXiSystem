import {
  planBatchApply,
  parseScheduleImportRows,
  excelSerialToDate,
  batchConfirmMessage,
  filterSchedulesForEmployees,
  summarizeImport,
  formatBatchFailure,
  mergeUpsertItems,
} from '@/features/attendance/lib/schedule-plan';
import type { Schedule } from '@/services/attendance';

const mkSchedule = (id: number, employeeId: number, shiftId: number, workDate = '2026-08-01'): Schedule => ({
  id,
  employeeId,
  shiftId,
  workDate,
});

describe('planBatchApply — 批量排班计划', () => {
  const employees = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const scheduleMap = new Map<string, Schedule>([
    // 1 号员工当天已是同一班次 → 无需变更
    ['1_2026-08-01', mkSchedule(11, 1, 5)],
    // 2 号员工当天是另一个班次 → 更新
    ['2_2026-08-01', mkSchedule(12, 2, 6)],
    // 3 号员工当天无排班 → 新建
  ]);
  const leaveKeys = new Set(['4_2026-08-01']);

  it('区分新建/更新/无需变更，并跳过已请假员工', () => {
    const plan = planBatchApply(employees, '2026-08-01', 5, scheduleMap, leaveKeys);
    expect(plan.itemsToCreate).toEqual([{ employeeId: 3, shiftId: 5, workDate: '2026-08-01' }]);
    expect(plan.toUpdate).toEqual([
      { id: 12, employeeId: 2, shiftId: 5, workDate: '2026-08-01' },
    ]);
    expect(plan.skippedOnLeave).toBe(1);
    expect(plan.toDelete).toEqual([]);
  });

  it('清除模式只删除已存在的排班，不新建、不更新', () => {
    const plan = planBatchApply(employees, '2026-08-01', 'clear', scheduleMap, leaveKeys);
    expect(plan.itemsToCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([11, 12]);
    // 请假员工本来就没有排班，不算被清除
    expect(plan.skippedOnLeave).toBe(1);
  });
});

describe('batchConfirmMessage — 破坏性/覆盖操作的确认文案', () => {
  const base = { itemsToCreate: [], toUpdate: [], toDelete: [], skippedOnLeave: 0 };

  it('清除当日排班需要确认，并给出将删除的条数', () => {
    const msg = batchConfirmMessage({ ...base, toDelete: [1, 2, 3] }, '2026-08-01', 'clear');
    expect(msg).toContain('3');
    expect(msg).toContain('2026-08-01');
  });

  it('会覆盖已有排班时也要确认', () => {
    const msg = batchConfirmMessage(
      { ...base, itemsToCreate: [{ employeeId: 1, shiftId: 1, workDate: '2026-08-01' }], toUpdate: [{ id: 2, employeeId: 2, shiftId: 1, workDate: '2026-08-01' }] },
      '2026-08-01',
      1,
    );
    expect(msg).not.toBeNull();
    expect(msg).toContain('1');
  });

  it('纯新增且无覆盖时不需要确认（避免每次批量新增都弹窗）', () => {
    const msg = batchConfirmMessage(
      { ...base, itemsToCreate: [{ employeeId: 1, shiftId: 1, workDate: '2026-08-01' }] },
      '2026-08-01',
      1,
    );
    expect(msg).toBeNull();
  });
});

describe('filterSchedulesForEmployees — 导出/统计跟随当前列表', () => {
  const all = [
    mkSchedule(1, 1, 10),
    mkSchedule(2, 2, 10),
    mkSchedule(3, 3, 10),
  ];

  it('只保留当前可见员工的排班（导出不再导出全公司）', () => {
    expect(filterSchedulesForEmployees(all, new Set([1, 3]))).toEqual([all[0], all[2]]);
  });
});

describe('parseScheduleImportRows — 排班导入解析', () => {
  const employees = [
    { id: 1, employeeNo: 'E001', name: '张三' },
    { id: 2, employeeNo: 'E002', name: '李四' },
  ];
  const shifts = [
    { id: 10, name: '早班' },
    { id: 11, name: '晚班' },
  ];
  const range = { startDate: '2026-08-01', endDate: '2026-08-31' };

  it('支持日期单元格（Date 实例）与工号匹配', () => {
    const { items, errors } = parseScheduleImportRows(
      [{ 工号: 'E001', 姓名: '张三', 日期: new Date(2026, 7, 1), 班次: '早班' }],
      employees,
      shifts,
      range,
    );
    expect(errors).toEqual([]);
    expect(items).toEqual([{ employeeId: 1, shiftId: 10, workDate: '2026-08-01' }]);
  });

  it('支持 Excel 日期序列号（此前会被判成格式错误）', () => {
    // Excel 1900 日期系统：46235 = 2026-08-01（已用独立计算核对）
    expect(excelSerialToDate(46235)).toBe('2026-08-01');
    const { items, errors } = parseScheduleImportRows(
      [{ 工号: 'E002', 日期: 46235, 班次: '晚班' }],
      employees,
      shifts,
      range,
    );
    expect(errors).toEqual([]);
    expect(items).toEqual([{ employeeId: 2, shiftId: 11, workDate: '2026-08-01' }]);
  });

  it('日期超出当前月份时给出可读错误，而不是静默写入', () => {
    const { items, errors } = parseScheduleImportRows(
      [{ 工号: 'E001', 日期: '2026-09-01', 班次: '早班' }],
      employees,
      shifts,
      range,
    );
    expect(items).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('不在当前月份');
  });

  it('员工/班次缺失时逐行报错并继续解析其它行', () => {
    const { items, errors } = parseScheduleImportRows(
      [
        { 工号: 'E999', 日期: '2026-08-02', 班次: '早班' },
        { 工号: 'E001', 日期: '2026-08-03', 班次: '夜班' },
        { 工号: 'E001', 日期: '2026-08-04', 班次: '早班' },
      ],
      employees,
      shifts,
      range,
    );
    expect(items).toEqual([{ employeeId: 1, shiftId: 10, workDate: '2026-08-04' }]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('找不到员工');
    expect(errors[1]).toContain('找不到班次');
  });
});

describe('summarizeImport — 导入前的覆盖统计', () => {
  it('区分新增与覆盖（同员工同日已有排班即会被 upsert 覆盖）', () => {
    const scheduleMap = new Map<string, Schedule>([
      ['1_2026-08-01', mkSchedule(11, 1, 5)],
      ['2_2026-08-02', mkSchedule(12, 2, 6)],
    ]);
    const summary = summarizeImport(
      [
        { employeeId: 1, shiftId: 5, workDate: '2026-08-01' },
        { employeeId: 3, shiftId: 5, workDate: '2026-08-01' },
        { employeeId: 2, shiftId: 5, workDate: '2026-08-02' },
      ],
      scheduleMap,
    );
    expect(summary).toEqual({ toCreate: 1, toOverwrite: 2 });
  });

  it('文件内同员工同日重复行只统计一次（后者覆盖前者）', () => {
    const scheduleMap = new Map<string, Schedule>();
    const summary = summarizeImport(
      [
        { employeeId: 1, shiftId: 5, workDate: '2026-08-01' },
        { employeeId: 1, shiftId: 6, workDate: '2026-08-01' },
      ],
      scheduleMap,
    );
    expect(summary).toEqual({ toCreate: 1, toOverwrite: 0 });
  });
});

describe('mergeUpsertItems — 批量新建与覆盖合并为一次 upsert', () => {
  it('新建与覆盖合并且不带记录 id（后端按员工+日期 upsert）', () => {
    const plan = {
      itemsToCreate: [{ employeeId: 1, shiftId: 5, workDate: '2026-08-01' }],
      toUpdate: [{ id: 12, employeeId: 2, shiftId: 5, workDate: '2026-08-01' }],
      toDelete: [],
      skippedOnLeave: 0,
    };
    expect(mergeUpsertItems(plan)).toEqual([
      { employeeId: 1, shiftId: 5, workDate: '2026-08-01' },
      { employeeId: 2, shiftId: 5, workDate: '2026-08-01' },
    ]);
  });

  it('清除模式没有写入项时返回空数组（不额外发空批次）', () => {
    expect(
      mergeUpsertItems({ itemsToCreate: [], toUpdate: [], toDelete: [1], skippedOnLeave: 0 }),
    ).toEqual([]);
  });
});

describe('formatBatchFailure — 批量部分失败提示', () => {
  it('列出失败对象，最多 3 个，其余只给数量', () => {
    expect(formatBatchFailure(['张三(08-01)', '李四(08-01)'])).toBe(
      '批量操作完成，2 项失败：张三(08-01)、李四(08-01)',
    );
    expect(formatBatchFailure(['a', 'b', 'c', 'd'])).toBe(
      '批量操作完成，4 项失败：a、b、c 等 4 项',
    );
  });
});
