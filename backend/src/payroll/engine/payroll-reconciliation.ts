// S10 · 算薪人工对账工具（domain 纯函数，零框架依赖）
// 依据：step-4 §4.3「对账验收：抽 3 名员工人工对账一致后方可上线」、S10 核心验证点「3 人对账样例回归基线」
//
// 职责：把「机算（引擎）结果」与「人工核算期望值」逐项比对，产出可签字的对账结论。
// 人工期望值必须独立于引擎手算得出（Excel/纸笔），手算公式留痕见 docs/payroll/。
// 将来接真实批次：从 PayrollRun 明细构造 machineResults 直接复跑，接口不变。

import { toCents } from '../../common/money.util';
import type { PayrollItem, PayrollResult } from './payroll-engine';

/** 人工核算的期望值（手算留痕，独立于引擎得出） */
export interface ManualExpectation {
  employee: string;
  /** 手算明细，code 需与引擎口径一致（base/overtime/absent/lateDeduct/earlyDeduct/bonus/meal/social） */
  items: PayrollItem[];
  /** 手算合计 */
  total: number;
  /** 手算口径备注（如「加班费 = 5000/21.75/8*10*1.5」） */
  note?: string;
}

/** 单条差异：某 code 上机算与人算的差额（整数分） */
export interface ReconciliationDiff {
  code: string;
  name: string;
  /** 机算金额（元）；null = 机算无此项 */
  machineAmount: number | null;
  /** 人算金额（元）；null = 人算无此项 */
  manualAmount: number | null;
  /** 机算 - 人算（整数分，0 为一致） */
  diffCents: number;
}

export interface EmployeeReconciliation {
  employee: string;
  /** 全量比对行（机算 ∪ 人算 的 code 并集），供对账单逐项展示 */
  items: ReconciliationDiff[];
  /** 仅差异项（diffCents ≠ 0） */
  diffs: ReconciliationDiff[];
  /** 合计差异（整数分，机算合计 - 人算合计） */
  totalDiffCents: number;
  /** 人算口径备注（手算公式留痕） */
  note?: string;
  passed: boolean;
}

export interface PayrollReconciliationReport {
  rows: EmployeeReconciliation[];
  passed: boolean;
}

export function reconcilePayroll(
  machineResults: PayrollResult[],
  expectations: ManualExpectation[],
): PayrollReconciliationReport {
  const machineByName = new Map(machineResults.map((r) => [r.employee, r]));
  const manualByName = new Map(expectations.map((e) => [e.employee, e]));
  const names = new Set<string>([...machineByName.keys(), ...manualByName.keys()]);

  const rows: EmployeeReconciliation[] = [];
  for (const name of names) {
    const machine = machineByName.get(name);
    const manual = manualByName.get(name);
    rows.push(reconcileOne(name, machine ?? null, manual ?? null));
  }

  return { rows, passed: rows.every((r) => r.passed) };
}

function reconcileOne(
  name: string,
  machine: PayrollResult | null,
  manual: ManualExpectation | null,
): EmployeeReconciliation {
  const machineItems = new Map((machine?.items ?? []).map((i) => [i.code, i]));
  const manualItems = new Map((manual?.items ?? []).map((i) => [i.code, i]));
  const codes = new Set<string>([...machineItems.keys(), ...manualItems.keys()]);

  const diffs: ReconciliationDiff[] = [];
  const items: ReconciliationDiff[] = [];
  for (const code of codes) {
    const m = machineItems.get(code);
    const e = manualItems.get(code);
    const machineCents = m ? toCents(m.amount) : 0;
    const manualCents = e ? toCents(e.amount) : 0;
    const diffCents = machineCents - manualCents;
    const line: ReconciliationDiff = {
      code,
      name: m?.name ?? e?.name ?? code,
      machineAmount: m ? m.amount : null,
      manualAmount: e ? e.amount : null,
      diffCents,
    };
    items.push(line);
    if (diffCents !== 0) {
      diffs.push(line);
    }
  }

  const totalDiffCents = toCents(machine?.total ?? 0) - toCents(manual?.total ?? 0);
  return {
    employee: name,
    items,
    diffs,
    totalDiffCents,
    note: manual?.note,
    passed: diffs.length === 0 && totalDiffCents === 0,
  };
}

/** 金额格式化：元，保留两位小数；差异带符号（机算 - 人算）。 */
function fmt(amount: number | null): string {
  return amount === null ? '—' : amount.toFixed(2);
}

function fmtDiff(cents: number): string {
  if (cents === 0) return '0.00';
  const yuan = cents / 100;
  return yuan > 0 ? `+${yuan.toFixed(2)}` : yuan.toFixed(2);
}

/**
 * 生成人读对账单（Markdown）。作为「3 人人工对账」的签字载体：
 * 每名员工一节，逐项列出机算/人算/差异，末尾给出结论与复核签字栏。
 */
export function formatReconciliationReport(report: PayrollReconciliationReport): string {
  const lines: string[] = ['# 算薪人工对账单', '', '口径：机算（算薪引擎） vs 人算（手算留痕），单位：元', ''];

  let diffCount = 0;
  for (const row of report.rows) {
    lines.push(`## ${row.employee} —— ${row.passed ? '通过' : '不通过'}`, '');
    lines.push('| 项目 | 机算 | 人算 | 差异 |', '|---|---|---|---|');
    for (const d of row.items) {
      if (d.diffCents !== 0) diffCount += 1;
      lines.push(
        `| ${d.name} | ${fmt(d.machineAmount)} | ${fmt(d.manualAmount)} | ${fmtDiff(d.diffCents)} |`,
      );
    }
    lines.push(
      `合计差异（机算 - 人算）：${fmtDiff(row.totalDiffCents)}`,
    );
    if (row.note) {
      lines.push(`人算口径：${row.note}`);
    }
    lines.push('');
  }

  lines.push(
    report.passed
      ? `## 结论：对账通过（${report.rows.length} 名员工逐项一致）`
      : `## 结论：对账不通过（${diffCount} 项差异，禁止发布工资条）`,
    '',
    '复核签字：________　日期：________',
    '',
  );
  return lines.join('\n');
}
