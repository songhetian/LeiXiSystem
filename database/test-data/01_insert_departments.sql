-- ==========================================
-- 部门测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 清理已存在的测试数据
DELETE FROM `departments` WHERE `name` IN ('管理部', '客服部', '技术部', '质检部', '运营部');

-- 插入部门数据
INSERT INTO `departments` (`name`, `parent_id`, `description`, `status`, `sort_order`, `created_at`) VALUES
('管理部', NULL, '公司管理层部门，负责公司整体运营和战略规划', 'active', 1, NOW()),
('客服部', NULL, '客户服务部门，负责处理客户咨询和售后服务', 'active', 2, NOW()),
('技术部', NULL, '技术研发部门，负责系统开发和技术支持', 'active', 3, NOW()),
('质检部', NULL, '质量检查部门，负责客服质量监控和评估', 'active', 4, NOW()),
('运营部', NULL, '运营管理部门，负责业务运营和数据分析', 'active', 5, NOW());

-- 输出确认信息
SELECT '部门数据插入完成' AS 'Status';
SELECT * FROM `departments` ORDER BY `sort_order`;
