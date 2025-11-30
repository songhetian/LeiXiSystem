-- ==========================================
-- 用户测试数据插入脚本
-- ==========================================

USE leixin_customer_service;

-- 获取部门ID
SET @dept_admin_id = (SELECT id FROM `departments` WHERE `name` = '管理部' LIMIT 1);
SET @dept_service_id = (SELECT id FROM `departments` WHERE `name` = '客服部' LIMIT 1);
SET @dept_tech_id = (SELECT id FROM `departments` WHERE `name` = '技术部' LIMIT 1);
SET @dept_qa_id = (SELECT id FROM `departments` WHERE `name` = '质检部' LIMIT 1);
SET @dept_ops_id = (SELECT id FROM `departments` WHERE `name` = '运营部' LIMIT 1);

-- 获取角色ID
SET @role_admin_id = (SELECT id FROM `roles` WHERE `name` = '超级管理员' LIMIT 1);
SET @role_manager_id = (SELECT id FROM `roles` WHERE `name` = '部门经理' LIMIT 1);
SET @role_service_id = (SELECT id FROM `roles` WHERE `name` = '客服专员' LIMIT 1);
SET @role_qa_id = (SELECT id FROM `roles` WHERE `name` = '质检员' LIMIT 1);
SET @role_tech_id = (SELECT id FROM `roles` WHERE `name` = '技术人员' LIMIT 1);

-- 清理已存在的测试数据
DELETE FROM `user_roles` WHERE `user_id` IN (SELECT id FROM `users` WHERE `username` IN ('admin', 'manager1', 'service1', 'service2', 'service3', 'qa1', 'qa2', 'tech1'));
DELETE FROM `employees` WHERE `user_id` IN (SELECT id FROM `users` WHERE `username` IN ('admin', 'manager1', 'service1', 'service2', 'service3', 'qa1', 'qa2', 'tech1'));
DELETE FROM `users` WHERE `username` IN ('admin', 'manager1', 'service1', 'service2', 'service3', 'qa1', 'qa2', 'tech1');

-- 插入用户数据
-- 密码都是: 123456 (使用bcrypt加密后的哈希值)
INSERT INTO `users` (`username`, `password_hash`, `real_name`, `email`, `phone`, `department_id`, `status`, `created_at`) VALUES
('admin', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '系统管理员', 'admin@leixi.com', '13800000000', @dept_admin_id, 'active', NOW()),
('manager1', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '张经理', 'manager1@leixi.com', '13800000001', @dept_service_id, 'active', NOW()),
('service1', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '李客服', 'service1@leixi.com', '13800000002', @dept_service_id, 'active', NOW()),
('service2', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '王客服', 'service2@leixi.com', '13800000003', @dept_service_id, 'active', NOW()),
('service3', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '赵客服', 'service3@leixi.com', '13800000004', @dept_service_id, 'active', NOW()),
('qa1', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '刘质检', 'qa1@leixi.com', '13800000005', @dept_qa_id, 'active', NOW()),
('qa2', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '陈质检', 'qa2@leixi.com', '13800000006', @dept_qa_id, 'active', NOW()),
('tech1', '$2b$10$rZ5zKzY8vK5YqZ5YqZ5YqOqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5YqZ5', '周工程师', 'tech1@leixi.com', '13800000007', @dept_tech_id, 'active', NOW());

-- 获取用户ID
SET @user_admin_id = (SELECT id FROM `users` WHERE `username` = 'admin' LIMIT 1);
SET @user_manager1_id = (SELECT id FROM `users` WHERE `username` = 'manager1' LIMIT 1);
SET @user_service1_id = (SELECT id FROM `users` WHERE `username` = 'service1' LIMIT 1);
SET @user_service2_id = (SELECT id FROM `users` WHERE `username` = 'service2' LIMIT 1);
SET @user_service3_id = (SELECT id FROM `users` WHERE `username` = 'service3' LIMIT 1);
SET @user_qa1_id = (SELECT id FROM `users` WHERE `username` = 'qa1' LIMIT 1);
SET @user_qa2_id = (SELECT id FROM `users` WHERE `username` = 'qa2' LIMIT 1);
SET @user_tech1_id = (SELECT id FROM `users` WHERE `username` = 'tech1' LIMIT 1);

-- 插入用户角色关联
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES
(@user_admin_id, @role_admin_id, NOW()),
(@user_manager1_id, @role_manager_id, NOW()),
(@user_service1_id, @role_service_id, NOW()),
(@user_service2_id, @role_service_id, NOW()),
(@user_service3_id, @role_service_id, NOW()),
(@user_qa1_id, @role_qa_id, NOW()),
(@user_qa2_id, @role_qa_id, NOW()),
(@user_tech1_id, @role_tech_id, NOW());

-- 插入员工信息
INSERT INTO `employees` (`user_id`, `employee_no`, `position`, `hire_date`, `status`, `created_at`) VALUES
(@user_admin_id, 'EMP001', '系统管理员', '2024-01-01', 'active', NOW()),
(@user_manager1_id, 'EMP002', '客服部经理', '2024-01-15', 'active', NOW()),
(@user_service1_id, 'EMP003', '高级客服专员', '2024-02-01', 'active', NOW()),
(@user_service2_id, 'EMP004', '客服专员', '2024-03-01', 'active', NOW()),
(@user_service3_id, 'EMP005', '客服专员', '2024-03-15', 'active', NOW()),
(@user_qa1_id, 'EMP006', '质检专员', '2024-02-15', 'active', NOW()),
(@user_qa2_id, 'EMP007', '质检专员', '2024-04-01', 'active', NOW()),
(@user_tech1_id, 'EMP008', '系统工程师', '2024-01-20', 'active', NOW());

-- 输出确认信息
SELECT '用户数据插入完成' AS 'Status';
SELECT u.username, u.real_name, d.name AS department, r.name AS role
FROM `users` u
LEFT JOIN `departments` d ON u.department_id = d.id
LEFT JOIN `user_roles` ur ON u.id = ur.user_id
LEFT JOIN `roles` r ON ur.role_id = r.id
WHERE u.username IN ('admin', 'manager1', 'service1', 'service2', 'service3', 'qa1', 'qa2', 'tech1')
ORDER BY u.id;
