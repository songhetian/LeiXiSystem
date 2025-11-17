-- Knowledge system schema (MySQL 8+)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 删除可能存在的相关表
DROP TABLE IF EXISTS article_collections;
DROP TABLE IF EXISTS article_comments;
DROP TABLE IF EXISTS comment_likes;
DROP TABLE IF EXISTS collection_folders;
DROP TABLE IF EXISTS knowledge_article_learning_records;
DROP TABLE IF EXISTS learning_records;
DROP TABLE IF EXISTS learning_plan_details;
DROP TABLE IF EXISTS knowledge_attachments;
DROP TABLE IF EXISTS my_knowledge_saved_articles;
DROP TABLE IF EXISTS knowledge_articles;
DROP TABLE IF EXISTS knowledge_categories;
DROP TABLE IF EXISTS knowledge_article_attachments;
DROP TABLE IF EXISTS knowledge_article_collections;
DROP TABLE IF EXISTS knowledge_article_comments;
-- optional users table (reference only, not created here)

CREATE TABLE knowledge_categories (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(200)    NOT NULL,
  description  TEXT            NULL,
  icon         VARCHAR(50)     NULL,
  -- ownership & visibility
  owner_id     BIGINT UNSIGNED NULL,        -- null for public/common categories
  type         ENUM('common','personal') NOT NULL DEFAULT 'common',
  is_public    TINYINT(1)      NOT NULL DEFAULT 1, -- 1 public; 0 private
  is_hidden    TINYINT(1)      NOT NULL DEFAULT 0,
  -- lifecycle
  status       ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  is_deleted   TINYINT(1)      NOT NULL DEFAULT 0,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   DATETIME        NULL,
  deleted_by   BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_cat_owner (owner_id),
  KEY idx_cat_type (type),
  KEY idx_cat_public (is_public),
  KEY idx_cat_status (status),
  KEY idx_cat_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE knowledge_articles (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title               VARCHAR(300)    NOT NULL,
  summary             VARCHAR(1000)   NULL,
  content             MEDIUMTEXT      NULL,
  attachments         MEDIUMTEXT      NULL,          -- JSON array of attachments for compatibility
  -- relations
  category_id         BIGINT UNSIGNED NULL,
  owner_id            BIGINT UNSIGNED NULL,          -- null for public/common articles or original owner
  original_article_id BIGINT UNSIGNED NULL,          -- source article id when copied into my-knowledge
  -- visibility
  type                ENUM('common','personal') NOT NULL DEFAULT 'common',
  is_public           TINYINT(1)      NOT NULL DEFAULT 1,
  -- lifecycle
  status              ENUM('draft','published','archived','deleted') NOT NULL DEFAULT 'published',
  is_deleted          TINYINT(1)      NOT NULL DEFAULT 0,
  view_count          INT UNSIGNED    NOT NULL DEFAULT 0,
  like_count          INT UNSIGNED    NOT NULL DEFAULT 0,
  notes               TEXT            NULL,          -- personal notes in my knowledge
  icon                VARCHAR(50)     NULL,
  created_by          BIGINT UNSIGNED NULL,
  updated_by          BIGINT UNSIGNED NULL,
  deleted_by          BIGINT UNSIGNED NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_art_category (category_id),
  KEY idx_art_owner (owner_id),
  KEY idx_art_type (type),
  KEY idx_art_public (is_public),
  KEY idx_art_status (status),
  KEY idx_art_deleted (is_deleted),
  KEY idx_art_original (original_article_id),
  CONSTRAINT fk_art_category FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE knowledge_attachments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id   BIGINT UNSIGNED NOT NULL,
  name         VARCHAR(255)    NOT NULL,
  url          VARCHAR(1000)   NOT NULL,
  type         VARCHAR(100)    NULL, -- MIME type
  size         BIGINT UNSIGNED NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_att_article (article_id),
  CONSTRAINT fk_att_article FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE my_knowledge_saved_articles (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  article_id   BIGINT UNSIGNED NOT NULL, -- references knowledge_articles (public or personal allowed)
  notes        TEXT            NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_article (user_id, article_id),
  KEY idx_mk_user (user_id),
  KEY idx_mk_article (article_id),
  CONSTRAINT fk_mk_article FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE article_comments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  article_id  BIGINT UNSIGNED NOT NULL COMMENT '文章ID',
  user_id     INT NOT NULL COMMENT '用户ID',
  parent_id   BIGINT UNSIGNED NULL COMMENT '父评论ID',
  content     TEXT NOT NULL COMMENT '评论内容',
  like_count  INT NOT NULL DEFAULT 0 COMMENT '点赞数',
  is_pinned   TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶',
  status      ENUM('active','deleted') NOT NULL DEFAULT 'active' COMMENT '评论状态',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_article_id (article_id),
  KEY idx_user_id (user_id),
  KEY idx_parent_id (parent_id),
  KEY idx_created_at (created_at),
  KEY idx_status (status),
  CONSTRAINT article_comments_ibfk_1
    FOREIGN KEY (article_id) REFERENCES knowledge_articles(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT article_comments_ibfk_2
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,
  CONSTRAINT article_comments_ibfk_3
    FOREIGN KEY (parent_id) REFERENCES article_comments(id)
      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
