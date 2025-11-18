
CREATE TABLE IF NOT EXISTS quality_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL COMMENT '质检会话ID',
    rule_id INT NOT NULL COMMENT '质检规则ID',
    score DECIMAL(5, 2) NOT NULL COMMENT '具体得分',
    comment TEXT COMMENT '评语',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES quality_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES quality_rules(id) ON DELETE CASCADE,
    UNIQUE (session_id, rule_id) -- Each rule can only be scored once per session
);
