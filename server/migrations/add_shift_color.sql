-- 添加颜色字段
ALTER TABLE work_shifts
ADD COLUMN color VARCHAR(7) DEFAULT NULL COMMENT '班次颜色（HEX格式，如#3B82F6）';

-- 为现有班次生成随机颜色
UPDATE work_shifts
SET color = CASE
    WHEN id % 8 = 1 THEN '#3B82F6'  -- blue
    WHEN id % 8 = 2 THEN '#10B981'  -- green
    WHEN id % 8 = 3 THEN '#8B5CF6'  -- purple
    WHEN id % 8 = 4 THEN '#F59E0B'  -- orange
    WHEN id % 8 = 5 THEN '#EC4899'  -- pink
    WHEN id % 8 = 6 THEN '#6366F1'  -- indigo
    WHEN id % 8 = 7 THEN '#14B8A6'  -- teal
    ELSE '#06B6D4'  -- cyan
END
WHERE color IS NULL;
