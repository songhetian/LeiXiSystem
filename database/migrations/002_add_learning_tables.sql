-- ============================================
-- 数据库迁移脚本: 添加学习跟踪相关表
-- 版本: 002
-- 日期: 2024-11-16
-- 描述: 为知识库系统添加学习跟踪功能，包括学习任务、学习计划、学习统计等
-- ============================================

USE leixin_customer_service;

-- ============================================
-- 1. 创建学习任务表 (learning_tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '任务ID',
  title VARCHAR(255) NOT NULL COMMENT '任务标题',
  description TEXT COMMENT '任务描述',
  assigned_to INT NOT NULL COMMENT '分配给用户ID',
  assigned_by INT COMMENT '分配者ID',
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '任务状态',
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium' COMMENT '优先级',
  due_date DATETIME NULL COMMENT '截止日期',
  completed_at DATETIME NULL COMMENT '完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_created_at (created_at)
) COMMENT = '学习任务表';

-- ============================================
-- 2. 创建学习计划表 (learning_plans)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_plans (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '计划ID',
  title VARCHAR(255) NOT NULL COMMENT '计划标题',
  description TEXT COMMENT '计划描述',
  created_by INT NOT NULL COMMENT '创建者ID',
  assigned_to INT COMMENT '分配给用户ID',
  department_id INT NULL COMMENT '分配给部门ID',
  status ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft' COMMENT '计划状态',
  start_date DATETIME NULL COMMENT '开始日期',
  end_date DATETIME NULL COMMENT '结束日期',
  completed_at DATETIME NULL COMMENT '完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_created_by (created_by),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_department_id (department_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) COMMENT = '学习计划表';

-- ============================================
-- 3. 创建学习计划详情表 (learning_plan_details)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_plan_details (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '详情ID',
  plan_id INT NOT NULL COMMENT '计划ID',
  article_id BIGINT UNSIGNED COMMENT '知识库文章ID',
  exam_id INT COMMENT '考试ID',
  title VARCHAR(255) NOT NULL COMMENT '项目标题',
  description TEXT COMMENT '项目描述',
  order_num INT NOT NULL DEFAULT 1 COMMENT '排序',
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending' COMMENT '项目状态',
  completed_at DATETIME NULL COMMENT '完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
  INDEX idx_plan_id (plan_id),
  INDEX idx_article_id (article_id),
  INDEX idx_exam_id (exam_id),
  INDEX idx_status (status),
  INDEX idx_order_num (order_num)
) COMMENT = '学习计划详情表';

-- ============================================
-- 4. 创建学习记录表 (learning_records)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_records (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  article_id BIGINT UNSIGNED COMMENT '知识库文章ID',
  exam_id INT COMMENT '考试ID',
  plan_id INT COMMENT '学习计划ID',
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始学习时间',
  end_time DATETIME NULL COMMENT '结束学习时间',
  duration INT NULL COMMENT '学习时长(秒)',
  progress INT NOT NULL DEFAULT 0 COMMENT '学习进度(0-100)',
  status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress' COMMENT '学习状态',
  completed_at DATETIME NULL COMMENT '完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_article_id (article_id),
  INDEX idx_exam_id (exam_id),
  INDEX idx_plan_id (plan_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) COMMENT = '学习记录表';

-- ============================================
-- 5. 创建学习统计表 (learning_statistics)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '统计ID',
  user_id INT NOT NULL COMMENT '用户ID',
  date DATE NOT NULL COMMENT '统计日期',
  articles_read INT NOT NULL DEFAULT 0 COMMENT '阅读文章数',
  exams_taken INT NOT NULL DEFAULT 0 COMMENT '参加考试数',
  exams_passed INT NOT NULL DEFAULT 0 COMMENT '通过考试数',
  total_duration INT NOT NULL DEFAULT 0 COMMENT '总学习时长(秒)',
  completed_tasks INT NOT NULL DEFAULT 0 COMMENT '完成任务数',
  completed_plans INT NOT NULL DEFAULT 0 COMMENT '完成计划数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_date (user_id, date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (date)
) COMMENT = '学习统计表';

-- ============================================
-- 6. 为 knowledge_articles 表添加学习相关字段
-- ============================================
-- 添加阅读次数字段
ALTER TABLE knowledge_articles
ADD COLUMN read_count INT NOT NULL DEFAULT 0 COMMENT '阅读次数';

-- 添加平均阅读时长字段
ALTER TABLE knowledge_articles
ADD COLUMN avg_read_duration INT NOT NULL DEFAULT 0 COMMENT '平均阅读时长(秒)';

-- 添加收藏次数字段
ALTER TABLE knowledge_articles
ADD COLUMN collect_count INT NOT NULL DEFAULT 0 COMMENT '收藏次数';

-- 添加评论次数字段
ALTER TABLE knowledge_articles
ADD COLUMN comment_count INT NOT NULL DEFAULT 0 COMMENT '评论次数';

-- 添加索引优化查询性能
ALTER TABLE knowledge_articles
ADD INDEX idx_read_count (read_count);

ALTER TABLE knowledge_articles
ADD INDEX idx_collect_count (collect_count);

-- ============================================
-- 8. 创建收藏夹表 (collection_folders)
-- ============================================
CREATE TABLE IF NOT EXISTS collection_folders (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '收藏夹ID',
  user_id INT NOT NULL COMMENT '用户ID',
  name VARCHAR(100) NOT NULL COMMENT '收藏夹名称',
  description TEXT COMMENT '收藏夹描述',
  is_public BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否公开',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) COMMENT = '收藏夹表';

-- ============================================
-- 7. 创建文章收藏表 (article_collections)
-- ============================================
CREATE TABLE IF NOT EXISTS article_collections (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '收藏ID',
  user_id INT NOT NULL COMMENT '用户ID',
  article_id BIGINT UNSIGNED NOT NULL COMMENT '文章ID',
  folder_id INT NULL COMMENT '收藏夹ID',
  notes TEXT COMMENT '收藏备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES collection_folders(id) ON DELETE SET NULL,
  UNIQUE KEY uk_user_article (user_id, article_id),
  INDEX idx_user_id (user_id),
  INDEX idx_article_id (article_id),
  INDEX idx_folder_id (folder_id),
  INDEX idx_created_at (created_at)
) COMMENT = '文章收藏表';

-- ============================================
-- 9. 创建文章评论表 (article_comments)
-- ============================================
CREATE TABLE IF NOT EXISTS article_comments (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '评论ID',
  article_id BIGINT UNSIGNED NOT NULL COMMENT '文章ID',
  user_id INT NOT NULL COMMENT '用户ID',
  parent_id INT NULL COMMENT '父评论ID',
  content TEXT NOT NULL COMMENT '评论内容',
  like_count INT NOT NULL DEFAULT 0 COMMENT '点赞数',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否置顶',
  status ENUM('active', 'deleted') NOT NULL DEFAULT 'active' COMMENT '评论状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES article_comments(id) ON DELETE CASCADE,
  INDEX idx_article_id (article_id),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) COMMENT = '文章评论表';

-- ============================================
-- 10. 创建评论点赞表 (comment_likes)
-- ============================================
CREATE TABLE IF NOT EXISTS comment_likes (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '点赞ID',
  comment_id INT NOT NULL COMMENT '评论ID',
  user_id INT NOT NULL COMMENT '用户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (comment_id) REFERENCES article_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_comment_user (comment_id, user_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) COMMENT = '评论点赞表';

-- ============================================
-- 迁移完成
-- ============================================

SELECT '迁移脚本 002_add_learning_tables.sql 执行完成' AS message;
