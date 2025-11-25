-- 简化版本: 修改 answer_records 表的 question_id 字段类型
-- 从 INT 改为 VARCHAR(255) 以支持临时题目ID (temp_前缀)

USE leixin_customer_service;

-- 先清空表数据(因为字段类型改变,旧数据可能无效)
TRUNCATE TABLE answer_records;

-- 删除唯一约束
ALTER TABLE answer_records DROP INDEX IF EXISTS uk_result_question;

-- 删除普通索引
ALTER TABLE answer_records DROP INDEX IF EXISTS idx_question_id;

-- 修改字段类型
ALTER TABLE answer_records
MODIFY COLUMN question_id VARCHAR(255) NOT NULL COMMENT '题目ID，支持临时ID(temp_前缀)和正式ID';

-- 重新添加唯一约束
ALTER TABLE answer_records
ADD UNIQUE KEY uk_result_question (result_id, question_id);

-- 添加索引
ALTER TABLE answer_records
ADD INDEX idx_question_id (question_id);

-- 验证修改
DESCRIBE answer_records;

SELECT '✅ answer_records表字段类型修改完成!' AS message;
