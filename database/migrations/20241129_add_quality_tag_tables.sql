-- ==========================================
-- 质检标签系统数据库迁移脚本
-- 创建时间: 2024-11-29
-- 功能: 支持无限极分类的质检标签系统
-- ==========================================

-- 1. 修改 tag_categories 表，添加无限极分类支持
ALTER TABLE `tag_categories`
ADD COLUMN `parent_id` INT DEFAULT NULL COMMENT '父分类ID，NULL表示根分类' AFTER `id`,
ADD COLUMN `level` INT NOT NULL DEFAULT 0 COMMENT '分类层级，0为根节点' AFTER `parent_id`,
ADD COLUMN `path` VARCHAR(500) DEFAULT NULL COMMENT '分类路径，如1/2/3，便于查询子树' AFTER `level`,
ADD KEY `idx_parent_id` (`parent_id`),
ADD KEY `idx_level` (`level`),
ADD KEY `idx_path` (`path`(255)),
ADD CONSTRAINT `fk_tag_categories_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tag_categories` (`id`) ON DELETE CASCADE;

-- 2. 修改 tags 表，添加无限极分类和类型支持
ALTER TABLE `tags`
ADD COLUMN `parent_id` INT DEFAULT NULL COMMENT '父标签ID，NULL表示根标签' AFTER `id`,
ADD COLUMN `level` INT NOT NULL DEFAULT 0 COMMENT '标签层级，0为根节点' AFTER `parent_id`,
ADD COLUMN `path` VARCHAR(500) DEFAULT NULL COMMENT '标签路径，如1/2/3，便于查询子树' AFTER `level`,
ADD COLUMN `tag_type` ENUM('quality', 'case', 'general') NOT NULL DEFAULT 'general' COMMENT '标签类型：quality-质检，case-案例，general-通用' AFTER `name`,
ADD KEY `idx_parent_id` (`parent_id`),
ADD KEY `idx_level` (`level`),
ADD KEY `idx_path` (`path`(255)),
ADD KEY `idx_tag_type` (`tag_type`),
ADD CONSTRAINT `fk_tags_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE;

-- 3. 创建质检会话标签关联表
CREATE TABLE IF NOT EXISTS `quality_session_tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `session_id` INT NOT NULL COMMENT '质检会话ID，关联quality_sessions表',
  `tag_id` INT NOT NULL COMMENT '标签ID，关联tags表',
  `created_by` INT DEFAULT NULL COMMENT '创建人用户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_tag` (`session_id`, `tag_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_tag_id` (`tag_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_session_tags_session_id` FOREIGN KEY (`session_id`) REFERENCES `quality_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_session_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_session_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检会话标签关联表';

-- 4. 创建质检消息标签关联表
CREATE TABLE IF NOT EXISTS `quality_message_tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '关联记录唯一标识ID',
  `message_id` INT NOT NULL COMMENT '消息ID，关联session_messages表',
  `tag_id` INT NOT NULL COMMENT '标签ID，关联tags表',
  `created_by` INT DEFAULT NULL COMMENT '创建人用户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_tag` (`message_id`, `tag_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_tag_id` (`tag_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_quality_message_tags_message_id` FOREIGN KEY (`message_id`) REFERENCES `session_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_message_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quality_message_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检消息标签关联表';

-- 5. 输出确认信息
SELECT '质检标签系统表结构创建完成' AS 'Status';
