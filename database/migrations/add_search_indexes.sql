-- ==========================================
-- 知识库搜索性能优化索引
-- ==========================================
-- 此脚本添加索引以优化多维度搜索功能
-- 执行前请备份数据库

START TRANSACTION;

-- 检查并添加全文索引（用于关键词搜索）
-- 注意：MySQL 5.6+ 支持 InnoDB 全文索引
-- 如果表已有全文索引，此语句会失败，可以忽略

-- 为 title, content, summary 添加全文索引
-- 注意：全文索引在中文搜索中可能效果有限，但对英文和混合内容有帮助
SET @exist_fulltext := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'ft_articles_search'
);

SET @sql_fulltext := IF(
  @exist_fulltext = 0,
  'CREATE FULLTEXT INDEX ft_articles_search ON knowledge_articles(title, content, summary)',
  'SELECT "全文索引已存在" as message'
);

PREPARE stmt_fulltext FROM @sql_fulltext;
EXECUTE stmt_fulltext;
DEALLOCATE PREPARE stmt_fulltext;

-- 添加组合索引优化多条件查询

-- 1. 分类和状态组合索引（常用于按分类筛选已发布文档）
SET @exist_cat_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_category_status'
);

SET @sql_cat_status := IF(
  @exist_cat_status = 0,
  'CREATE INDEX idx_category_status ON knowledge_articles(category_id, status)',
  'SELECT "分类状态索引已存在" as message'
);

PREPARE stmt_cat_status FROM @sql_cat_status;
EXECUTE stmt_cat_status;
DEALLOCATE PREPARE stmt_cat_status;

-- 2. 类型和状态组合索引（常用于按类型筛选）
SET @exist_type_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_type_status'
);

SET @sql_type_status := IF(
  @exist_type_status = 0,
  'CREATE INDEX idx_type_status ON knowledge_articles(type, status)',
  'SELECT "类型状态索引已存在" as message'
);

PREPARE stmt_type_status FROM @sql_type_status;
EXECUTE stmt_type_status;
DEALLOCATE PREPARE stmt_type_status;

-- 3. 创建时间索引（用于日期范围筛选和排序）
SET @exist_created := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_created_at'
);

SET @sql_created := IF(
  @exist_created = 0,
  'CREATE INDEX idx_created_at ON knowledge_articles(created_at)',
  'SELECT "创建时间索引已存在" as message'
);

PREPARE stmt_created FROM @sql_created;
EXECUTE stmt_created;
DEALLOCATE PREPARE stmt_created;

-- 4. 更新时间索引（用于日期范围筛选和排序）
SET @exist_updated := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_updated_at'
);

SET @sql_updated := IF(
  @exist_updated = 0,
  'CREATE INDEX idx_updated_at ON knowledge_articles(updated_at)',
  'SELECT "更新时间索引已存在" as message'
);

PREPARE stmt_updated FROM @sql_updated;
EXECUTE stmt_updated;
DEALLOCATE PREPARE stmt_updated;

-- 5. 作者索引（用于按作者筛选）
SET @exist_author := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_created_by'
);

SET @sql_author := IF(
  @exist_author = 0,
  'CREATE INDEX idx_created_by ON knowledge_articles(created_by)',
  'SELECT "作者索引已存在" as message'
);

PREPARE stmt_author FROM @sql_author;
EXECUTE stmt_author;
DEALLOCATE PREPARE stmt_author;

-- 6. 浏览量索引（用于按热度排序）
SET @exist_views := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_view_count'
);

SET @sql_views := IF(
  @exist_views = 0,
  'CREATE INDEX idx_view_count ON knowledge_articles(view_count)',
  'SELECT "浏览量索引已存在" as message'
);

PREPARE stmt_views FROM @sql_views;
EXECUTE stmt_views;
DEALLOCATE PREPARE stmt_views;

-- 7. 点赞数索引（用于按热度排序）
SET @exist_likes := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_like_count'
);

SET @sql_likes := IF(
  @exist_likes = 0,
  'CREATE INDEX idx_like_count ON knowledge_articles(like_count)',
  'SELECT "点赞数索引已存在" as message'
);

PREPARE stmt_likes FROM @sql_likes;
EXECUTE stmt_likes;
DEALLOCATE PREPARE stmt_likes;

-- 8. 状态索引（用于过滤已删除文档）
SET @exist_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_articles'
    AND index_name = 'idx_status'
);

SET @sql_status := IF(
  @exist_status = 0,
  'CREATE INDEX idx_status ON knowledge_articles(status)',
  'SELECT "状态索引已存在" as message'
);

PREPARE stmt_status FROM @sql_status;
EXECUTE stmt_status;
DEALLOCATE PREPARE stmt_status;

COMMIT;

-- 显示添加的索引
SELECT
  'knowledge_articles' as table_name,
  index_name,
  column_name,
  index_type
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'knowledge_articles'
  AND index_name IN (
    'ft_articles_search',
    'idx_category_status',
    'idx_type_status',
    'idx_created_at',
    'idx_updated_at',
    'idx_created_by',
    'idx_view_count',
    'idx_like_count',
    'idx_status'
  )
ORDER BY index_name, seq_in_index;

SELECT '✅ 搜索性能优化索引添加完成！' as message;
