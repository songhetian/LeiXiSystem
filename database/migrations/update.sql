-- [2026-02-19] 扩展 departments 表的 status 字段定义，支持 'deleted' 状态以实现软删除。
ALTER TABLE departments MODIFY COLUMN status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active';

-- 2026-02-20 数据库索引深度优化
-- 优化原因：加速员工搜索、考勤报表聚合以及质检统计查询性能

-- 1. 加速员工姓名搜索
ALTER TABLE users ADD INDEX idx_real_name (real_name);

-- 2. 优化考勤统计：支持按员工、状态和日期范围的覆盖索引查询
ALTER TABLE attendance_records ADD INDEX idx_emp_status_date (employee_id, status, record_date);

-- 3. 优化质检报表：支持按客服、质检状态和时间的复合筛选
ALTER TABLE quality_sessions ADD INDEX idx_agent_status_time (agent_id, status, start_time);


-- 2026-02-20 数据库索引深度加固（巡检后补录）
-- 优化原因：确保 IM 历史消息分页及最后消息预览的高效查询

-- 1. 加速 IM 消息分页与预览
ALTER TABLE chat_messages ADD INDEX idx_group_id_id (group_id, id);

-- [2026-02-20] Add permissions for quality quick approval and batch operations
-- 注册权限 (补全必填字段 resource 和 action)
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('一键满分', 'quality:session:quick_approve', 'quality_session', 'quick_approve', '允许在质检详情中一键打出满分', 'quality')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('批量分配角色', 'system:role:manage_batch', 'role_assignment', 'manage_batch', '允许批量设置用户角色', 'system')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 授予超级管理员所有新权限 (动态 ID 查找)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = '超级管理员' AND p.code IN ('quality:session:quick_approve', 'system:role:manage_batch')
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- [2026-02-20] 扩展质检消息表结构，支持存储发送者姓名
-- 优化原因：修复导入时因缺少字段导致的聊天内容丢失问题
ALTER TABLE session_messages ADD COLUMN sender_name VARCHAR(100) NULL AFTER sender_type;

-- [2026-02-20] 放宽质检消息表字段约束
-- 优化原因：支持外部导入场景下 sender_id 为空的情况
ALTER TABLE session_messages MODIFY COLUMN sender_id VARCHAR(50) NULL;

-- [2026-02-22] 注册质检导出权限
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('导出质检记录', 'quality:session:export', 'quality_session', 'export', '允许导出质检会话及详情记录', 'quality')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 授予超级管理员导出权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = '超级管理员' AND p.code = 'quality:session:export'
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- [2026-02-22] 注册知识库批量管理权限
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('批量管理文档', 'knowledge:article:bulk_edit', 'knowledge_article', 'bulk_edit', '允许批量修改文档公开状态、移动分类及批量删除', 'knowledge')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- [2026-02-23] 管理知识分类权限
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('管理知识分类', 'knowledge:category:manage', 'knowledge_category', 'manage', '允许重命名、删除及切换分类公开状态', 'knowledge')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- [2026-02-25] 补全全站通知审计锚点
-- 描述：配合推送审计控制台，物理补全缺失的考勤、财务、资产及异常告警通知配置项。
INSERT IGNORE INTO notification_settings (event_type, target_roles) VALUES 
('makeup_rejection', '["申请人"]'),
('overtime_rejection', '["申请人"]'),
('reimbursement_pass', '["申请人"]'),
('reimbursement_reject', '["申请人"]'),
('reimbursement_return', '["申请人"]'),
('reimbursement_progress', '["申请人"]'),
('asset_apply', '["部门主管"]'),
('asset_return', '["部门主管"]'),
('exam_publish', '["全体员工"]'),
('exam_result', '["考生"]'),
('late_notify', '["申请人"]'),
('early_leave_notify', '["申请人"]'),
('absent_notify', '["申请人"]');

-- [2026-02-25] 注册推送审计控制台权限
-- 功能：允许管理员访问并配置各业务模块的通知分发规则
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('推送审计配置', 'system:notification:settings', 'notification_settings', 'manage', '管理全局业务通知的分发规则与角色映射', 'system')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 授予超级管理员推送审计配置权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = '超级管理员' AND p.code = 'system:notification:settings'
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- [2026-02-25] 注册备忘录管理权限
-- 功能：允许员工管理个人备忘录，允许主管/人事发送部门备忘录并进行审计。
INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('管理个人备忘录', 'user:memo:manage', 'memo', 'manage', '允许创建、修改、删除个人备忘录及标记已读', 'user')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO permissions (name, code, resource, action, description, module) 
VALUES ('管理部门备忘录', 'personnel:memo:manage', 'department_memo', 'manage', '允许发送部门/个人定向备忘录并查看阅读审计详情', 'personnel')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 授予超级管理员权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = '超级管理员' AND p.code IN ('user:memo:manage', 'personnel:memo:manage')
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 授予所有角色基础个人备忘录权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE p.code = 'user:memo:manage'
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
