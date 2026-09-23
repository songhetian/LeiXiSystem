/**
 * 业务编码自动生成：prefix + 14位日期时间(YYYYMMDDHHmmss) + 3位随机数。
 * 对齐老项目 BX 报销单号格式（backend/src/reimbursement/reimbursement.service.ts generateReimbursementNo）。
 * 用于参考/设置类编码在未手动填写时由后端自动生成，避免用户手填英文编码；
 * 因含到秒的时间戳 + 随机数，即使同一秒并发也几乎不重复，满足唯一索引约束。
 */
export function generateAutoCode(prefix: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${prefix}${ts}${rand}`;
}