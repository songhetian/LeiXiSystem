-- ============================================
-- 数据库迁移脚本: 为学习计划详情表添加进度字段
-- 版本: 004
-- 日期: 2024-11-16
-- 描述: 为 learning_plan_details 表添加 progress 字段用于跟踪学习进度
-- ============================================

USE leixin_customer_service;

-- ============================================
-- 为 learning_plan_details 表添加进度字段
-- ============================================
ALTER TABLE learning_plan_details
ADD COLUMN progress INT NOT NULL DEFAULT 0 COMMENT '学习进度(0-100)';

-- 添加索引优化查询性能
ALTER TABLE learning_plan_details
ADD INDEX idx_progress (progress);

-- ============================================
-- 迁移完成
-- ============================================

SELECT '迁移脚本 004_add_learning_plan_details_progress.sql 执行完成' AS message;
