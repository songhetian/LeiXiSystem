/** 加班模块共享类型（服务端与前端共用） */

/** 加班申请单项：含审批状态与申请人/部门名（供前端直接渲染与审批） */
export interface OvertimeView {
  id: number;
  date: string; // 加班日期 YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number; // 加班时长（小时）
  reason: string;
  status: string; // pending | approved | rejected
  applicantId: number;
  departmentId: number;
  applicantName: string;
  departmentName: string;
}

/** GET /api/overtimes/stats 加班统计：审批通过的总时长与次数的口径 */
export interface OvertimeStats {
  totalHours: number; // 已批准加班累计时长（小时）
  approvedCount: number; // 已批准次数
  pendingCount: number; // 待审批次数
  month: string; // YYYY-MM
}