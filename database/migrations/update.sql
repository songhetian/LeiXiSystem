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
