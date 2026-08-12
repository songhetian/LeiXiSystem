# ADR-0013: 后端模块内 4 层 + 依赖规则（单 Prisma、跨模块只读）

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

后端从裸 Fastify 重写为 NestJS，需要确定组织方式。核心问题：业务模块如何分层、模块之间如何协作（尤其 payroll 需要 attendance 的月报数据、各模块需要 employees 数据）、数据库层如何组织，避免重写后再次变成"91 个路由文件互相拉扯"的乱局。

## 决策

1. **模块内 4 层，依赖单向**：Controller（薄，路由+校验+格式化）→ Service（深，用例编排）→ Domain（纯函数引擎，无 IO 无框架）→ Infrastructure（Prisma Repository / 外部 Adapter）。禁止反向依赖与循环依赖。
2. **单 Prisma schema + 单 Client**：不按上下文拆分 schema，避免多 client 事务断裂；模块边界 = "谁负责写"的约定 + Repository 收口。
3. **跨模块只读数据**：允许经 Prisma 直读对方数据表（payroll 读 `attendance_monthly(status=confirmed)`、`employees.salary`）；**禁止跨模块调用对方 Service**（写操作必须走自身模块）。
4. **跨模块弱引用**：跨模块关系只存 ID 快照（如 payroll_details.employee_id 不建 FK 到 employees），防级联耦合、保历史稳定。

## 备选（已排除）

- 按上下文拆分多个 Prisma schema：多 client 无法跨库事务、关系断裂，否决。
- 微服务化（各上下文独立部署）：本系统体量不需要分布式，否决。
- 跨模块允许 service 互调：会造成隐式依赖网，删除测试无法执行，否决。

## 后果

- 正向：依赖方向单一可脚本校验；删除测试可执行（模块独立性）；引擎纯函数零 mock 可测；数据快照保证历史不可变（与 ADR-0011 一致）。
- 成本：跨模块读数据需约定"只读不写"，靠 code review + 规范约束（可用 ESLint import 规则辅助）；弱引用查询需 join 时多一次查询（可接受）。
- 约束：Domain 层禁止 import NestJS/Prisma 等框架；Repository 是唯一数据访问入口。
