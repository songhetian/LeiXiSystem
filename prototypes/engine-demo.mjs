// ============================================================
// PROTOTYPE — 核心业务算法可运行验证（throwaway，非生产代码）
// 验证问题：考勤规则引擎 + 算薪引擎的输出是否匹配 spec 预期
// 依据：docs/spec/technical-spec.md 第 2 章、CONTEXT.md 业务规则
// 运行：node engine-demo.mjs
// 注意：原型为验证用途，规则实现为简化版，结论见本文件底部 NOTES
// ============================================================

// ---------- 工具 ----------
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toHM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- 考勤规则引擎（spec 2.2） ----------
// 输入：当日打卡流水 + 班次；输出：考勤日报
function buildDaily(punchLogs, shift) {
  if (!punchLogs.length) return { status: 'absent', punchCount: 0 };

  // 按时间排序（跨天班次：凌晨打卡视为次日，分钟数 +1440）
  const isNextDay = shift.isNextDay === true;
  const endMin = isNextDay && toMin(shift.end) < toMin(shift.start) ? toMin(shift.end) + 1440 : toMin(shift.end);
  const times = punchLogs.map((p) => {
    let m = toMin(p.time);
    if (isNextDay && m < toMin(shift.start)) m += 1440; // 次日凌晨卡
    return { ...p, min: m };
  }).sort((a, b) => a.min - b.min);

  const first = times[0];
  const last = times[times.length - 1];
  const startMin = toMin(shift.start);

  // 规则（C3）：首次=上班卡、最后一次=下班卡；>4 次标记异常
  const lateMinutes = first.min > startMin ? first.min - startMin : 0;
  const earlyMinutes = last.min < endMin ? endMin - last.min : 0;
  // 规则（C5 简化）：加班 = 实际超出班次结束的时长（原型不含申请时长对比）
  const overtimeMinutes = last.min > endMin ? last.min - endMin : 0;

  let status = 'normal';
  if (times.length > 4) status = 'abnormal';
  else if (lateMinutes > 0) status = lateMinutes > 0 && earlyMinutes > 0 ? 'late_early' : 'late';
  else if (earlyMinutes > 0) status = 'early';

  return {
    punchCount: times.length,
    firstPunch: toHM(first.min % 1440),
    lastPunch: toHM(last.min % 1440),
    lateMinutes,
    earlyMinutes,
    overtimeMinutes,
    status,
  };
}

// ---------- 算薪引擎（spec 2.3 / CONTEXT 业务规则） ----------
// 输入：员工档案 + 已确认月报快照 + 薪资配置；输出：工资明细 + 合计
// 原型假设（spec 未定义，待确认）：小时工资 = 基本工资 ÷ 21.75 ÷ 8
function calculatePayroll(emp, snapshot, cfg) {
  const items = [];
  const hourly = emp.basicSalary / 21.75 / 8;

  // 基本工资（固定）
  items.push({ code: 'base', name: '基本工资', amount: round2(emp.basicSalary) });

  // 加班费：平日 1.5 / 休息日 2 / 法定 3（按小时）
  const ot = snapshot.overtimeHours || { weekday: 0, weekend: 0, holiday: 0 };
  const otAmount =
    ot.weekday * hourly * 1.5 + ot.weekend * hourly * 2 + ot.holiday * hourly * 3;
  if (otAmount > 0) items.push({ code: 'overtime', name: '加班费', amount: round2(otAmount) });

  // 缺勤扣款：基本工资 ÷ 当月应出勤天数 × 缺勤天数
  if (snapshot.absentDays > 0) {
    const deduct = (emp.basicSalary / snapshot.scheduledDays) * snapshot.absentDays;
    items.push({ code: 'absent', name: '缺勤扣款', amount: round2(-deduct) });
  }

  // 全勤奖：无迟到、无缺卡、无请假（有薪假除外）→ 固定金额
  const fullAttendance =
    snapshot.lateCount === 0 && snapshot.absentDays === 0 && snapshot.noLeave;
  if (fullAttendance && cfg.fullAttendanceBonus > 0) {
    items.push({ code: 'bonus', name: '全勤奖', amount: round2(cfg.fullAttendanceBonus) });
  }

  // 餐补：按出勤天数
  if (cfg.mealAllowancePerDay > 0 && snapshot.workDays > 0) {
    items.push({ code: 'meal', name: '餐补', amount: round2(snapshot.workDays * cfg.mealAllowancePerDay) });
  }

  // 社保/公积金代扣（固定金额）
  if (cfg.socialSecurity > 0) {
    items.push({ code: 'social', name: '社保代扣', amount: round2(-cfg.socialSecurity) });
  }

  const total = round2(items.reduce((s, i) => s + i.amount, 0));
  return { employee: emp.name, items, total };
}

// ---------- 断言 ----------
let passed = 0, failed = 0;
function expect(name, actual, expected) {
  const ok = actual === expected;
  if (ok) passed++; else failed++;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}  期望=${expected} 实际=${actual}`);
}

// ================= 考勤引擎用例（spec 预期） =================
console.log('\n===== 考勤规则引擎用例 =====');
const dayShift = { start: '08:00', end: '17:00', isNextDay: false };

const t1 = buildDaily([{ time: '08:00' }, { time: '17:00' }], dayShift);
expect('正常班次状态', t1.status, 'normal');
expect('正常班次迟到0', t1.lateMinutes, 0);
expect('正常班次加班0', t1.overtimeMinutes, 0);

const t2 = buildDaily([{ time: '08:30' }, { time: '17:00' }], dayShift);
expect('迟到30分钟', t2.lateMinutes, 30);

const t3 = buildDaily([{ time: '08:00' }, { time: '16:30' }], dayShift);
expect('早退30分钟', t3.earlyMinutes, 30);

const t4 = buildDaily([{ time: '08:00' }, { time: '18:00' }], dayShift);
expect('加班60分钟', t4.overtimeMinutes, 60);

const t5 = buildDaily([{ time: '08:00' }, { time: '10:00' }, { time: '12:00' }, { time: '14:00' }, { time: '17:00' }], dayShift);
expect('5次打卡标记异常', t5.status, 'abnormal');

const nightShift = { start: '22:00', end: '06:00', isNextDay: true };
const t6 = buildDaily([{ time: '22:00' }, { time: '06:10' }], nightShift);
expect('跨天班次状态', t6.status, 'normal');
expect('跨天班次凌晨下班卡', t6.lastPunch, '06:10');
expect('跨天班次加班10分钟', t6.overtimeMinutes, 10);

const t7 = buildDaily([], dayShift);
expect('无打卡=缺卡', t7.status, 'absent');

// ================= 算薪引擎用例（spec 2.3） =================
console.log('\n===== 算薪引擎用例（3 名员工对账样例） =====');
const cfg = { fullAttendanceBonus: 200, mealAllowancePerDay: 10, socialSecurity: 500 };

// 员工 A：满勤 + 平日加班 10h
const a = calculatePayroll(
  { name: '员工A', basicSalary: 5000 },
  { workDays: 22, scheduledDays: 22, absentDays: 0, lateCount: 0, noLeave: true, overtimeHours: { weekday: 10, weekend: 0, holiday: 0 } },
  cfg
);
// 期望：5000 + 5000/21.75/8*10*1.5(=431.03) + 全勤200 + 餐补220 - 社保500 = 5351.03
expect('员工A 基本工资', a.items[0].amount, 5000);
expect('员工A 加班费', a.items.find(i => i.code === 'overtime').amount, 431.03);
expect('员工A 全勤奖', a.items.find(i => i.code === 'bonus').amount, 200);
expect('员工A 合计', a.total, 5351.03);

// 员工 B：缺勤2天 + 迟到3次 + 休息日加班8h（无全勤）
const b = calculatePayroll(
  { name: '员工B', basicSalary: 6000 },
  { workDays: 20, scheduledDays: 22, absentDays: 2, lateCount: 3, noLeave: true, overtimeHours: { weekday: 0, weekend: 8, holiday: 0 } },
  cfg
);
// 期望：6000 + 6000/21.75/8*8*2(=551.72) - 6000/22*2(=545.45) + 餐补200 - 社保500 = 5706.27
expect('员工B 加班费', b.items.find(i => i.code === 'overtime').amount, 551.72);
expect('员工B 缺勤扣款', b.items.find(i => i.code === 'absent').amount, -545.45);
expect('员工B 无全勤', b.items.find(i => i.code === 'bonus'), undefined);
expect('员工B 合计', b.total, 5706.27);

// 员工 C：月中入职（出勤11天）+ 请假3天（noLeave=false）
const c = calculatePayroll(
  { name: '员工C', basicSalary: 4000 },
  { workDays: 11, scheduledDays: 14, absentDays: 3, lateCount: 0, noLeave: false, overtimeHours: { weekday: 0, weekend: 0, holiday: 0 } },
  cfg
);
// 期望：4000 - 4000/14*3(=857.14) + 餐补110 - 社保500 = 2752.86（无全勤、无加班）
expect('员工C 缺勤扣款', c.items.find(i => i.code === 'absent').amount, -857.14);
expect('员工C 无全勤', c.items.find(i => i.code === 'bonus'), undefined);
expect('员工C 餐补', c.items.find(i => i.code === 'meal').amount, 110);
expect('员工C 合计', c.total, 2752.86);

// ---------- 汇总 ----------
console.log(`\n===== 结果：${passed} PASS / ${failed} FAIL =====`);
if (failed > 0) process.exit(1);

// ============================================================
// NOTES — 原型验证结论（capture the answer）
// 问题：算法输出是否匹配 spec 预期？
// 结论：考勤 7 例、算薪 12 项断言全部 PASS → 算法设计与 spec 2.2/2.3 一致。
// 发现（原型暴露的 spec 缺口，需决策）：
//   1. 加班费小时基数未定义 → 原型采用 基本工资÷21.75÷8，需确认是否采用标准 21.75。
//   2. 缺勤天数与请假天数关系：员工 C 请假 3 天同时计入 absentDays，需确认请假是否=缺勤口径。
//   3. 跨天班次加班（次日 06:10 超时 10 分钟）原型按"结束时间+时长"判定，需确认真实班次加班边界。
// 原型已答问题，待 spec 补上述 3 项后此文件可删除。
// ============================================================
