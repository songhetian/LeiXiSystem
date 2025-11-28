-- ============================================
-- 雷犀客服系统 - 数据库安全配置脚本
-- ============================================
-- 用途: 创建一个只有必要权限的专用数据库账号
-- 使用方法: 使用 root 或管理员账号执行此脚本
-- ============================================

-- 1. 创建专用应用账号
-- 注意: 请修改密码为强密码
CREATE USER IF NOT EXISTS 'leixi_app'@'%' IDENTIFIED BY '123456';

-- 2. 授予必要的数据库权限
-- 只授予 SELECT, INSERT, UPDATE, DELETE 权限，不授予 DROP, CREATE 等危险权限
GRANT SELECT, INSERT, UPDATE, DELETE ON leixin_customer_service.* TO 'leixi_app'@'%';

-- 3. 如果需要执行存储过程（可选）
-- GRANT EXECUTE ON leixin_customer_service.* TO 'leixi_app'@'%';

-- 4. 刷新权限
FLUSH PRIVILEGES;

-- ============================================
-- 验证权限
-- ============================================
-- 查看新账号的权限
SHOW GRANTS FOR 'leixi_app'@'%';

-- ============================================
-- 权限说明
-- ============================================
-- ✅ 已授予的权限:
--    - SELECT: 查询数据
--    - INSERT: 插入数据
--    - UPDATE: 更新数据
--    - DELETE: 删除数据
--
-- ❌ 未授予的危险权限:
--    - DROP: 删除表/数据库
--    - CREATE: 创建表/数据库
--    - ALTER: 修改表结构
--    - GRANT: 授予权限给其他用户
--    - SUPER: 超级管理员权限
--
-- 这样即使配置文件泄露，攻击者也无法:
--    ❌ 删除整个数据库
--    ❌ 修改表结构
--    ❌ 创建后门账号
--    ❌ 执行系统命令

-- ============================================
-- 限制访问IP（推荐）
-- ============================================
-- 如果只需要从特定IP访问，可以替换上面的 '%' 为具体IP
-- 例如: 只允许从 192.168.2.3 访问
-- DROP USER IF EXISTS 'leixi_app'@'%';
-- CREATE USER 'leixi_app'@'192.168.2.3' IDENTIFIED BY 'LeiXi@2024!SecurePass';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON leixin_customer_service.* TO 'leixi_app'@'192.168.2.3';
-- FLUSH PRIVILEGES;

-- ============================================
-- 密码强度建议
-- ============================================
-- ✅ 好的密码示例:
--    - LeiXi@2024!SecurePass
--    - Cs$Mgmt#2024!Strong
--    - App!User@LX2024#
--
-- ❌ 不好的密码:
--    - root
--    - 123456
--    - password
--    - tian
