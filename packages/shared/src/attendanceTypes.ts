/** 考勤模块共享类型（服务端与前端共用） */

/** GET /api/attendance 数据项：考勤打卡记录（含申请人/部门名，供前端直接渲染） */
export interface AttendanceView {
  id: number;
  date: string; // 打卡日期 YYYY-MM-DD
  checkIn: string | null; // HH:mm
  checkOut: string | null; // HH:mm
  note: string;
  userId: number;
  departmentId: number;
  applicantName: string;
  departmentName: string;
}

/** GET /api/attendance/stats 单项：某员工在某月份的考勤统计聚合 */
export interface AttendanceStatsRow {
  userId: number;
  userName: string;
  departmentName: string;
  presentDays: number; // 已打卡天数（有签到或签退）
  normalDays: number; // 正常出勤天数（不迟到且不早退）
  lateCount: number; // 迟到次数
  earlyLeaveCount: number; // 早退次数
  avgWorkHours: number; // 平均工时（小时，一位小数）
  totalWorkHours: number; // 累计工时（小时，一位小数）
  month: string; // YYYY-MM
}

/** 考勤统计聚合入参：阈值用于判定迟到/早退（对齐旧版全局设置，默认 HH:mm） */
export interface AttendanceStatsOptions {
  month: string; // YYYY-MM
  lateThreshold?: string; // 迟到阈值，默认 "09:00"
  earlyThreshold?: string; // 早退阈值，默认 "18:00"
}

/** 考勤异常类型：迟到 / 早退 / 缺卡 / 缺勤 */
export type AttendanceExceptionType = 'late' | 'early_leave' | 'missing_punch' | 'absent';

/** 异常状态：待处理 / 已确认 / 已驳回 */
export type AttendanceExceptionStatus = 'pending' | 'confirmed' | 'dismissed';

/** 考勤异常数据项：GET /api/attendance/exceptions 列表项 */
export interface AttendanceExceptionView {
  id: number;
  type: AttendanceExceptionType;
  date: string; // YYYY-MM-DD
  minutes: number | null; // 迟到/早退分钟差；缺卡/缺勤为 null
  status: AttendanceExceptionStatus;
  remark: string | null;
  userId: number;
  departmentId: number;
  userName: string;
  departmentName: string;
  updatedAt: string;
}

/** 扫描异常入参：按日期区间遍历有排班的员工 */
export interface ScanExceptionsOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/** 扫描结果 */
export interface ScanExceptionsResult {
  created: number;
  updated: number;
}