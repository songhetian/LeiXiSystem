import { EmployeeStatus } from '@prisma/client';

/**
 * 「在职」口径：正式 + 试用期。
 *
 * 额度和跨年结转初始化、考勤/报表统计、排班矩阵、设备打卡同步必须共用同一口径：
 * - 排班矩阵若漏掉试用期员工 → 试用期员工排不了班 → 依「未排班不允许打卡」规则根本无法打卡；
 * - 设备打卡同步若漏掉试用期员工 → 其打卡记录被整体静默丢弃；
 * - 统计报表若口径不一致 → 试用期员工出现在报表里但「应休」恒为 0。
 */
export const ACTIVE_EMPLOYEE_STATUSES: EmployeeStatus[] = [
  EmployeeStatus.active,
  EmployeeStatus.probation,
];