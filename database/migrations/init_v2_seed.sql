SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

# 1. 物理结构由原始 DDL 保持 (此处略，保持原文件结构)
# ... (原文件中的 DROP/CREATE 语句) ...

# 2. 物理注入核心运行元数据
# ------------------------------------------------------------

# 转储表 departments
INSERT INTO `departments` (`id`, `name`, `parent_id`, `description`, `manager_id`, `status`, `sort_order`, `created_at`) VALUES
(1, '管理部', NULL, '系统核心管理中枢', NULL, 'active', 1, NOW());

# 转储表 positions
INSERT INTO `positions` (`id`, `name`, `department_id`, `description`, `status`, `created_at`) VALUES
(1, '超级管理员', 1, '具备全系统物理操控权限', 'active', NOW());

# 转储表 roles
INSERT INTO `roles` (`id`, `name`, `description`, `level`, `is_system`, `created_at`) VALUES
(1, '超级管理员', '系统最高权限拥有者', 1, 1, NOW());

# 转储表 permissions (物理还原核心种子数据)
INSERT INTO `permissions` (`id`, `name`, `code`, `resource`, `action`, `description`, `module`, `created_at`) VALUES
(1, '系统控制台', 'system:dashboard:admin', 'dashboard', 'view', '查看企业看板', 'system', NOW()),
(2, '用户管理', 'user:employee:view', 'employee', 'view', '查看员工列表', 'user', NOW()),
(3, '角色管理', 'system:role:view', 'role', 'view', '查看角色权限', 'system', NOW());

# 转储表 role_permissions (物理授权闭环)
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1, 1), (1, 2), (1, 3);

# 转储表 users (管理员账号：admin/123456)
INSERT INTO `users` (`id`, `username`, `password_hash`, `real_name`, `status`, `department_id`, `created_at`) VALUES
(1, 'admin', '$2b$10$Gg7I/ImQq/BdLJpaHHVTC.ASi5QcoQg9JymoZJqfaT/O2O.Jz1tQG', '超级管理员', 'active', 1, NOW());

# 转储表 user_roles (身份物理绑定)
INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (1, 1);

# 转储表 employees (管理员档案闭环)
INSERT INTO `employees` (`id`, `user_id`, `employee_no`, `hire_date`, `position_id`, `status`, `created_at`) VALUES
(1, 1, 'ADMIN001', '2026-01-01', 1, 'active', NOW());

SET FOREIGN_KEY_CHECKS = 1;
