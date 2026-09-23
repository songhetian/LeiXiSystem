/** 部门管理模块共享类型（服务端与前端共用） */

/** GET /api/departments 数据项：部门（parentId 为 null 表示根/顶级部门） */
export interface DepartmentView {
  id: number;
  name: string;
  parentId: number | null;
}