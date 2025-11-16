-- 更新 admin 用户密码为 123456
UPDATE users
SET password_hash = '$2b$10$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq'
WHERE username = 'admin';

-- 验证更新
SELECT username, password_hash FROM users WHERE username = 'admin';
