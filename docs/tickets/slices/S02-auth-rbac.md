# S02 · 认证与权限（登录端到端）

## What to build
登录 → 签发 JWT（httpOnly cookie）→ 前端拿到当前用户/权限 → 菜单按权限渲染；后端 RBAC 守卫保护接口（无 token 401、无权限 403）。

## 进度（2026-08-12 完成 ✅）
- [x] Prisma schema：users/roles/permissions/user_roles/role_permissions 五表（migrate init 完成）
- [x] **TDD 循环（auth e2e 6 用例全绿）**：login 200+Set-Cookie / 密码错 401+5001 / 未登录 401+5002 / 带 token me 200 / 有权限 200 / 无权限 403+5003
- [x] JWT httpOnly cookie + SameSite=Lax；@HttpCode(200)；guard 手动解析 cookie 头
- [x] 测试栈：**vitest → jest + ts-jest**（esbuild 不支持 emitDecoratorMetadata，Nest 注入失效）；dev 模式 tsx → **ts-node**（同因）
- [ ] 前端登录页 + AuthProvider + 菜单权限渲染（前端侧，与 S14 权限配置配套推进）

## 五维清单
- **数据库**：users/roles/permissions/user_roles/role_permissions（✅ 已建）
- **后端接口**：POST /auth/login、POST /auth/refresh（待做）、GET /auth/me、POST /auth/logout（待做）；JwtAuthGuard + PermissionGuard；错误码 5001/5002/5003
- **业务算法**：RBAC 权限判定 + 部门范围计算（数据隔离注入基础，ADR-0010）
- **前端页面**：登录页（Arco Form + Zod 校验）；AuthProvider；401 统一跳登录
- **单元测试**：API e2e（✅ 6 用例）

## Acceptance criteria
- [x] 正确账号可登录，错误密码返回 5001
- [x] 未登录访问受保护接口返回 401
- [ ] 前端菜单随权限变化（管理员 vs 员工）——前端侧待做
- [x] JWT 走 httpOnly cookie + SameSite=Lax

## Blocked by
- S01 基础设施骨架
