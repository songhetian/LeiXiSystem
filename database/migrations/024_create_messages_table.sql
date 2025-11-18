CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT DEFAULT NULL, -- For single chats
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- e.g., 'text', 'image', 'file', 'voice', 'video', 'system'
    file_url VARCHAR(255) DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_size INT DEFAULT NULL,
    is_recalled TINYINT(1) DEFAULT 0,
    recalled_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_conversation_id (conversation_id),
    KEY idx_sender_id (sender_id)
);
