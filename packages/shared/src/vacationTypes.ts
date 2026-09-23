/** 请假额度体系共享类型（服务端与前端共用） */

/** 请假类型（系统级配置）行视图 */
export interface LeaveTypeView {
  id: number;
  name: string; // 如：年假 / 事假 / 病假
  unit: string; // day | hour
  allowance: number; // 年度默认额度
  isActive: boolean;
  description: string | null;
}

/** 年度请假额度：某员工某年某类型的可用/已用额度 */
export interface LeaveQuotaView {
  id: number;
  userId: number;
  year: number;
  leaveTypeId: number;
  leaveTypeName: string;
  allowance: number; // 该年可用额度
  used: number; // 该年已用
  remaining: number; // allowance - used
}

/** 年度请假趋势：按月聚合已审请假量（用于前端柱状图） */
export interface LeaveTrendPoint {
  month: number; // 1-12
  count: number; // 该月请假天数合计
}