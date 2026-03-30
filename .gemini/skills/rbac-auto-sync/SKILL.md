---
name: rbac-auto-sync
description: 自动同步 RBAC 权限体系。当开发新功能并定义权限标识（Permission Code）时，本技能会自动生成 SQL 录入权限、将其绑定到“超级管理员”（Role ID: 33），并同步追加到 database/migrations/update.sql 中。
---

# RBAC Auto Sync

本技能确保系统新功能的权限标识与数据库及迁移脚本保持强一致性。

## 触发场景
当你执行以下操作时必须激活本技能：
- 在 `Sidebar.jsx` 中添加带有 `permission` 字段的新菜单项。
- 在后端路由中添加新的权限校验点（`requirePermission`）。
- 用户明确要求“添加某功能的权限控制”。

## 执行规范

### 1. SQL 生成模版
对于每一个新权限标识（如 `module:feature:action`），生成以下 SQL：

```sql
-- [YYYY-MM-DD HH:mm:ss] 新增功能权限: {功能名称}
INSERT INTO permissions (name, code, resource, action, module) 
VALUES ('{名称}', '{标识}', '{资源}', '{操作}', '{模块}')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 自动绑定给超级管理员 (ID: 33)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 33, id FROM permissions WHERE code = '{标识}'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE rp.role_id = 33 AND p.code = '{标识}'
);
```

### 2. 自动化流程
1. **本地执行**：使用 MySQL 凭据（root/123456）在 `leixin_customer_service` 库中运行生成的 SQL。
2. **物理归档**：将上述 SQL 语句追加到 `database/migrations/update.sql` 文件末尾。

## 核心参数
- **超级管理员 ID**: 33
- **数据库**: leixin_customer_service
- **文件路径**: database/migrations/update.sql
