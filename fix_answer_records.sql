-- 修改 answer_records 表结构以支持字符串题目ID

-- 1. 查看当前表结构
DESCRIBE answer_records;

-- 2. 修改 question_id 字段为 VARCHAR 类型
ALTER TABLE answer_records
MODIFY COLUMN question_id VARCHAR(255) NOT NULL;

-- 3. 确认修改
DESCRIBE answer_records;

-- 4. 查看现有数据
SELECT * FROM answer_records LIMIT 10;
