-- Create external_agents table
CREATE TABLE IF NOT EXISTS `external_agents` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '外部客服ID',
  `name` varchar(100) NOT NULL COMMENT '客服姓名',
  `platform_id` int DEFAULT NULL COMMENT '所属平台ID',
  `shop_id` int DEFAULT NULL COMMENT '所属店铺ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name_platform_shop` (`name`, `platform_id`, `shop_id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='外部客服表-存储导入的非系统客服人员';

-- Update quality_sessions to support external agents and customer names
ALTER TABLE `quality_sessions` MODIFY COLUMN `agent_id` int NULL COMMENT '客服人员用户ID (系统用户)';
ALTER TABLE `quality_sessions` ADD COLUMN `external_agent_id` int DEFAULT NULL COMMENT '外部客服ID (导入用户)' AFTER `agent_id`;
ALTER TABLE `quality_sessions` ADD COLUMN `customer_name` varchar(100) DEFAULT NULL COMMENT '客户姓名' AFTER `customer_id`;
ALTER TABLE `quality_sessions` ADD CONSTRAINT `fk_quality_sessions_external_agent` FOREIGN KEY (`external_agent_id`) REFERENCES `external_agents` (`id`) ON DELETE SET NULL;
