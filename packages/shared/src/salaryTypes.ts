/** 薪资模块共享类型（服务端与前端共用） */

/** GET /api/salaries 数据项：薪资单（含发薪员工名/部门名，供前端直接渲染） */
export interface SalaryView {
  id: number;
  month: string; // YYYY-MM 薪资所属月份
  basic: number; // 基本工资
  bonus: number; // 绩效/奖金
  deduction: number; // 扣除
  net: number; // 实发 = basic + bonus - deduction（服务端计算）
  userId: number;
  departmentId: number;
  employeeName: string;
  departmentName: string;
}