-- 创建消息状态表
CREATE TABLE IF NOT EXISTS `message_status` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `message_id` INT NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `status` ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_message_user` (`message_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 添加索引以提高查询性能
CREATE INDEX `idx_user_status` ON `message_status`(`user_id`, `status`);
CREATE INDEX `idx_message_id` ON `message_status`(`message_id`);