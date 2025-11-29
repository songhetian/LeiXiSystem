-- Make agent_id nullable and add name columns to quality_sessions
ALTER TABLE `quality_sessions` MODIFY COLUMN `agent_id` int NULL COMMENT '客服人员用户ID，关联users表，级联删除';
ALTER TABLE `quality_sessions` ADD COLUMN `agent_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客服姓名（用于导入外部数据）' AFTER `agent_id`;
ALTER TABLE `quality_sessions` ADD COLUMN `customer_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户姓名' AFTER `customer_id`;
