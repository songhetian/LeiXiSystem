-- 为 exam_categories 表添加 code 字段
-- 执行日期: 2025-11-23

-- 检查并添加 code 字段
SET @dbname = DATABASE();
SET @tablename = "exam_categories";
SET @columnname = "code";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(100) NULL COMMENT '分类编码'")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 为已存在的记录生成 code
UPDATE exam_categories
SET code = CONCAT('CAT_', id, '_', SUBSTRING(MD5(RAND()), 1, 8))
WHERE code IS NULL OR code = '';

-- 将 code 字段设置为 NOT NULL 和 UNIQUE
ALTER TABLE exam_categories MODIFY COLUMN code VARCHAR(100) NOT NULL;

-- 添加唯一索引
SET @indexname = "idx_code";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE UNIQUE INDEX ", @indexname, " ON ", @tablename, "(code)")
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- 说明
-- 1. code: 分类编码，用于唯一标识分类
-- 2. 为已存在的记录自动生成唯一编码
-- 3. 添加唯一索引确保编码不重复
