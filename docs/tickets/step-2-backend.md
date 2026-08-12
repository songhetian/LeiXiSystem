# Ticket: step-2 — 后端（NestJS + Fastify + Prisma）

> 对应 REFACTOR_PLAN.md 第 7.2 节

## 背景

后端从裸 Fastify + mysql2 重写为 NestJS 模块化架构。业务逻辑全部下沉 services，routes 保持薄层。

## 待办

### 2.1 骨架与横切（先做）
- [ ] bootstrap：Fastify adapter + 全局 ZodValidationPipe + pino 日志 + @nestjs/config
- [ ] JWT 认证 + RBAC 权限守卫（权限点从旧 `permissions` 表迁移）
- [ ] 统一响应/异常过滤器（错误码、message 规范）
- [ ] Socket.IO 网关（通知/公告推送）

### 2.2 业务模块（按优先级串行移植）
- [ ] auth：登录/刷新/当前用户
- [ ] employees：员工/部门/职位（含导入导出，复用 exceljs）
- [ ] attendance：班次/排班/请假/加班/调休/休假额度
- [ ] payroll：薪资项目配置/工资条（导入式先保留）
- [ ] expense：报销 + 审批流
- [ ] system：用户/角色/权限点/审批流/操作日志
- [ ] training：知识库（文章/分类/附件，KKFileView 预览对接）
- [ ] notifications：通知/公告/待办

### 2.3 纪律
- [ ] 每个模块：controller（薄）+ service（业务逻辑）+ Prisma 访问
- [ ] DTO 全部来自 packages/shared 的 Zod schema
- [ ] 旧代码仅作参考，禁止复制粘贴实现（可参考业务规则）

## 完成标准

- [ ] 核心接口用 Apifox/Postman 跑通（auth → employees → attendance）
- [ ] 权限守卫生效（越权请求 403）
- [ ] 错误信息规范统一
