-- T23 系统参数历史记录表（配置版本管理与回滚）
-- 记录每次系统配置的变更，支持版本回滚和审计追踪

CREATE TABLE `system_setting_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `changed_by` INTEGER NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_setting_history_setting_key_idx`(`setting_key`),
    INDEX `system_setting_history_changed_by_idx`(`changed_by`),
    INDEX `system_setting_history_changed_at_idx`(`changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
