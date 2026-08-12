# S14 · 系统管理（用户/角色/权限/日志/公告）

## What to build
系统管理闭环：用户管理（分配角色/部门）、角色与权限点管理（菜单+按钮，RBAC）、操作日志查询、公告发布。

## 五维清单
- **数据库**：users/roles/permissions/role_permissions/role_departments/user_departments/operation_logs/broadcasts/broadcast_recipients（保留表迁移）
- **后端接口**：用户 CRUD + 角色分配、角色 CRUD + 权限点勾选、GET /system/logs（操作日志）、公告 CRUD + 发布
- **业务算法**：权限点集合计算；操作日志 AOP 记录（写操作自动留痕）
- **前端页面**：system feature（用户管理/角色管理/权限点配置/日志页/公告页）
- **单元测试**：API e2e（角色变更后权限即时生效、日志记录完整）

## Acceptance criteria
- [ ] 用户/角色/权限点配置闭环，权限变更即时生效
- [ ] 核心写操作均有日志（操作人/时间/内容）
- [ ] 公告发布后全员可见（通知联动 S11）

## Blocked by
- S02 认证与权限
