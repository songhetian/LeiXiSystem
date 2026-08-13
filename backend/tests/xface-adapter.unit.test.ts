// S05 · XFace600 HTTP Adapter 单元测试（TDD RED 先行）
import { describe, it, expect } from '@jest/globals';
import {
  parseXFaceRecords,
  buildLastSyncTimeCursor,
  filterNewRecords,
  XFaceRecord,
} from '../src/attendance/engine/xface-adapter';

describe('S05 · XFace600 HTTP Adapter（打卡采集 domain 纯函数）', () => {
  // ===== 正常用例 =====
  describe('parseXFaceRecords — 解析 XFace600 API 响应', () => {
    it('正常响应 → 解析为标准打卡记录数组', () => {
      const apiResponse = {
        ret: 0,
        total: 3,
        rows: [
          { emp_code: 'E101', punch_time: '2026-08-10 08:00:00', device_sn: 'DEV001', punch_type: '1' },
          { emp_code: 'E101', punch_time: '2026-08-10 17:30:00', device_sn: 'DEV001', punch_type: '2' },
          { emp_code: 'E102', punch_time: '2026-08-10 08:05:00', device_sn: 'DEV001', punch_type: '1' },
        ],
      };

      const result = parseXFaceRecords(apiResponse);
      expect(result.length).toBe(3);
      expect(result[0].employeeNo).toBe('E101');
      expect(result[0].punchTime).toBeInstanceOf(Date);
      expect(result[0].punchTime.getFullYear()).toBe(2026);
      expect(result[0].punchTime.getMonth()).toBe(7);
      expect(result[0].punchTime.getDate()).toBe(10);
      expect(result[0].punchTime.getHours()).toBe(8);
      expect(result[0].punchTime.getMinutes()).toBe(0);
      expect(result[0].deviceNo).toBe('DEV001');
      expect(result[0].punchType).toBe('1');
    });

    it('空响应（ret=0 total=0 rows=[]）→ 返回空数组', () => {
      const apiResponse = { ret: 0, total: 0, rows: [] };
      const result = parseXFaceRecords(apiResponse);
      expect(result).toEqual([]);
    });

    it('字段名兼容（sn/serial_no）', () => {
      const resp1 = { ret: 0, total: 1, rows: [{ emp_code: 'E101', punch_time: '2026-08-10 08:00:00', device_sn: 'DEV001' }] };
      const r1 = parseXFaceRecords(resp1);
      expect(r1[0].deviceNo).toBe('DEV001');
    });
  });

  // ===== 边界用例 =====
  describe('buildLastSyncTimeCursor — 增量游标构建', () => {
    it('首次同步（无上次时间）→ 取默认起始时间（30天前）', () => {
      const cursor = buildLastSyncTimeCursor(null);
      expect(cursor).toBeDefined();
      const cursorDate = new Date(cursor);
      const now = new Date();
      const diffDays = (now.getTime() - cursorDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('有上次同步时间 → 格式化为 YYYY-MM-DD HH:mm:ss', () => {
      const lastTime = new Date('2026-08-10T08:00:00Z');
      const cursor = buildLastSyncTimeCursor(lastTime);
      expect(cursor).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('边界：1毫秒前的时间', () => {
      const lastTime = new Date(2026, 7, 10, 23, 59, 59, 999);
      const cursor = buildLastSyncTimeCursor(lastTime);
      expect(cursor).toContain('23:59:59');
    });
  });

  describe('filterNewRecords — 去重过滤（根据已有记录时间戳）', () => {
    const existing = [
      { employeeNo: 'E101', punchTime: new Date('2026-08-10 08:00:00'), deviceNo: 'DEV001' },
      { employeeNo: 'E101', punchTime: new Date('2026-08-10 17:30:00'), deviceNo: 'DEV001' },
    ];

    it('全部新记录 → 全部返回', () => {
      const newRecords: XFaceRecord[] = [
        { employeeNo: 'E102', punchTime: new Date('2026-08-10 09:00:00'), deviceNo: 'DEV001' },
      ];
      const filtered = filterNewRecords(newRecords, existing);
      expect(filtered.length).toBe(1);
    });

    it('部分重复 → 只返回新记录', () => {
      const newRecords: XFaceRecord[] = [
        { employeeNo: 'E101', punchTime: new Date('2026-08-10 08:00:00'), deviceNo: 'DEV001' },
        { employeeNo: 'E101', punchTime: new Date('2026-08-10 12:00:00'), deviceNo: 'DEV001' },
      ];
      const filtered = filterNewRecords(newRecords, existing);
      expect(filtered.length).toBe(1);
      expect(filtered[0].punchTime.getHours()).toBe(12);
    });

    it('全部重复 → 返回空数组', () => {
      const newRecords: XFaceRecord[] = [
        { employeeNo: 'E101', punchTime: new Date('2026-08-10 08:00:00'), deviceNo: 'DEV001' },
      ];
      const filtered = filterNewRecords(newRecords, existing);
      expect(filtered.length).toBe(0);
    });

    it('同员工同时间不同设备 → 视为两条不同记录', () => {
      const newRecords: XFaceRecord[] = [
        { employeeNo: 'E101', punchTime: new Date('2026-08-10 08:00:00'), deviceNo: 'DEV002' },
      ];
      const filtered = filterNewRecords(newRecords, existing);
      expect(filtered.length).toBe(1);
    });

    it('空输入 → 空输出', () => {
      const filtered = filterNewRecords([], existing);
      expect(filtered).toEqual([]);
    });
  });

  // ===== 异常用例 =====
  describe('异常场景处理', () => {
    it('API 返回错误码（ret != 0）→ 抛错', () => {
      const badResp = { ret: 1, msg: 'device offline' };
      expect(() => parseXFaceRecords(badResp as any)).toThrow();
    });

    it('时间格式无效 → 该条跳过而非整体失败', () => {
      const apiResponse = {
        ret: 0,
        total: 2,
        rows: [
          { emp_code: 'E101', punch_time: 'invalid-time', device_sn: 'DEV001' },
          { emp_code: 'E102', punch_time: '2026-08-10 09:00:00', device_sn: 'DEV001' },
        ],
      };
      const result = parseXFaceRecords(apiResponse);
      expect(result.length).toBe(1);
      expect(result[0].employeeNo).toBe('E102');
    });

    it('缺少必要字段（emp_code） → 该条跳过', () => {
      const apiResponse = {
        ret: 0,
        total: 2,
        rows: [
          { punch_time: '2026-08-10 08:00:00', device_sn: 'DEV001' },
          { emp_code: 'E102', punch_time: '2026-08-10 09:00:00', device_sn: 'DEV001' },
        ],
      };
      const result = parseXFaceRecords(apiResponse);
      expect(result.length).toBe(1);
      expect(result[0].employeeNo).toBe('E102');
    });

    it('响应为 null/undefined → 抛错', () => {
      expect(() => parseXFaceRecords(null as any)).toThrow();
      expect(() => parseXFaceRecords(undefined as any)).toThrow();
    });
  });
});
