-- ==========================================
-- 数据库诊断查询脚本
-- 用于检查数据是否正确插入
-- ==========================================

-- 1. 检查部门数据
SELECT '=== 部门数据 ===' as info;
SELECT id, name, description, sort_order FROM departments ORDER BY sort_order;
SELECT CONCAT('部门总数: ', COUNT(*)) as summary FROM departments;

-- 2. 检查职位数据
SELECT '=== 职位数据 ===' as info;
SELECT name, level FROM positions ORDER BY level DESC, name;
SELECT CONCAT('职位总数: ', COUNT(*)) as summary FROM positions;

-- 3. 检查权限数据
SELECT '=== 权限数据 ===' as info;
SELECT module, COUNT(*) as count FROM permissions GROUP BY module ORDER BY module;
SELECT CONCAT('权限总数: ', COUNT(*)) as summary FROM permissions;

-- 4. 检查角色数据
SELECT '=== 角色数据 ===' as info;
SELECT id, name, description, is_system FROM roles;
SELECT CONCAT('角色总数: ', COUNT(*)) as summary FROM roles;

-- 5. 检查用户数据
SELECT '=== 用户数据 ===' as info;
SELECT u.id, u.username, u.real_name, d.name as department, u.status
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
ORDER BY u.id;
SELECT CONCAT('用户总数: ', COUNT(*)) as summary FROM users;

-- 6. 检查员工数据
SELECT '=== 员工数据 ===' as info;
SELECT e.id, e.employee_no, u.real_name, e.position, e.status, e.rating
FROM employees e
JOIN users u ON e.user_id = u.id
ORDER BY e.id;
SELECT CONCAT('员工总数: ', COUNT(*)) as summary FROM employees;

-- 7. 检查用户角色绑定
SELECT '=== 用户角色绑定 ===' as info;
SELECT u.username, u.real_name, r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
ORDER BY u.id;
SELECT CONCAT('用户角色绑定总数: ', COUNT(*)) as summary FROM user_roles;

-- 8. 检查角色权限数量
SELECT '=== 角色权限统计 ===' as info;
SELECT r.name as role_name, COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.id;

-- 9. 检查是否有错误的外键关系
SELECT '=== 检查外键完整性 ===' as info;

-- 检查用户的department_id是否都有效
SELECT CONCAT('无效部门ID的用户数: ', COUNT(*)) as invalid_dept_users
FROM users u
WHERE u.department_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = u.department_id);

-- 检查员工的user_id是否都有效
SELECT CONCAT('无效用户ID的员工数: ', COUNT(*)) as invalid_user_employees
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id);

-- 检查user_roles的关系是否有效
SELECT CONCAT('无效的用户角色绑定数: ', COUNT(*)) as invalid_user_roles
FROM user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ur.user_id)
   OR NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = ur.role_id);

-- ==========================================
-- 预期结果:
-- 部门: 6个
-- 职位: 13个
-- 权限: 38个
-- 角色: 4个
-- 用户: 10个
-- 员工: 10个
-- 用户角色绑定: 10个
-- 超级管理员权限: 38个
-- ==========================================
