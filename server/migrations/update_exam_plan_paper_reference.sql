-- 考试计划数据库调整
-- 删除 exam_papers 表，使用现有的 exams 表

-- 1. 删除 exam_papers 表（如果存在）
DROP TABLE IF EXISTS exam_papers;

-- 2. 修改 exam_plans 表的 paper_id 外键
-- 先删除旧的外键约束（如果存在）
SET @constraint_name = (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exam_plans'
    AND COLUMN_NAME = 'paper_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);

SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE exam_plans DROP FOREIGN KEY ', @constraint_name),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加新的外键约束，关联到 exams 表
ALTER TABLE exam_plans
  ADD CONSTRAINT fk_exam_plans_exams
  FOREIGN KEY (paper_id) REFERENCES exams(id)
  ON DELETE SET NULL;

-- 说明：
-- 1. 删除了 exam_papers 表，不再需要单独的试卷表
-- 2. exam_plans.paper_id 现在直接关联到 exams.id
-- 3. 使用现有的试卷管理系统中的试卷
