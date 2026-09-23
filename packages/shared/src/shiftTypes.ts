/** 排班模块共享类型（服务端与前端共用） */

/** GET /api/shifts 数据项：班次（部门数据隔离——通用班次 departmentId=null，本部门+下属部门可见） */
export interface WorkShiftView {
  id: number;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  workHours: number; // 工作时长（自动计算，含跨夜处理）
  restDuration: number; // 休息时长（分钟）
  lateThreshold: number | null; // 迟到阈值（分钟）
  earlyThreshold: number | null; // 早退阈值（分钟）
  useGlobalThreshold: boolean;
  isActive: boolean;
  departmentId: number | null; // null = 全公司通用
  description: string | null;
  color: string;
  departmentName: string | null;
}

/** GET /api/schedules 数据项：某人某天的排班（含班次名/部门名，供前端直接渲染） */
export interface ScheduleView {
  id: number;
  scheduleDate: string; // YYYY-MM-DD
  isRestDay: boolean;
  userId: number;
  userName: string;
  departmentId: number;
  departmentName: string;
  shiftId: number | null;
  shiftName: string | null;
  startTime: string | null; // HH:mm
  endTime: string | null; // HH:mm
  color: string | null;
  workHours: number; // 当日班次工时（小时，休息日为 0）
}

/** 排班变更通知载荷：前端 socket 'notification' 事件体 */
export interface ScheduleChangeNotice {
  kind: 'info';
  title: string;
  message: string;
}

/** 排班统计报表单项：某员工在某月份的排班聚合 */
export interface ScheduleStatsRow {
  userId: number;
  userName: string;
  departmentName: string;
  shiftDays: number; // 出勤班次天数（非休息）
  restDays: number; // 休息天数
  totalWorkHours: number; // 累计工时（小时，一位小数）
  avgWorkHours: number; // 日均工时（小时，一位小数，按出勤天数算）
  month: string; // YYYY-MM
}

/** 排班统计聚合入参 */
export interface ScheduleStatsOptions {
  month: string; // YYYY-MM
}

/** 周排班模板条目：某员工在周几(1=周一..7=周日)的班次或休息 */
export interface ScheduleTemplateItemView {
  id: number;
  userId: number;
  userName: string;
  weekday: number; // 1=周一 .. 7=周日
  shiftId: number | null;
  shiftName: string | null;
  isRestDay: boolean;
  color: string | null;
  departmentId: number;
  departmentName: string | null;
}

/** 周排班模板：GET /api/schedule-templates 数据项 */
export interface ScheduleTemplateView {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  items: ScheduleTemplateItemView[];
}

/** 模板条目提交入参（创建/更新模板用） */
export interface ScheduleTemplateItemInput {
  userId: number;
  weekday: number; // 1=周一 .. 7=周日
  shiftId: number | null;
  isRestDay?: boolean;
}