CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id INT PRIMARY KEY,
    receive_system TINYINT(1) DEFAULT 1,
    receive_department TINYINT(1) DEFAULT 1,
    sound_on TINYINT(1) DEFAULT 1,
    dnd_start VARCHAR(5) NULL,
    dnd_end VARCHAR(5) NULL,
    toast_duration INT DEFAULT 5000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);