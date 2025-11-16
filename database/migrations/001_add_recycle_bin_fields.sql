-- ============================================
-- 数据库迁移脚本: 添加回收站相关字段
-- 版本: 001
-- 日期: 2024-11-11
-- 描述: 为 knowledge_categories 和 knowledge_articles 表添加软删除支持
-- ============================================

USE leixin_customer_service;

-- ============================================
-- 1. 修改 knowledge_categories 表
-- ============================================

-- 添加 deleted_at 字段
ALTER TABLE knowledge_categories
ADD COLUMN deleted_at DATETIME NULL COMMENT '删除时间' AFTER updated_at;

-- 添加 deleted_by 字段
ALTER TABLE knowledge_categories
ADD COLUMN deleted_by INT(11) NULL COMMENT '删除者ID' AFTER deleted_at;

-- 添加索引优化回收站查询性能
ALTER TABLE knowledge_categories
ADD INDEX idx_deleted_at (deleted_at);

-- 添加外键约束
ALTER TABLE knowledge_categories
ADD CONSTRAINT fk_knowledge_categories_deleted_by
FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 2. 修改 knowledge_articles 表
-- ============================================

-- 修改 status 枚举，添加 'deleted' 选项
ALTER TABLE knowledge_articles
MODIFY COLUMN status ENUM('draft', 'published', 'archived', 'deleted')
NOT NULL DEFAULT 'draft'
COMMENT '文章状态：draft-草稿，published-已发布，archived-已归档，deleted-已删除';

-- 添加 deleted_at 字段
ALTER TABLE knowledge_articles
ADD COLUMN deleted_at DATETIME NULL COMMENT '删除时间' AFTER updated_at;

-- 添加 deleted_by 字段
ALTER TABLE knowledge_articles
ADD COLUMN deleted_by INT(11) NULL COMMENT '删除者ID' AFTER deleted_at;

-- 添加组合索引优化回收站查询
ALTER TABLE knowledge_articles
ADD INDEX idx_status_deleted (status, deleted_at);

-- 添加外键约束
ALTER TABLE knowledge_articles
ADD CONSTRAINT fk_knowledge_articles_deleted_by
FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 3. 添加其他优化索引
-- ============================================

-- 优化按分类和状态查询
ALTER TABLE knowledge_articles
ADD INDEX idx_category_status (category_id, status);

-- 优化按类型和状态查询
ALTER TABLE knowledge_articles
ADD INDEX idx_type_status (type, status);

-- ============================================
-- 迁移完成
-- ============================================

SELECT '迁移脚本 001_add_recycle_bin_fields.sql 执行完成' AS message;
