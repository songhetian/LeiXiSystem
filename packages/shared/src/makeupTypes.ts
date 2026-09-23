/** 补卡模块共享类型（服务端与前端共用） */

/** 补卡申请单项：含审批状态与申请人/部门名 */
export interface MakeupView {
  id: number;
  recordDate: string; // 需补卡的日期 YYYY-MM-DD
  clockType: string; // check_in | check_out
  clockTime: string; // 补卡时间 HH:mm
  reason: string;
  status: string; // pending | approved | rejected
  applicantId: number;
  departmentId: number;
  applicantName: string;
  departmentName: string;
}