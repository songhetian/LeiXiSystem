
CREATE TABLE IF NOT EXISTS quality_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_code VARCHAR(255) UNIQUE NOT NULL COMMENT '会话编号',
    customer_service_id INT NOT NULL COMMENT '客服人员ID',
    customer_info JSON COMMENT '客户信息',
    communication_channel VARCHAR(255) COMMENT '沟通渠道',
    duration INT COMMENT '时长（秒）',
    message_count INT COMMENT '消息数',
    quality_status VARCHAR(50) DEFAULT 'pending' COMMENT '质检状态 (pending, in_progress, completed)',
    score DECIMAL(5, 2) COMMENT '总评分',
    grade VARCHAR(50) COMMENT '质检等级',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_service_id) REFERENCES employees(id) -- Assuming an employees table exists
);
