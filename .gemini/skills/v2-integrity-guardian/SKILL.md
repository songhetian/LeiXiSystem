---
name: v2-integrity-guardian
description: 强制执行逻辑闭环与安全性审计。在完成任何 v2-web 代码重构或修改后激活，确保权限、缓存、事务和异步任务完全闭环。
---

# 雷犀系统 v2 逻辑闭环守卫 (Integrity Guardian)

在执行完任何 `v2-web` 下的代码修改后，必须按照本守则进行“闭环验证”。

## 一、 闭环验证四维度 (The Four Pillars)

### 1. 权限隔离闭环 (Security)
*   **严禁 Placeholder**：严禁出现 `userId || 1`。所有受保护路由必须通过 `preHandler` 校验 JWT 及 RBAC 权限。
*   **物理隔离**：涉及查询时，必须在 Prisma `where` 子句中强制包含 `department_id`（除非是超级管理员）。

### 2. 缓存一致性闭环 (Cache)
*   **精准清理**：禁止使用 `keys *` 或模糊匹配。必须建立 Key 映射表，在写入数据时，物理清理精确的 Redis Key。
*   **雪崩防护**：所有 `redis.set` 必须附带合理的过期时间 (TTL)。

### 3. 异步任务存证闭环 (Async Traceability)
*   **状态入库**：所有通过 BullMQ 发起的任务，其“开始”、“进度更新”、“终态（成功/失败原因）”必须同步写入数据库的 `async_task_logs`。
*   **用户通知**：Job 完成后，必须触发实时推送（Socket.io/Redis PubSub），确保用户不需要刷新页面即获知结果。

### 4. 数据库事务原子性 (Transactional)
*   **主从一致**：涉及多个表（如 `quality_sessions` + `session_messages`）写入时，必须使用 `prisma.$transaction`。
*   **外键自愈**：在创建关联记录前，必须先验证父级 ID 是否物理存在。

## 二、 审计工作流
每次代码提交前，必须回答以下问题：
1. 如果 Redis 挂了，系统能降级运行吗？
2. 如果用户恶意传入一个不属于他部门的 ID，接口会拦截吗？
3. 如果批量导入执行到一半网络断了，数据库里会留下垃圾数据吗？

## 三、 禁止项
* 禁止直接在 API 路由中处理超过 500ms 的逻辑（必须进队列）。
* 禁止在 Worker 中使用全局单例 state（必须保证 stateless 扩展性）。

## 四、 物理清理规约 (Cleanup Mandate)
*   **测试闭环**：所有新功能编写完毕后，必须编写临时测试脚本或执行命令行验证，确保逻辑完美运行。
*   **测试即焚**：一旦验证通过，必须立即执行物理删除，严禁将任何 `.test.ts`、`test-*.ts` 或临时验证脚本留在项目目录中（除非是 Jest/Vitest 框架下的永久性测试用例）。
*   **数据零残留**：模拟测试产生的脏数据（如 `test-job-xxx`）必须在审计结束后物理清理。

