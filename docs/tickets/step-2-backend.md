# Ticket: step-2 — 后端（NestJS + Fastify + Prisma）

> 对应 REFACTOR_PLAN.md 第 7.2 节
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 背景

后端从裸 Fastify + mysql2 重写为 NestJS 模块化架构。业务逻辑全部下沉 services，routes 保持薄层。

## 待办

### 2.1 骨架与横切（先做）

- [x] bootstrap：Fastify adapter（`@nestjs/platform-fastify`）+ 全局 `ValidationPipe`
      （`main.ts:71`）+ helmet/cookie/multipart 注册 + `@nestjs/config`
      ⚠️ 原计划写「全局 ZodValidationPipe」——实际全局用 `@nestjs/common` 的 `ValidationPipe`，
      Zod 仅用于 env 校验与部分 DTO schema（`*.schemas.ts`）。
- [x] JWT 认证 + RBAC 权限守卫 —— `backend/src/auth/` + `common/permission-cache.service.ts`；
      权限点来自 `permissions` 表，越权返回规范错误码（见 step 完成标准）
- [x] 统一响应/异常过滤器 —— `common/interceptors/response-envelope.interceptor.ts`
      + `common/filters/all-exceptions.filter.ts` + `error-codes.ts` / `error-messages.ts`
- [x] Socket.IO 网关（通知/公告推送）—— `backend/src/realtime/realtime.gateway.ts`

### 2.2 业务模块（按优先级串行移植）

- [x] auth：登录/刷新/当前用户
- [x] employees：员工/部门/职位（含导入导出，exceljs）
- [x] attendance：班次/排班/请假/加班/调休/休假额度
- [x] payroll：薪资项目配置/工资条（导入式先保留）
- [x] reimbursement：报销 + 审批流（计划写 `expense`，实际命名 `reimbursement`）
- [x] system：用户/角色/权限点/审批流/操作日志（审批流实际独立为 `approval/` 模块）
- [x] knowledge：知识库（文章/分类/附件）——**预览方案已改为浏览器原生**（ADR-0015 取代 ADR-0012/KKFileView）
- [x] notification：通知/公告/待办
- [x] 额外落地（超出原计划）：`dashboard`、`finance`、`performance`、`helpdesk`、
      `reports`、`settings`、`files`（OSS 驱动 `files/oss-storage.driver.ts`）、`health`

### 2.3 纪律

- [x] 每个模块：controller（薄）+ service（业务逻辑）+ Prisma 访问
- [ ] DTO 全部来自 packages/shared 的 Zod schema —— **未达成**：DTO 就近在后端
      `backend/src/**/dto/`，`shared` 只导出 `employeeNoSchema`（与 step-1 的遗留一致）
- [x] 旧代码仅作参考，禁止复制粘贴实现 —— `common/module-boundary.spec.ts` 会扫描
      生产源码 import 强制模块边界（禁止跨模块直接 import Service），`di-injection.spec.ts` 校验注入元数据

## 完成标准

- [x] 核心接口跑通（auth → employees → attendance）—— `tests/` 下 82 个 e2e/unit 用例覆盖，
      含 `auth.e2e` / `employees.e2e` / `attendance-daily.e2e`
- [x] 权限守卫生效（越权请求 403）—— `tests/idor.e2e.test.ts`、`data-scope.unit.test.ts`、
      `schedules-idor.e2e.test.ts`、`knowledge-download-idor.e2e.test.ts` 等 IDOR 用例
- [x] 错误信息规范统一 —— `common/error-codes.ts` + `error-messages.ts` + `error.util.ts`
- [x] 全局请求/异常：响应信封 `response-envelope.test.ts` 通过

## 与计划不一致 / 遗留

1. **DTO 未上收 shared**：与 step-1 同源问题。当前后端 DTO 就近维护，前端校验规则另写，
   存在两处规则漂移风险；需要一次决策（继续就近 vs 上收 shared）。
2. **模块命名差异**：计划 `expense` → 实际 `reimbursement`；审批流计划在 `system` 内 →
   实际独立 `approval/` 模块（更干净，但文档需同步）。
3. **Zod 定位变化**：全局校验是 class-validator 系 `ValidationPipe`，Zod 退居 env + 局部 schema；
   文档「全局 ZodValidationPipe」的措辞应改写。
4. **知识库预览**：KKFileView 未落地，改为浏览器原生（ADR-0015），部署不再需要 Java/LibreOffice 预览服务。
