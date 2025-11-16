USE leixin_customer_service;

CREATE TABLE IF NOT EXISTS learning_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT NOT NULL,
  assigned_by INT,
  status ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  due_date DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS learning_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  assigned_to INT,
  department_id INT NULL,
  status ENUM('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft',
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_created_by (created_by),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_department_id (department_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS learning_plan_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_id INT NOT NULL,
  article_id INT,
  exam_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_num INT NOT NULL DEFAULT 1,
  status ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE SET NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
  INDEX idx_plan_id (plan_id),
  INDEX idx_article_id (article_id),
  INDEX idx_exam_id (exam_id),
  INDEX idx_status (status),
  INDEX idx_order_num (order_num)
);

CREATE TABLE IF NOT EXISTS learning_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  article_id INT,
  exam_id INT,
  plan_id INT,
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME NULL,
  duration INT NULL,
  progress INT NOT NULL DEFAULT 0,
  status ENUM('in_progress','completed','abandoned') NOT NULL DEFAULT 'in_progress',
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
);

CREATE TABLE IF NOT EXISTS learning_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  articles_read INT NOT NULL DEFAULT 0,
  exams_taken INT NOT NULL DEFAULT 0,
  exams_passed INT NOT NULL DEFAULT 0,
  total_duration INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,
  completed_plans INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_date (user_id, date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (date)
);

-- 为 knowledge_articles 表添加索引（如果不存在）
-- 注意：列已经存在，只需添加索引
SET @index_exists := (SELECT COUNT(*) FROM information_schema.statistics
                      WHERE table_schema = 'leixin_customer_service'
                      AND table_name = 'knowledge_articles'
                      AND index_name = 'idx_read_count');

SET @sql := IF(@index_exists = 0,
               'ALTER TABLE knowledge_articles ADD INDEX idx_read_count (read_count)',
               'SELECT "Index idx_read_count already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.statistics
                      WHERE table_schema = 'leixin_customer_service'
                      AND table_name = 'knowledge_articles'
                      AND index_name = 'idx_collect_count');

SET @sql := IF(@index_exists = 0,
               'ALTER TABLE knowledge_articles ADD INDEX idx_collect_count (collect_count)',
               'SELECT "Index idx_collect_count already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS collection_folders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS article_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  article_id INT NOT NULL,
  folder_id INT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES collection_folders(id) ON DELETE SET NULL,
  UNIQUE KEY uk_user_article (user_id, article_id),
  INDEX idx_user_id (user_id),
  INDEX idx_article_id (article_id),
  INDEX idx_folder_id (folder_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS article_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_id INT NULL,
  content TEXT NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('active','deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES article_comments(id) ON DELETE CASCADE,
  INDEX idx_article_id (article_id),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS comment_likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES article_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_comment_user (comment_id, user_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS knowledge_article_learning_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  article_id INT NOT NULL,
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME NULL,
  duration INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  status ENUM('in_progress','completed','abandoned') NOT NULL DEFAULT 'in_progress',
  completed_at DATETIME NULL,
  last_position TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_article (user_id, article_id),
  INDEX idx_user_id (user_id),
  INDEX idx_article_id (article_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS knowledge_learning_plan_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME NULL,
  duration INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  status ENUM('in_progress','completed','abandoned') NOT NULL DEFAULT 'in_progress',
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_plan (user_id, plan_id),
  INDEX idx_user_id (user_id),
  INDEX idx_plan_id (plan_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

SELECT 'Migration script executed successfully' AS message;
