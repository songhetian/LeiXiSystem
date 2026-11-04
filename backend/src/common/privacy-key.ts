/**
 * 工资条「二级密码已验证」标记的 Redis key。
 *
 * 写入/校验在 payroll/payslip.service，密码变更（设置/修改/重置）时由 auth.service
 * 主动删除 —— 否则改了密码后旧标记还能免验证 300s，泄露后重置密码等于没重置。
 * 放在 common 而不是各自模块里定义，避免两处字符串拼写漂移。
 */
export function payslipPrivacyKey(userId: number): string {
  return `payslip:privacy-ok:${userId}`;
}
