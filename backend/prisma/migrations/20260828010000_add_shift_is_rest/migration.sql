-- 班次支持休息类型：isRest=true 表示休息班次（休息日无需打卡）
ALTER TABLE `shifts`
  ADD COLUMN `is_rest` BOOLEAN NOT NULL DEFAULT FALSE;