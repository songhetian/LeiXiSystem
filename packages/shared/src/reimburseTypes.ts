/** 报销模块共享类型（服务端与前端共用） */

/** 报销类别：系统级配置，无部门隔离 */
export interface ReimburseCategoryView {
  id: number;
  name: string; // unique
  isActive: boolean;
  description: string | null;
}

/** 报销分项：挂在报销单下，每项一个类别 + 金额 + 备注 */
export interface ReimburseItemView {
  id: number;
  reimburseId: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  note: string | null;
}

/** GET /api/reimburses 数据项：报销单（含主类别与分项，总额为分项之和，服务端计算） */
export interface ReimburseView {
  id: number;
  categoryId: number | null; // 主类别（取首条分项类别）
  categoryName: string | null;
  reason: string;
  amount: number; // 分项金额之和（服务端计算，不信任前端）
  status: string; // pending | approved | rejected
  applicantId: number;
  departmentId: number;
  applicantName: string;
  departmentName: string;
  createdAt: string; // 创建时间 ISO，供仪表盘/统计按月聚合
  items: ReimburseItemView[];
}

/**
 * 报销分项提交入参：创建报销时一次性提交的分项（至少 1 条）。
 * 注：Prisma 结构化类型单独放在 shared 以兼容闭环。
 */
export interface ReimburseItemInput {
  categoryId: number;
  amount: number;
  note?: string;
}