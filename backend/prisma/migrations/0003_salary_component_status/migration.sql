-- AlterTable: 将 salary_components.enabled (布尔) 改为 status (字符串)
ALTER TABLE `salary_components` ADD COLUMN `status` VARCHAR(30) DEFAULT 'active';

-- 数据迁移：将 enabled=true 转为 'active', enabled=false 转为 'inactive'
UPDATE `salary_components` SET `status` = CASE WHEN `enabled` = true THEN 'active' ELSE 'inactive' END;

-- 删除旧字段
ALTER TABLE `salary_components` DROP COLUMN `enabled`;