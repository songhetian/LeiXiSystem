/** 节假日模块共享类型（服务端与前端共用） */

/** 节假日单项（系统级配置，按年管理）：GET/POST/PUT/DELETE /api/holidays */
export interface HolidayView {
  id: number;
  year: number; // 所属年份（冗余自 date）
  date: string; // YYYY-MM-DD（全局唯一）
  name: string; // 名称：国庆节 / 公司团建 / 调休…
  type: string; // national | company | rest
}