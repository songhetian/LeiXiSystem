-- T23 系统参数 KV 表（设置界面后端存储）
-- 仅新增 system_setting 表 + 默认参数种子 + 设置管理权限，不涉及历史表变更

CREATE TABLE `system_setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group` VARCHAR(50) NOT NULL DEFAULT 'general',
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `label` VARCHAR(100) NULL,
    `description` VARCHAR(255) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `system_setting_key_key`(`key`),
    INDEX `system_setting_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 默认系统参数
INSERT INTO `system_setting` (`group`, `key`, `value`, `label`, `description`, `is_public`, `updated_at`) VALUES
  ('general', 'companyName', '雷犀科技', '公司名称', NULL, 0, NOW()),
  ('general', 'companyLogo', '', '公司Logo地址', NULL, 1, NOW()),
  ('attendance', 'workTimeStart', '09:00', '上班时间', NULL, 1, NOW()),
  ('attendance', 'workTimeEnd', '18:00', '下班时间', NULL, 1, NOW()),
  ('security', 'passwordMinLength', '8', '密码最小长度', NULL, 0, NOW()),
  ('security', 'loginFailMax', '5', '登录失败上限(次)', NULL, 0, NOW()),
  ('security', 'jwtExpiresIn', '2h', '登录Token有效期', NULL, 0, NOW());

-- 设置管理权限 + 绑定 admin 角色（幂等：仅当 admin 角色存在时绑定，避免依赖硬编码 role_id）
INSERT INTO `permissions` (`code`, `name`, `module`, `type`) VALUES
  ('system:setting:update', '系统设置管理', 'system', 'api');
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
  SELECT r.`id`, LAST_INSERT_ID() FROM `roles` r WHERE r.`code` = 'admin' LIMIT 1;
