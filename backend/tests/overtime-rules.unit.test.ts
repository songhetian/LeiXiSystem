// 加班时长规则（缺陷 P0-2）
// CONTEXT.md / spec §2.2：加班分钟 = min(加班申请时长, 实际超出班次下班后的打卡时长)。
// 另：休息日/法定节假日**没有排班**时，日报原本根本不生成 → 到岗加班完全不计薪。
import { describe, it, expect } from '@jest/globals';
import { capOvertimeByApproval } from '../src/attendance/overtime-cap';
import { buildRestDayDaily } from '../src/attendance/engine/attendance-engine';

describe('加班时长封顶 min(申请, 实际)（P0-2）', () => {
  it('实际超出 > 申请 → 取申请（防超付）', () => {
    expect(capOvertimeByApproval(180, 120)).toBe(120);
  });

  it('实际超出 < 申请 → 取实际（防虚报）', () => {
    expect(capOvertimeByApproval(60, 120)).toBe(60);
  });

  it('无已批加班申请 → 0（规格字面：min(申请, 实际)）', () => {
    expect(capOvertimeByApproval(120, null)).toBe(0);
    expect(capOvertimeByApproval(120, 0)).toBe(0);
  });

  it('没有实际超时 → 0（即便已批了申请）', () => {
    expect(capOvertimeByApproval(0, 120)).toBe(0);
  });
});

describe('休息日 / 法定节假日无排班到岗（P0-2）', () => {
  it('加班时长取首末打卡跨度，无迟到早退判定', () => {
    const r = buildRestDayDaily([{ time: '09:03' }, { time: '17:33' }]);
    expect(r.punchCount).toBe(2);
    expect(r.lateMinutes).toBe(0);
    expect(r.earlyMinutes).toBe(0);
    expect(r.overtimeMinutes).toBe(510); // 9:03 → 17:33
    expect(r.firstPunch).toBe('09:03');
    expect(r.lastPunch).toBe('17:33');
  });

  it('只有一次打卡 → 无法判定工作时长，加班计 0', () => {
    const r = buildRestDayDaily([{ time: '09:03' }]);
    expect(r.punchCount).toBe(1);
    expect(r.overtimeMinutes).toBe(0);
  });

  it('无打卡 → 缺勤', () => {
    const r = buildRestDayDaily([]);
    expect(r.punchCount).toBe(0);
    expect(r.status).toBe('absent');
  });
});
