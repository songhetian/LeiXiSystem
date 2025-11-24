-- 考核计划多部门选择功能数据库迁移
-- 执行日期: 2025-11-24
-- 说明: 字段已存在，只需清空测试数据

-- 1. 清空现有测试数据（根据用户要求）
-- 注意：这将删除所有考核计划及相关记录

-- 先删除 answer_records
DELETE FROM answer_records;

-- 删除考试记录
DELETE FROM assessment_results;

-- 删除考核计划
DELETE FROM assessment_plans;

-- 2. 重置自增ID（可选）
ALTER TABLE assessment_plans AUTO_INCREMENT = 1;
ALTER TABLE assessment_results AUTO_INCREMENT = 1;

-- 验证字段存在
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'assessment_plans'
  AND COLUMN_NAME IN ('target_users', 'target_departments');
