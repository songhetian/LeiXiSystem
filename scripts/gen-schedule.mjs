// 生成专业排班管理页面（月视图 + 周视图），原地替换 admin-ui-redesign-final.html
// 适用基底：step-4 纯净 CSS 版（排班 CSS 标记 = "基于真实 schedule-calendar.tsx 逻辑"）
// 本段自包含：仅依赖全局 token，自带 .sched-* / .sch-input / .fg-input
import fs from 'fs';

const FILE = process.argv[2] || 'admin-ui-redesign-final.html';
let html = fs.readFileSync(FILE, 'utf8');

const SHIFTS = {
  early: { name: '早班', time: '09:00 - 18:00', bg: 'rgba(59,130,246,.16)', bd: 'rgba(59,130,246,.42)', tx: '#1d4ed8', dot: '#3B82F6', short: '早', hours: 8 },
  late:  { name: '晚班', time: '13:00 - 22:00', bg: 'rgba(245,158,11,.18)', bd: 'rgba(245,158,11,.45)', tx: '#b45309', dot: '#F59E0B', short: '晚', hours: 8 },
  admin: { name: '行政班', time: '09:00 - 17:30', bg: 'rgba(16,185,129,.15)', bd: 'rgba(16,185,129,.42)', tx: '#047857', dot: '#10B981', short: '行政', hours: 7.5 },
};
const ROT = ['early', 'late', 'admin'];

const EMP = [
  { no: 'E001', name: '张伟', dept: '研发中心', av: '张' },
  { no: 'E002', name: '李娜', dept: '研发中心', av: '李' },
  { no: 'E003', name: '王芳', dept: '销售部', av: '王' },
  { no: 'E004', name: '陈晨', dept: '运营部', av: '陈' },
  { no: 'E005', name: '赵磊', dept: '职能中心', av: '赵' },
];

const LEAVES = new Set(['2-13', '0-20', '1-26', '3-4']);
const today = 16;

function dayMeta(d) {
  const wd = new Date(2026, 7, d).getDay();
  const weekend = wd === 0 || wd === 6;
  const dowLabel = ['日', '一', '二', '三', '四', '五', '六'][wd];
  return { wd, weekend, dowLabel, isToday: d === today, weekstart: wd === 1 };
}
function assign(ei, d) {
  const m = dayMeta(d);
  if (LEAVES.has(`${ei}-${d}`)) return 'leave';
  if (m.weekend) return 'off';
  return ROT[(d + ei) % 3];
}

function buildMonthGrid() {
  let head = '<div class="mg-corner">员工 / 日期</div>';
  for (let d = 1; d <= 31; d++) {
    const m = dayMeta(d);
    const cls = ['mg-day'];
    if (m.weekend) cls.push('weekend');
    if (m.isToday) cls.push('today');
    if (m.weekstart) cls.push('weekstart');
    head += `<div class="${cls.join(' ')}">${m.dowLabel}<span class="d-num">${d}</span></div>`;
  }
  let rows = '';
  let totalAssigned = 0, totalLeave = 0;
  EMP.forEach((e, ei) => {
    rows += `<div class="mg-emp"><div class="av">${e.av}</div><div><div class="en">${e.name}</div><div class="es">${e.no} · ${e.dept}</div></div></div>`;
    for (let d = 1; d <= 31; d++) {
      const a = assign(ei, d);
      const m = dayMeta(d);
      const cls = ['mg-cell'];
      if (m.weekend) cls.push('weekend');
      if (m.isToday) cls.push('today');
      if (m.weekstart) cls.push('weekstart');
      if (a === 'off') {
        rows += `<div class="${cls.join(' ')}"><span class="cell-off">休</span></div>`;
      } else if (a === 'leave') {
        rows += `<div class="${cls.join(' ')}"><div class="cell-leave">假</div></div>`;
        totalLeave++;
      } else {
        const s = SHIFTS[a];
        rows += `<label class="${cls.join(' ')}" for="m-schedule-edit"><div class="shift-fill" style="background:${s.bg};border-color:${s.bd};color:${s.tx}"><span>${s.short}</span><span class="sf-time">${s.time.split(' - ')[0]}</span></div></label>`;
        totalAssigned++;
      }
    }
  });
  return { grid: head + rows, totalAssigned, totalLeave };
}

function buildWeekGrid() {
  const days = [10, 11, 12, 13, 14, 15, 16];
  let head = '<div class="mg-corner">员工 / 日期</div>';
  days.forEach((d) => {
    const m = dayMeta(d);
    const cls = ['mg-day'];
    if (m.weekend) cls.push('weekend');
    if (m.isToday) cls.push('today');
    if (m.weekstart) cls.push('weekstart');
    head += `<div class="${cls.join(' ')}">${m.dowLabel}<span class="d-num">${d}</span></div>`;
  });
  let rows = '';
  EMP.forEach((e, ei) => {
    rows += `<div class="mg-emp"><div class="av">${e.av}</div><div><div class="en">${e.name}</div><div class="es">${e.no}</div></div></div>`;
    days.forEach((d) => {
      const a = assign(ei, d);
      const m = dayMeta(d);
      const cls = ['mg-cell'];
      if (m.weekend) cls.push('weekend');
      if (m.isToday) cls.push('today');
      if (m.weekstart) cls.push('weekstart');
      if (a === 'off') rows += `<div class="${cls.join(' ')}"><span class="cell-off">休</span></div>`;
      else if (a === 'leave') rows += `<div class="${cls.join(' ')}"><div class="cell-leave">假</div></div>`;
      else {
        const s = SHIFTS[a];
        rows += `<label class="${cls.join(' ')}" for="m-schedule-edit"><div class="shift-fill" style="background:${s.bg};border-color:${s.bd};color:${s.tx}"><span>${s.short}</span><span class="sf-time">${s.time.split(' - ')[0]}</span></div></label>`;
      }
    });
  });
  return head + rows;
}

const month = buildMonthGrid();
const week = buildWeekGrid();

const NEW_CSS = `/* ===== 排班管理（专业月 / 周视图，自包含） ===== */
.sched-card{border:1px solid var(--border-1);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.04)}
.sched-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 18px;border-bottom:1px solid var(--border-1)}
.sched-nav{display:flex;align-items:center;gap:6px}
.sched-navbtn{width:30px;height:30px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;transition:.12s}
.sched-navbtn:hover{border-color:var(--brand);color:var(--brand)}
.sched-title{font-size:15px;font-weight:500;color:var(--text-1);min-width:108px;text-align:center}
.sched-today{height:30px;padding:0 12px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:12.5px;cursor:pointer;transition:.12s}
.sched-today:hover{border-color:var(--brand);color:var(--brand)}
.sched-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sch-input{height:32px;padding:0 10px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface);font-size:12.5px;color:var(--text-1)}
.sch-input:focus{outline:none;border-color:var(--brand)}
.vt-toggle{display:flex;border:1px solid var(--border-1);border-radius:8px;overflow:hidden}
.vt-btn{padding:6px 14px;font-size:12.5px;background:var(--surface);border:none;cursor:pointer;color:var(--text-3);transition:.12s}
.vt-btn:hover{color:var(--text-1)}
#sv-month:checked ~ .sched-topbar .vt-btn[for="sv-month"],
#sv-week:checked ~ .sched-topbar .vt-btn[for="sv-week"]{background:var(--brand);color:#fff}
.sched-summary{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:9px 18px;background:var(--bg-2);border-bottom:1px solid var(--border-1);font-size:12px;color:var(--text-3)}
.sched-summary b{color:var(--text-1);font-weight:500}
.ss-item{display:flex;align-items:center;gap:6px}
.ss-item svg{width:14px;height:14px;opacity:.65}
.shift-palette{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 18px;border-bottom:1px solid var(--border-1)}
.shift-palette .sp-label{font-size:12px;color:var(--text-3);margin-right:2px}
.shift-pill{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:8px;border:1px solid var(--border-1);background:var(--surface);cursor:pointer;font-size:12.5px;font-weight:500;color:var(--text-2);transition:.14s;user-select:none}
.shift-pill:hover{border-color:var(--border-2)}
.shift-pill .sp-dot{width:10px;height:10px;border-radius:3px}
.shift-pill .sp-time{color:var(--text-4);font-weight:400;font-size:11px}
.shift-pill.clear{color:var(--danger)}
#st-early:checked + label[for="st-early"],
#st-late:checked + label[for="st-late"],
#st-admin:checked + label[for="st-admin"],
#st-clear:checked + label[for="st-clear"]{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand);color:var(--text-1);background:var(--brand-bg)}
.sched-body{position:relative}
#schedMonth{display:none}
#schedWeek{display:none}
#sv-month:checked ~ .sched-body #schedMonth{display:block}
#sv-week:checked ~ .sched-body #schedWeek{display:block}
.month-scroll{overflow:auto;max-height:calc(100vh - 300px)}
.week-scroll{overflow:auto}
.month-grid{display:grid;grid-template-columns:182px repeat(31,minmax(42px,1fr));min-width:1640px}
.week-grid{display:grid;grid-template-columns:182px repeat(7,minmax(96px,1fr));min-width:900px}
.mg-corner{position:sticky;top:0;left:0;z-index:4;background:var(--surface);border-right:1px solid var(--border-1);border-bottom:1px solid var(--border-1);display:flex;align-items:center;padding:0 14px;font-size:12px;color:var(--text-3);font-weight:500}
.mg-day{position:sticky;top:0;z-index:3;background:var(--surface);border-bottom:1px solid var(--border-1);border-right:1px solid var(--border-1);text-align:center;padding:8px 0 7px;font-size:11px;color:var(--text-3)}
.mg-day .d-num{display:block;font-size:13px;color:var(--text-1);font-weight:500;margin-top:2px;line-height:1}
.mg-day.weekend{background:var(--bg-2)}
.mg-day.today{background:var(--brand-bg)}
.mg-day.today .d-num{color:var(--brand)}
.mg-day.weekstart{border-left:2px solid var(--border-2)}
.mg-emp{position:sticky;left:0;z-index:2;background:var(--surface);border-right:1px solid var(--border-1);border-bottom:1px solid var(--border-1);display:flex;align-items:center;gap:9px;padding:0 12px;height:54px}
.mg-emp .av{width:30px;height:30px;border-radius:50%;background:var(--brand-bg);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0}
.mg-emp .en{font-size:13px;color:var(--text-1);font-weight:500;line-height:1.25}
.mg-emp .es{font-size:11px;color:var(--text-4)}
.mg-cell{border-right:1px solid var(--border-1);border-bottom:1px solid var(--border-1);min-height:54px;padding:5px 3px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .1s}
.mg-cell:hover{background:var(--bg-2)}
.mg-cell.weekend{background:rgba(0,0,0,.018)}
.mg-cell.today{box-shadow:inset 0 0 0 1.5px var(--brand);background:var(--brand-bg)}
.mg-cell.weekstart{border-left:2px solid var(--border-2)}
.shift-fill{width:100%;height:100%;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px 2px;font-size:11px;font-weight:500;line-height:1.15;border:1px solid transparent}
.shift-fill .sf-time{font-size:10px;font-weight:400;opacity:.82}
.cell-off{font-size:11px;color:var(--text-4);opacity:.55}
.cell-leave{width:100%;height:100%;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;background:rgba(245,158,11,.14);color:#b45309;border:1px solid rgba(245,158,11,.30)}
.fg-input{width:100%;height:36px;padding:0 12px;border:1px solid var(--border-1);border-radius:var(--radius-sm);font-size:13px;color:var(--text-1);background:var(--surface);transition:.12s}
.fg-input:focus{outline:none;border-color:var(--brand)}
`;

const NEW_HTML = `    <div class="page-view" id="page-schedule">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div><div class="ph-title">排班管理</div><div class="ph-desc">按月编排员工班次，使用预设班次快速套用；点击单元格精确编辑</div></div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <label class="btn btn-primary btn-sm" for="m-schedule-add">+ 新增排班</label>
          <label class="btn btn-sm" for="m-schedule-batch">批量排班</label>
          <button class="btn btn-sm">复制上周</button>
          <button class="btn btn-sm">导出 Excel</button>
        </div>
      </div>

      <div class="sched-card">
        <input type="radio" name="sched-view" id="sv-month" class="pg-state" checked>
        <input type="radio" name="sched-view" id="sv-week" class="pg-state">

        <div class="sched-topbar">
          <div class="sched-nav">
            <button class="sched-navbtn">&lt;</button>
            <div class="sched-title">2026 年 8 月</div>
            <button class="sched-navbtn">&gt;</button>
            <button class="sched-today">今天</button>
          </div>
          <div class="sched-tools">
            <select class="sch-input" style="width:124px"><option>全部部门</option><option>研发中心</option><option>销售部</option><option>运营部</option><option>职能中心</option></select>
            <input class="sch-input" placeholder="搜索姓名 / 工号" style="width:150px">
            <div class="vt-toggle">
              <label class="vt-btn" for="sv-month">月视图</label>
              <label class="vt-btn" for="sv-week">周视图</label>
            </div>
          </div>
        </div>

        <div class="sched-summary">
          <div class="ss-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>共 <b>31</b> 天 · <b>${EMP.length}</b> 名员工</span></div>
          <div class="ss-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>已排 <b>${month.totalAssigned}</b> 班次</span></div>
          <div class="ss-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg><span>覆盖率 <b>94%</b></span></div>
          <div class="ss-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>请假 <b>${month.totalLeave}</b> 人次</span></div>
        </div>

        <div class="shift-palette">
          <span class="sp-label">班次图例 · 快速套用</span>
          <input type="radio" name="stamp" id="st-early" class="pg-state">
          <label class="shift-pill" for="st-early" style="color:#1d4ed8"><span class="sp-dot" style="background:#3B82F6"></span>早班<span class="sp-time">09:00-18:00</span></label>
          <input type="radio" name="stamp" id="st-late" class="pg-state">
          <label class="shift-pill" for="st-late" style="color:#b45309"><span class="sp-dot" style="background:#F59E0B"></span>晚班<span class="sp-time">13:00-22:00</span></label>
          <input type="radio" name="stamp" id="st-admin" class="pg-state">
          <label class="shift-pill" for="st-admin" style="color:#047857"><span class="sp-dot" style="background:#10B981"></span>行政班<span class="sp-time">09:00-17:30</span></label>
          <input type="radio" name="stamp" id="st-clear" class="pg-state">
          <label class="shift-pill clear" for="st-clear"><span class="sp-dot" style="background:var(--danger)"></span>清除排班</label>
          <span class="sp-label" style="margin-left:auto;opacity:.8">提示：选择班次后点击单元格批量套用；或直接点击单元格精确编辑</span>
        </div>

        <div class="sched-body">
          <div id="schedMonth" class="month-scroll"><div class="month-grid">
${month.grid}
          </div></div>
          <div id="schedWeek" class="week-scroll"><div class="week-grid">
${week}
          </div></div>
        </div>
      </div>
    </div><!-- /schedule -->`;

// ===== 替换（适配 step-4 基底标记）=====
const cssStart = '/* ===== 排班日历（基于真实 schedule-calendar.tsx 逻辑） ===== */';
const cssEnd = '/* ===== 权限矩阵（基于真实 RBAC 逻辑） ===== */';
const htmlStart = '<div class="page-view" id="page-schedule">';
const htmlEnd = '<div class="page-view" id="page-daily">';

const iCssS = html.indexOf(cssStart);
const iCssE = html.indexOf(cssEnd);
if (iCssS < 0 || iCssE < 0) throw new Error('CSS markers not found');

// 先替换 CSS 段（CSS 标记位于 <style> 顶部，早于页面 HTML 区域，替换不改变其索引）
// 注意：NEW_CSS 与旧 CSS 段长度不同，必须先替换 CSS 再重新定位 HTML 标记，
// 否则 iHs/iHe 会因字符串长度变化而偏移，错误地切到上一个页面。
html = html.slice(0, iCssS) + NEW_CSS + html.slice(iCssE);

const iHs = html.indexOf(htmlStart);
const iHe = html.indexOf(htmlEnd);
if (iHs < 0 || iHe < 0) throw new Error('HTML markers not found');
if (iHe <= iHs) throw new Error('HTML end before start');

html = html.slice(0, iHs) + NEW_HTML + html.slice(iHe);

fs.writeFileSync(FILE, html);
console.log('schedule replaced. assigned=', month.totalAssigned, 'leave=', month.totalLeave);
