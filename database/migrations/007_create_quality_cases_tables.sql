-- 创建质检案例相关表

-- 1. 质检案例主表
CREATE TABLE IF NOT EXISTS quality_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NULL COMMENT '关联的会话ID',
    title VARCHAR(255) NOT NULL COMMENT '案例标题',
    description TEXT COMMENT '案例描述',
    category VARCHAR(100) COMMENT '案例分类',
    difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium' COMMENT '难度等级',
    problem_description TEXT COMMENT '问题描述',
    solution TEXT COMMENT '解决方案',
    key_points TEXT COMMENT '关键要点',
    tags VARCHAR(500) COMMENT '标签（逗号分隔）',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    like_count INT DEFAULT 0 COMMENT '点赞次数',
    favorite_count INT DEFAULT 0 COMMENT '收藏次数',
    share_count INT DEFAULT 0 COMMENT '分享次数',
    status ENUM('draft', 'published', 'archived') DEFAULT 'published' COMMENT '状态',
    created_by INT COMMENT '创建人ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (session_id) REFERENCES quality_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category (category),
    INDEX idx_difficulty (difficulty_level),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质检案例表';

-- 2. 案例收藏表
CREATE TABLE IF NOT EXISTS quality_case_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NOT NULL COMMENT '用户ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_case (user_id, case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_case_id (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例收藏表';

-- 3. 案例点赞表
CREATE TABLE IF NOT EXISTS quality_case_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NOT NULL COMMENT '用户ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_case (user_id, case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_case_id (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例点赞表';

-- 4. 案例浏览记录表
CREATE TABLE IF NOT EXISTS quality_case_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NULL COMMENT '用户ID（可为空，支持匿名浏览）',
    ip_address VARCHAR(45) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_case_id (case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例浏览记录表';

-- 5. 案例评论表
CREATE TABLE IF NOT EXISTS quality_case_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NOT NULL COMMENT '评论用户ID',
    parent_id INT NULL COMMENT '父评论ID（用于回复）',
    content TEXT NOT NULL COMMENT '评论内容',
    like_count INT DEFAULT 0 COMMENT '点赞数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES quality_case_comments(id) ON DELETE CASCADE,
    INDEX idx_case_id (case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例评论表';

-- 6. 案例附件表
CREATE TABLE IF NOT EXISTS quality_case_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    file_name VARCHAR(255) NOT NULL COMMENT '文件名',
    file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
    file_type VARCHAR(50) COMMENT '文件类型',
    file_size BIGINT COMMENT '文件大小（字节）',
    uploaded_by INT COMMENT '上传人ID',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_case_id (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例附件表';

-- 7. 案例学习记录表
CREATE TABLE IF NOT EXISTS quality_case_learning_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NOT NULL COMMENT '用户ID',
    start_time TIMESTAMP NULL COMMENT '开始学习时间',
    end_time TIMESTAMP NULL COMMENT '结束学习时间',
    duration INT COMMENT '学习时长（秒）',
    progress INT DEFAULT 0 COMMENT '学习进度（0-100）',
    completed BOOLEAN DEFAULT FALSE COMMENT '是否完成',
    notes TEXT COMMENT '学习笔记',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_case (user_id, case_id),
    INDEX idx_user_id (user_id),
    INDEX idx_case_id (case_id),
    INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例学习记录表';
