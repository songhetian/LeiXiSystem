-- 数据库迁移脚本：删除 exam_categories 表中的 code 和 icon 字段
-- 执行前请备份数据库！

-- 1. 删除 code 字段
ALTER TABLE exam_categories DROP COLUMN code;

-- 2. 删除 icon 字段
ALTER TABLE exam_categories DROP COLUMN icon;

-- 验证表结构
DESCRIBE exam_categories;

-- 查看剩余字段
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'exam_categories'
ORDER BY 
    ORDINAL_POSITION;
