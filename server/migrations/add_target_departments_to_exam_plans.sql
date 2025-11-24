-- 为 exam_plans 表添加 target_departments 字段
-- 执行日期: 2025-11-24
-- 说明: 支持考试计划分配到多个部门

-- 1. 添加 target_departments 字段
ALTER TABLE exam_plans
ADD COLUMN target_departments JSON COMMENT '目标部门ID列表（JSON数组）' AFTER department_id;

-- 2. 迁移现有数据（将 department_id 转换为 target_departments 数组）
UPDATE exam_plans
SET target_departments = JSON_ARRAY(department_id)
WHERE department_id IS NOT NULL AND target_departments IS NULL;

-- 验证
SELECT id, title, department_id, target_departments
FROM exam_plans
LIMIT 5;
