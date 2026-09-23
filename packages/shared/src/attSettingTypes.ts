/** 考勤设置模块共享类型（服务端与前端共用） */

/** 全局考勤设置（系统级单例，id 恒为 1）：GET/PUT /api/attendance/settings */
export interface AttSettingView {
  earlyClockInMinutes: number; // 上班打卡宽限（分钟）
  lateClockOutMinutes: number; // 下班打卡宽限（分钟）
  lateMinutes: number; // 迟到判定阈值（分钟）
  earlyLeaveMinutes: number; // 早退判定阈值（分钟）
  absentHours: number; // 缺勤判定阈值（小时）
  allowMakeup: boolean; // 是否允许补卡
  makeupDeadlineDays: number; // 补卡申请截止（天）
  requireApprovalForMakeup: boolean; // 补卡是否需要审批
  notifyOnLate: boolean; // 迟到通知
  notifyOnEarlyLeave: boolean; // 早退通知
  notifyOnAbsent: boolean; // 缺勤通知
  enableTimeCheck: boolean; // 是否启用按时打卡判定
}