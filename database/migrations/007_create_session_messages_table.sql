
CREATE TABLE IF NOT EXISTS session_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL COMMENT '质检会话ID',
    message_content TEXT NOT NULL COMMENT '消息内容',
    sender_type VARCHAR(50) NOT NULL COMMENT '发送者类型 (customer, agent)',
    content_type VARCHAR(50) DEFAULT 'text' COMMENT '内容类型 (text, image, file, audio, video)',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES quality_sessions(id) ON DELETE CASCADE
);
