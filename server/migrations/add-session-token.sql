-- 添加session_token字段到users表
-- 用于实现单设备登录限制

ALTER TABLE users
ADD COLUMN session_token VARCHAR(500) DEFAULT NULL COMMENT '当前会话token，用于单设备登录',
ADD COLUMN session_created_at DATETIME DEFAULT NULL COMMENT '会话创建时间';

-- 添加索引以提高查询性能
CREATE INDEX idx_session_token ON users(session_token);

-- 说明：
-- session_token: 存储当前有效的登录token
-- 当用户在新设备登录时，会生成新的session_token并覆盖旧的
-- 旧设备的token将失效，前端检测到后会自动退出
