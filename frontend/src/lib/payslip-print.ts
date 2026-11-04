import { formatDateTime, formatMoney } from '@/lib/format';
import type { PayslipDetail, PayslipItem } from '@/services/payslip';

export interface PayslipPrintOptions {
  /** 公司/系统名称，打印稿抬头用；缺省不显示抬头 */
  companyName?: string;
  /** 抬头 Logo 地址；加载失败时自然留空，不占位 */
  logoUrl?: string;
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );

/** 汇总明细金额：先转整数分再相加，避免浮点尾差（与后端定点口径一致） */
function sumAmount(items: PayslipItem[]): number {
  return items.reduce((cents, item) => cents + Math.round(Number(item.amount ?? 0) * 100), 0) / 100;
}

/** 由 YYYY-MM 推出工资周期（当月 1 日 ~ 当月最后一日） */
function billingPeriod(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return month;
  // 第 0 天 = 上个月最后一天，恰好是 mon 月的月末
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${month}-01 ~ ${month}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * 生成工资条打印稿（独立 HTML 文档，A4 排版）。
 *
 * 为什么不直接 window.print()：会把侧边栏、列表一起打出来，且明细在弹窗里会被裁切。
 * 另开窗口只渲染工资条本身，浏览器「另存为 PDF」即可归档。
 *
 * 颜色刻意用字面量而非 --lx-* token：这是脱离应用样式表的独立文档（新窗口不继承
 * 主题），且打印输出始终是浅底纸张，本就不应随暗色主题变化。
 */
export function buildPayslipPrintHtml(
  payslip: PayslipDetail,
  options: PayslipPrintOptions = {},
): string {
  const { companyName, logoUrl } = options;
  const generatedAt = formatDateTime(new Date().toISOString());

  const amountCell = (value: unknown) => {
    const negative = Number(value) < 0;
    return `<td class="amount${negative ? ' negative' : ''}">${escapeHtml(formatMoney(value))}</td>`;
  };

  const itemsTable = (title: string, items: PayslipItem[]) => {
    if (items.length === 0) return '';
    return `<h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr><th>项目</th><th class="amount">金额</th></tr></thead>
        <tbody>${items
          .map((item) => `<tr><td>${escapeHtml(item.name)}</td>${amountCell(item.amount)}</tr>`)
          .join('')}</tbody>
        <tfoot><tr><td>合计</td>${amountCell(sumAmount(items))}</tr></tfoot>
      </table>`;
  };

  const incomeItems = payslip.items.filter((item) => item.type === 'income');
  const deductionItems = payslip.items.filter((item) => item.type === 'deduction');
  const watermarkText = `${payslip.employeeName || '工资条'} · ${payslip.employeeNo || ''} · ${payslip.month}`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(payslip.month)} 工资条</title>
<style>
  /* A4 纸面：内容不贴边，长明细可跨页且每页都带表头 */
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.6 -apple-system, "Microsoft YaHei", sans-serif; color: #0f172a; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 64px; font-weight: 700; letter-spacing: 4px;
    color: rgba(15, 23, 42, 0.06);
    white-space: nowrap; pointer-events: none; z-index: 0;
  }
  .head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
  .head img { height: 32px; }
  .head h1 { font-size: 20px; margin: 0; }
  .head .company { font-size: 13px; color: #64748b; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 32px; margin: 14px 0 0; font-size: 12px; color: #334155; }
  .meta span { color: #64748b; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #334155; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { width: 40%; color: #64748b; font-weight: 400; }
  tfoot td { border-top: 1px solid #cbd5e1; font-weight: 600; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  .negative { color: #b91c1c; }
  .summary { display: flex; gap: 32px; margin: 18px 0 4px; padding: 14px 16px; background: #f8fafc; border-radius: 8px; }
  .summary div { flex: 1; }
  .summary span { display: block; font-size: 12px; color: #64748b; }
  .summary b { font-size: 18px; font-variant-numeric: tabular-nums; }
  .foot { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="watermark">${escapeHtml(watermarkText)}</div>
  <div class="head">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="" />` : ''}
    <div>
      <h1>${escapeHtml(payslip.month)} 工资条</h1>
      ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ''}
    </div>
  </div>
  <div class="meta">
    <div><span>工资周期</span> ${escapeHtml(billingPeriod(payslip.month))}</div>
    <div><span>工号</span> ${escapeHtml(payslip.employeeNo || '--')}</div>
    <div><span>姓名</span> ${escapeHtml(payslip.employeeName || '--')}</div>
    <div><span>部门</span> ${escapeHtml(payslip.departmentName || '--')}</div>
    <div><span>发放时间</span> ${escapeHtml(formatDateTime(payslip.createdAt))}</div>
  </div>
  <div class="summary">
    <div><span>应发合计</span><b>${escapeHtml(formatMoney(payslip.totalIncome))}</b></div>
    <div><span>扣款合计</span><b>${escapeHtml(formatMoney(payslip.totalDeduction))}</b></div>
    <div><span>实发工资</span><b>${escapeHtml(formatMoney(payslip.netSalary))}</b></div>
  </div>
  ${itemsTable('收入明细', incomeItems)}
  ${itemsTable('扣款明细', deductionItems)}
  ${itemsTable('调整项', payslip.adjustments || [])}
  <div class="foot">
    <span>本工资条仅供本人核对，请勿外传。</span>
    <span>生成时间 ${escapeHtml(generatedAt)}</span>
  </div>
</body>
</html>`;
}

/**
 * 在新窗口打开打印稿并立即调起打印，打印结束后自动关闭标签页。
 *
 * 用 Blob URL 而不是 document.write：避免空白页与竞态，且便于释放内存。
 * 返回 false 表示弹窗被浏览器拦截，调用方据此提示用户。
 */
export function openPayslipPrintWindow(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank', 'width=900,height=760');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  // 等文档加载完再唤起打印：立刻 print 在部分浏览器会打出空白页
  win.onload = () => {
    win.focus();
    win.print();
    URL.revokeObjectURL(url);
  };
  // 打印对话框关闭后自动收起标签页，避免留下一排空白窗口
  win.onafterprint = () => win.close();
  return true;
}

/** 下载工资条 HTML 文件：可归档、可转发，也可用浏览器打开后另存 PDF */
export function downloadPayslipHtml(html: string, filename: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
