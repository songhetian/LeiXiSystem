-- 案例库系统数据库迁移
-- 创建案例库相关的所有表

-- 1. 更新质检案例表结构
ALTER TABLE quality_cases
  ADD COLUMN IF NOT EXISTS case_type ENUM('excellent', 'poor') NOT NULL DEFAULT 'excellent' COMMENT '案例类型' AFTER category,
  ADD COLUMN IF NOT EXISTS key_points TEXT COMMENT '关键要点' AFTER solution,
  ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0 COMMENT '浏览次数' AFTER key_points,
  ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0 COMMENT '点赞次数' AFTER view_count,
  ADD COLUMN IF NOT EXISTS collect_count INT DEFAULT 0 COMMENT '收藏次数' AFTER like_count,
  ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0 COMMENT '评论次数' AFTER collect_count,
  ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态' AFTER comment_count,
  ADD COLUMN IF NOT EXISTS created_by INT COMMENT '创建人' AFTER status,
  ADD COLUMN IF NOT EXISTS updated_by INT COMMENT '更新人' AFTER created_by,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 添加索引
ALTER TABLE quality_cases
  ADD INDEX IF NOT EXISTS idx_case_type (case_type),
  ADD INDEX IF NOT EXISTS idx_status (status),
  ADD INDEX IF NOT EXISTS idx_created_by (created_by);

-- 添加全文索引（用于搜索）
ALTER TABLE quality_cases
  ADD FULLTEXT INDEX IF NOT EXISTS ft_search (title, problem_description, solution);

-- 2. 创建案例标签关联表
CREATE TABLE IF NOT EXISTS case_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  tag_id INT NOT NULL COMMENT '标签ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_case_tag (case_id, tag_id),
  INDEX idx_case_id (case_id),
  INDEX idx_tag_id (tag_id),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例标签关联表';

-- 3. 创建案例附件表
CREATE TABLE IF NOT EXISTS case_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  file_name VARCHAR(255) NOT NULL COMMENT '文件名',
  file_type VARCHAR(50) NOT NULL COMMENT '文件类型: image/document/audio/video',
  file_size BIGINT NOT NULL COMMENT '文件大小(字节)',
  file_url VARCHAR(500) NOT NULL COMMENT '文件URL',
  thumbnail_url VARCHAR(500) COMMENT '缩略图URL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_case_id (case_id),
  INDEX idx_file_type (file_type),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例附件表';

-- 4. 创建案例评论表
CREATE TABLE IF NOT EXISTS case_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  user_id INT NOT NULL COMMENT '用户ID',
  parent_id INT COMMENT '父评论ID（用于回复）',
  content TEXT NOT NULL COMMENT '评论内容',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES case_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例评论表';

-- 5. 创建案例收藏表
CREATE TABLE IF NOT EXISTS case_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  user_id INT NOT NULL COMMENT '用户ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_case (user_id, case_id),
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例收藏表';

-- 6. 创建案例学习记录表
CREATE TABLE IF NOT EXISTS case_learning_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  user_id INT NOT NULL COMMENT '用户ID',
  learning_duration INT DEFAULT 0 COMMENT '学习时长(秒)',
  completed BOOLEAN DEFAULT FALSE COMMENT '是否完成学习',
  last_position INT DEFAULT 0 COMMENT '最后学习位置',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_case (user_id, case_id),
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  INDEX idx_completed (completed),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例学习记录表';

-- 7. 创建案例点赞记录表（用于防止重复点赞）
CREATE TABLE IF NOT EXISTS case_likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL COMMENT '案例ID',
  user_id INT NOT NULL COMMENT '用户ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_case (user_id, case_id),
  INDEX idx_case_id (case_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例点赞记录表';

-- 8. 创建评论点赞记录表
CREATE TABLE IF NOT EXISTS comment_likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  comment_id INT NOT NULL COMMENT '评论ID',
  user_id INT NOT NULL COMMENT '用户ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_comment (user_id, comment_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (comment_id) REFERENCES case_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论点赞记录表';
