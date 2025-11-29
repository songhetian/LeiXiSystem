-- 修改质检会话表，添加外键约束
USE leixin_customer_service;

-- 1. 添加新的外键字段
ALTER TABLE `quality_sessions`
ADD COLUMN `platform_id` INT NULL COMMENT '平台ID，关联platforms表' AFTER `shop`;

ALTER TABLE `quality_sessions`
ADD COLUMN `shop_id` INT NULL COMMENT '店铺ID，关联shops表' AFTER `platform_id`;

-- 2. 为新字段添加索引
ALTER TABLE `quality_sessions`
ADD KEY `idx_platform_id` (`platform_id`);

ALTER TABLE `quality_sessions`
ADD KEY `idx_shop_id` (`shop_id`);

-- 3. 添加外键约束
ALTER TABLE `quality_sessions`
ADD CONSTRAINT `fk_quality_sessions_platform_id` FOREIGN KEY (`platform_id`) REFERENCES `platforms` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quality_sessions`
ADD CONSTRAINT `fk_quality_sessions_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. 更新现有数据，将平台和店铺名称映射到对应的ID
-- 首先更新platform_id
UPDATE quality_sessions qs
JOIN platforms p ON qs.platform = p.name
SET qs.platform_id = p.id
WHERE qs.platform_id IS NULL;

-- 然后更新shop_id
UPDATE quality_sessions qs
JOIN shops s ON qs.shop = s.name
SET qs.shop_id = s.id
WHERE qs.shop_id IS NULL;

-- 5. 修改字段为非空（如果需要的话）
-- ALTER TABLE `quality_sessions` MODIFY `platform_id` INT NOT NULL;
-- ALTER TABLE `quality_sessions` MODIFY `shop_id` INT NOT NULL;

-- 6. 添加检查约束确保数据一致性（可选）
-- ALTER TABLE `quality_sessions` ADD CONSTRAINT `chk_platform_shop_consistency`
-- CHECK ((platform_id IS NOT NULL AND shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM shops WHERE id = shop_id AND platform_id = platform_id)) OR (platform_id IS NULL AND shop_id IS NULL));
