/** 工作台仪表盘共享类型（服务端聚合，前端只消费一个接口） */

/** GET /api/dashboard/stats 响应：一次返回多模块关键指标。
 *  后端按「当前用户部门 scope」隔离，并按各模块 view 权限条件收敛（无权限的指标为 0 / 空）。
 */
export interface DashboardStatsView {
  /** 当前统计月份 YYYY-MM（趋势/考勤概览均以本月为准） */
  month: string;
  /** 待办审批汇总：只统计有对应审批权限的模块 */
  approvals: {
    leave: number;
    overtime: number;
    makeup: number;
    reimburse: number;
    total: number;
  };
  /** 考勤本月概览 */
  attendance: {
    /** 本月打卡记录数 */
    records: number;
    /** 本月迟到异常数 */
    late: number;
    /** 本月早退异常数 */
    earlyLeave: number;
    /** 本月缺卡异常数 */
    missingPunch: number;
    /** 本月缺勤异常数 */
    absent: number;
  };
  /** 月度趋势：本月各核心模块发起量/时长/金额 */
  trend: {
    leaves: number; // 本月请假发起数
    makeupCount: number; // 本月补卡发起数
    overtimeHours: number; // 本月已批准加班累计时长（小时）
    reimburseCount: number; // 本月报销发起数
    reimburseAmount: number; // 本月报销金额总额
  };
  /** 规模与排行 */
  scale: {
    /** 作用域内部门数 */
    departments: number;
    /** 作用域内员工数 */
    employees: number;
    /** 本月报销金额 Top4 类别 */
    topCategories: { name: string; amount: number }[];
  };
}