/**
 * 加班时长封顶 —— 全仓唯一口径。
 *
 * 依据 CONTEXT.md / spec §2.2：
 *   加班分钟 = min(加班申请时长, 实际超出班次下班后的打卡时长)
 *
 * 注意「无已批申请 → 0」是规格的字面含义（min(0, 实际)），不是遗漏：
 * 未提交/未获批准的加班不计薪。若要改为「无申请按实际计」，须先改业务口径。
 */
export function capOvertimeByApproval(
  actualMinutes: number,
  approvedMinutes: number | null | undefined,
): number {
  if (!actualMinutes || actualMinutes <= 0) return 0;
  if (approvedMinutes === null || approvedMinutes === undefined) return 0;
  if (approvedMinutes <= 0) return 0;
  return Math.min(actualMinutes, approvedMinutes);
}
