---
name: v2-optimization-architect
description: 雷犀系统 v2-web 重构最高统帅指令。强制执行 100% 功能对齐、Mantine v7 巅峰质感（slate-500 边框/44px 按钮）、异步化架构（BullMQ/Redis）及全链路类型安全。在处理 v2-web/ 目录下任何代码时激活。
---

# 雷犀系统 v2 巅峰优化守则 (Optimization Architect)

在执行 `v2-web` 目录下的重构、新功能开发或性能优化时，必须激活并遵守本守则。本守则优先级高于通用迁移指南。

## 一、 核心任务：100% 逻辑对齐
重构的生命线是功能无损。
*   **物理还原**：必须逐行审计旧版 `src/` 或 `server/` 代码。旧版中的每一个按钮点击、条件分支、API 参数、`bizType` 字符串都必须在 v2 中物理存在。
*   **拒绝模拟**：禁止使用 `TODO` 或硬编码数据。所有交互必须通过 `Prisma` + `Zod` 实现真实闭环。

## 二、 性能基石：全异步化架构
针对高耗时、高并发场景，必须执行异步解耦：
*   **技术栈**：`BullMQ` + `ioredis` + `Fastify`。
*   **强制异步场景**：
    *   所有批量导入/导出（如质检导入、员工批量入职）。
    *   大规模消息推送/广播通知。
    *   复杂报表计算（考勤统计快照）。
*   **交互模式**：`Request -> Queue -> Job ID Response`。前端必须通过 Socket.io 或轮询 Job ID 获取进度，严禁让用户等待同步请求。

## 三、 UI/UX 巅峰质感标准 (Pixel Perfect)
必须严格执行以下视觉与交互规范，对标工业级桌面软件：
*   **搜索布局**：筛选区域必须实现“单行全铺满、自适应比例 (flex-grow)”布局。
*   **快捷日期组**：
    *   物理缝合：按钮组（今天、近7天等）必须紧贴搜索行。
    *   **硬指标**：高度统一为 **44px**。
    *   **颜色锁定**：边框颜色严格锁定为 **1px slate-500 (#64748b)**。
    *   交互：点击快捷日期必须立即触发搜索联动。
*   **物理隔离进化**：当页面存在多个重复分组、设置项或大量内容块时，**必须优先采用 Tab 标签页进行物理隔离**，禁止垂直长堆叠。
*   **组件规约**：优先使用 `LXTable`、`LXSelect` 等基于 Mantine 的标准化封装。

## 四、 研发标准化规约
*   **类型安全**：严禁使用 `any`。所有 API 必须定义 `Zod` Schema。
*   **数据访问层 (ORM)**：**严禁使用原生 SQL (`$queryRaw`)**。必须使用 `Prisma Fluent API` (findMany, include, select 等)。如果遇到极其复杂的查询，应优先考虑数据库视图 (View) 或在应用层通过代码扁平化，以确保全链路的类型推导与可维护性。
*   **数据流**：彻底消灭 `useEffect` 数据加载。必须使用 `TanStack Query (v5)` 结合 `Router Loader`。
*   **Prisma 规范**：任何数据库修改必须立即追加至 `database/migrations/update.sql`，并附带精确时间戳与描述。

## 五、 模块化目录结构 (Feature-based)
所有新模块必须严格遵循：
```text
v2-web/src/features/[feature-name]/
├── api/            # useQuery & useMutation 定义
├── components/     # 模块专属 UI (LX 封装)
├── hooks/          # 复杂状态与 Job 状态轮询逻辑
├── types.ts        # Zod Schema & Types
└── index.tsx       # 模块唯一物理入口
```
