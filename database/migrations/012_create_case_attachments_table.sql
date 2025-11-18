
CREATE TABLE case_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL COMMENT '案例ID',
    file_name VARCHAR(255) NOT NULL COMMENT '文件名称',
    file_type VARCHAR(100) COMMENT '文件类型 (e.g., image/jpeg, application/pdf)',
    file_size INT COMMENT '文件大小 (bytes)',
    file_url VARCHAR(2048) NOT NULL COMMENT '文件存储URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE
);
