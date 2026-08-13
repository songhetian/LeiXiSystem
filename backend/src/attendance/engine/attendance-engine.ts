// S07 · 考勤规则引擎（domain 纯函数，零框架依赖）
// 依据：CONTEXT.md 业务规则、spec 2.2、prototypes/engine-demo.mjs 验证结论
// 规则 C1：跨天班次按班次归属日归集
// 规则 C3：首次=上班卡、最后一次=下班卡；>4 次标记异常
// 规则 C5：加班 = 实际超出班次结束时长（生产版需 min(申请,实际)，见 S06 加班记录）

export interface Shift {
  start: string;
  end: string;
  isNextDay: boolean;
}

export interface PunchLog {
  time: string;
}

export interface DailyResult {
  punchCount: number;
  firstPunch: string | null;
  lastPunch: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  status: 'normal' | 'late' | 'early' | 'late_early' | 'abnormal' | 'absent';
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function toHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function buildDaily(punchLogs: PunchLog[], shift: Shift): DailyResult {
  if (!punchLogs.length) {
    return {
      punchCount: 0,
      firstPunch: null,
      lastPunch: null,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 0,
      status: 'absent',
    };
  }

  const startMin = toMin(shift.start);
  const rawEndMin = toMin(shift.end);
  const endMin = shift.isNextDay && rawEndMin < startMin ? rawEndMin + 1440 : rawEndMin;

  const times = punchLogs
    .map((p) => {
      let m = toMin(p.time);
      if (shift.isNextDay && m < startMin) m += 1440;
      return { ...p, min: m };
    })
    .sort((a, b) => a.min - b.min);

  const first = times[0];
  const last = times[times.length - 1];

  const lateMinutes = first.min > startMin ? first.min - startMin : 0;
  const earlyMinutes = last.min < endMin ? endMin - last.min : 0;
  const overtimeMinutes = last.min > endMin ? last.min - endMin : 0;

  let status: DailyResult['status'] = 'normal';
  if (times.length > 4) {
    status = 'abnormal';
  } else if (lateMinutes > 0 && earlyMinutes > 0) {
    status = 'late_early';
  } else if (lateMinutes > 0) {
    status = 'late';
  } else if (earlyMinutes > 0) {
    status = 'early';
  }

  return {
    punchCount: times.length,
    firstPunch: toHM(first.min),
    lastPunch: toHM(last.min),
    lateMinutes,
    earlyMinutes,
    overtimeMinutes,
    status,
  };
}
