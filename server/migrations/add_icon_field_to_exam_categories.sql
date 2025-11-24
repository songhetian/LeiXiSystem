-- 为 exam_categories 表添加 icon 字段
-- 执行日期: 2025-11-24

-- 检查并添加 icon 字段
SET @dbname = DATABASE();
SET @tablename = "exam_categories";
SET @columnname = "icon";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(100) NULL COMMENT '图标名称' AFTER code")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 为已存在的记录随机分配图标
UPDATE exam_categories
SET icon = ELT(
  FLOOR(1 + RAND() * 20),
  'folder', 'category', 'label', 'bookmark', 'star',
  'favorite', 'grade', 'class', 'dashboard', 'assessment',
  'assignment', 'book', 'library_books', 'description', 'article',
  'topic', 'subject', 'school', 'work', 'business_center'
)
WHERE icon IS NULL OR icon = '';

-- 说明
-- 1. icon: 图标名称，用于显示分类图标
-- 2. 为已存在的记录随机分配 Material Design 图标
