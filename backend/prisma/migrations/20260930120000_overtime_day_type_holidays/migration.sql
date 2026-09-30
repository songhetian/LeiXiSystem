-- 加班按日类型拆分 + 节假日日历 + 无薪假拆分 + 有薪假标记
--
-- 【背景】审查报告 P0-2 / P1-4 / P2-9（docs/reviews/2026-09-30-hidden-defects.md）：
--   1. 引擎里「平日 1.5 / 休息日 2 / 法定 3 倍」的规则从未生效——日报/月报只有单一
--      overtime_minutes / overtime_hours 汇总，算薪只能把它整块当平日处理；
--      且完全没有「节假日/调休工作日」数据来源，日期本身推不出当天性质。
--   2. 全勤奖口径要求「有薪假除外」，但 vacation_types 没有有薪标记，无法识别。
--   3. 餐补按「出勤天数」，而请假日被计入了出勤天数。
--
-- 【兼容与回填】所有新列都有默认值，且回填策略保持历史行为不变：
--   - 历史加班时长一律视为「平日加班」（无法追溯历史日类型），保证金额不跳变；
--   - is_paid 默认 false（按无薪处理），因此历史请假天数全部计入 unpaid_leave_*，
--     与「任何请假都取消全勤奖」的既有口径一致；
--   - 内置的有薪类型（annual/sick/compensatory）由第 6 步显式置为有薪，
--     其余类型保持 false，由 HR 在假期类型上按需勾选。

-- 1) 节假日 / 调休工作日日历
CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `day_type` ENUM('holiday', 'rest', 'workday') NOT NULL DEFAULT 'holiday',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `holidays_date_idx`(`date`),
    UNIQUE INDEX `holidays_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) 日报：加班按日类型拆分 + 无薪假天数
ALTER TABLE `attendance_daily`
    ADD COLUMN `overtime_weekday_minutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overtime_weekend_minutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overtime_holiday_minutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `unpaid_leave_days` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- 3) 月报：加班按日类型拆分 + 无薪假分钟数
ALTER TABLE `attendance_monthly`
    ADD COLUMN `unpaid_leave_minutes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overtime_weekday_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `overtime_weekend_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `overtime_holiday_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0;

-- 4) 假期类型：有薪标记
ALTER TABLE `vacation_types`
    ADD COLUMN `is_paid` BOOLEAN NOT NULL DEFAULT false;

-- 5) 回填（保持历史口径不跳变）
UPDATE `attendance_daily`
   SET `overtime_weekday_minutes` = `overtime_minutes`
 WHERE `overtime_minutes` > 0;

UPDATE `attendance_daily`
   SET `unpaid_leave_days` = `leave_days`
 WHERE `leave_days` > 0;

UPDATE `attendance_monthly`
   SET `overtime_weekday_hours` = `overtime_hours`
 WHERE `overtime_hours` > 0;

UPDATE `attendance_monthly`
   SET `unpaid_leave_minutes` = `leave_minutes`
 WHERE `leave_minutes` > 0;

-- 6) 已知的有薪假类型（与 prisma/seed.ts 的内置类型一致）显式置为有薪。
--    不置的话年假/病假会按「无薪」取消全勤奖，与 CONTEXT.md「有薪假除外」矛盾。
UPDATE `vacation_types`
   SET `is_paid` = true
 WHERE `code` IN ('annual', 'sick', 'compensatory');
