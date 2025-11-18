
CREATE TABLE IF NOT EXISTS quality_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT '案例标题',
    category VARCHAR(255) COMMENT '案例分类',
    description TEXT COMMENT '案例描述',
    problem_description TEXT COMMENT '问题描述',
    solution TEXT COMMENT '处理方案',
    case_type ENUM('good', 'bad') COMMENT '优秀/不良案例标识',
    difficulty_level ENUM('easy', 'medium', 'hard') COMMENT '难度等级',
    priority ENUM('low', 'medium', 'high') COMMENT '优先级',
    view_count INT DEFAULT 0 COMMENT '浏览次数',
    like_count INT DEFAULT 0 COMMENT '点赞次数',
    session_id INT COMMENT '关联会话ID (可选)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES quality_sessions(id) ON DELETE SET NULL
);
