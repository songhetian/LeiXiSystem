# S02 · 认证与权限（登录端到端）

## What to build
登录 → 签发 JWT（httpOnly cookie）→ 前端拿到当前用户/权限 → 菜单按权限渲染；后端 RBAC 守卫保护接口（无 token 401、无权限 403）。

## 五维清单
- **数据库**：users/roles/permissions/user_roles/role_permissions（保留表迁移）
- **后端接口**：POST /auth/login、POST /auth/refresh、GET /auth/me、POST /auth/logout；JwtAuthGuard + PermissionGuard；错误码 5001/5002/5003
- **业务算法**：RBAC 权限判定 + 部门范围计算（数据隔离注入基础，ADR-0010）
- **前端页面**：登录页（Arco Form + Zod 校验）；AuthProvider；401 统一跳登录
- **单元测试**：API e2e（登录成功/密码错 5001/token 过期 5002/无权限 403）

## Acceptance criteria
- [ ] 正确账号可登录，错误密码返回 5001
- [ ] 未登录访问受保护接口返回 401
- [ ] 前端菜单随权限变化（管理员 vs 员工）
- [ ] JWT 走 httpOnly cookie + SameSite=Lax，刷新 token 旋转正常

## Blocked by
- S01 基础设施骨架
