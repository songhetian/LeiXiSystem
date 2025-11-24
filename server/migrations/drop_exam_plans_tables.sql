-- 删除 exam_plans 相关表
-- 执行日期: 2025-11-24
-- 说明: 统一使用 assessment_plans 表

-- 1. 删除相关数据
DROP TABLE IF EXISTS exam_plan_logs;
DROP TABLE IF EXISTS exam_records;
DROP TABLE IF EXISTS exam_plans;

-- 验证
SHOW TABLES LIKE '%exam%';
SHOW TABLES LIKE '%assessment%';
