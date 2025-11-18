
CREATE TABLE case_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    user_id INT NOT NULL COMMENT '评论用户ID',
    comment_content TEXT NOT NULL COMMENT '评论内容',
    parent_comment_id INT COMMENT '父评论ID (用于回复)',
    like_count INT DEFAULT 0 COMMENT '点赞次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE, -- Assuming an employees table exists
    FOREIGN KEY (parent_comment_id) REFERENCES case_comments(id) ON DELETE CASCADE
);
