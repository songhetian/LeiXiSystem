-- ==========================================
-- 平台和店铺测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 清理已存在的测试数据
DELETE FROM `shops` WHERE `platform_id` IN (SELECT id FROM `platforms` WHERE `name` IN ('京东', '淘宝', '拼多多'));
DELETE FROM `platforms` WHERE `name` IN ('京东', '淘宝', '拼多多');

-- 插入平台数据
INSERT INTO `platforms` (`name`, `created_at`) VALUES
('京东', NOW()),
('淘宝', NOW()),
('拼多多', NOW());

-- 获取平台ID
SET @platform_jd_id = (SELECT id FROM `platforms` WHERE `name` = '京东' LIMIT 1);
SET @platform_tb_id = (SELECT id FROM `platforms` WHERE `name` = '淘宝' LIMIT 1);
SET @platform_pdd_id = (SELECT id FROM `platforms` WHERE `name` = '拼多多' LIMIT 1);

-- 插入店铺数据
INSERT INTO `shops` (`name`, `platform_id`, `created_at`) VALUES
-- 京东店铺
('京东旗舰店', @platform_jd_id, NOW()),
('京东专营店', @platform_jd_id, NOW()),
('京东自营店', @platform_jd_id, NOW()),

-- 淘宝店铺
('淘宝旗舰店', @platform_tb_id, NOW()),
('淘宝专营店', @platform_tb_id, NOW()),

-- 拼多多店铺
('拼多多旗舰店', @platform_pdd_id, NOW()),
('拼多多专营店', @platform_pdd_id, NOW());

-- 输出确认信息
SELECT '平台和店铺数据插入完成' AS 'Status';
SELECT p.name AS platform_name, s.name AS shop_name
FROM `shops` s
LEFT JOIN `platforms` p ON s.platform_id = p.id
ORDER BY p.id, s.id;
