CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL COMMENT '通知类型: system, department, user',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'text' COMMENT '内容格式: text, rich_text, image, link, mixed',
    image_url VARCHAR(255) NULL,
    link_url VARCHAR(255) NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'medium' COMMENT '优先级: low, medium, high, urgent',
    sender_id INT NULL COMMENT '发送者ID，关联users表',
    department_id INT NULL COMMENT '部门ID，关联departments表，部门通知时使用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' COMMENT '通知状态: active, inactive, expired'
);