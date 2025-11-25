-- 修改 answer_records 表的 question_id 字段类型
-- 从 INT 改为 VARCHAR(255) 以支持临时题目ID (temp_前缀)

USE leixin_customer_service;

-- 查看当前表结构和约束
SELECT '=== 当前表结构 ===' AS info;
DESCRIBE answer_records;

SELECT '=== 当前外键约束 ===' AS info;
SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'leixin_customer_service'
  AND TABLE_NAME = 'answer_records'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 1. 删除外键约束(如果存在)
-- 注意: 如果外键不存在,这个语句会报错,但不影响后续操作
SET @drop_fk = (
    SELECT CONCAT('ALTER TABLE answer_records DROP FOREIGN KEY ', CONSTRAINT_NAME, ';')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'leixin_customer_service'
      AND TABLE_NAME = 'answer_records'
      AND COLUMN_NAME = 'question_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

-- 执行删除外键(如果存在)
SET @drop_fk = IFNULL(@drop_fk, 'SELECT "没有找到question_id的外键约束" AS message;');
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 删除唯一约束(如果存在)
ALTER TABLE answer_records DROP INDEX uk_result_question;

-- 3. 删除question_id索引(如果存在)
SET @drop_idx = (
    SELECT CONCAT('ALTER TABLE answer_records DROP INDEX ', INDEX_NAME, ';')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'leixin_customer_service'
      AND TABLE_NAME = 'answer_records'
      AND COLUMN_NAME = 'question_id'
      AND INDEX_NAME != 'uk_result_question'
    LIMIT 1
);

SET @drop_idx = IFNULL(@drop_idx, 'SELECT "没有找到question_id的索引" AS message;');
PREPARE stmt FROM @drop_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 修改字段类型
ALTER TABLE answer_records
MODIFY COLUMN question_id VARCHAR(255) NOT NULL COMMENT '题目ID，支持临时ID(temp_前缀)和正式ID';

-- 5. 重新添加唯一约束
ALTER TABLE answer_records
ADD UNIQUE KEY uk_result_question (result_id, question_id);

-- 6. 添加索引
ALTER TABLE answer_records
ADD INDEX idx_question_id (question_id);

-- 验证修改
SELECT '=== 修改后的表结构 ===' AS info;
DESCRIBE answer_records;

SELECT '=== 修改完成! ===' AS message;
