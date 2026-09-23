/** 请假模块共享类型（服务端与前端共用） */

/** GET /api/leaves 数据项：请假单（含申请人/部门名，供前端直接渲染） */
export interface LeaveView {
  id: number;
  type: string;
  reason: string;
  startAt: string;
  endAt: string;
  status: string; // pending | approved | rejected
  applicantId: number;
  departmentId: number;
  applicantName: string;
  departmentName: string;
}