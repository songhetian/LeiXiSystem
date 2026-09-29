// 补卡类型值域（全链路唯一口径）
//
// 领域规则 C3：上班卡 = 当日首次打卡（AttendanceDaily.firstPunch），
// 下班卡 = 当日最后一次打卡（AttendanceDaily.lastPunch）。
// 前端下拉、controller 入参校验、审批监听器写卡三处必须共用本值域，
// 否则会出现「前端提交 morning，后端只认 check_in，补卡审批通过后不写卡」的静默失效。
export const PUNCH_MAKEUP_TYPES = ['check_in', 'check_out'] as const;

export type PunchMakeupType = (typeof PUNCH_MAKEUP_TYPES)[number];

export const PUNCH_MAKEUP_TYPE_LABELS: Record<PunchMakeupType, string> = {
  check_in: '上班卡',
  check_out: '下班卡',
};