---
name: v2-migration-guard
description: 确保从旧版 (Electron/JS/AntD) 到 v2-web 版 (TS/Mantine/React Query) 的重构过程中，业务逻辑 100% 对齐，严格执行顺序迁移与类型安全准则。
---

# 雷犀系统 v2 重构守护准则 (Migration Guard)

在执行 `v2-web` 目录下的任何模块重写时，必须激活并遵守本准则。

## 一、 核心法则：逻辑 100% 复刻
重构的目标是“架构升级”，而非“功能裁剪”。
*   **严禁丢失逻辑**：旧代码中的每一个按钮点击事件、每一个条件判断、每一个 API 参数，都必须在新版中找到对应的实现。
*   **禁止占位符**：绝对禁止使用 `// TODO` 或模拟数据。必须使用 `Prisma` 生成的真实 Client 进行数据库交互。

## 二、 迁移标准化链路 (Sequential Migration Workflow)

### 第一步：深度审计 (Deep Audit)
在重写任何 Feature 之前，必须阅读旧版对应文件，列出以下矩阵：
1.  **数据源**：旧版调用的 API 路径、请求参数、返回结构。
2.  **状态点**：旧版使用了哪些 `useState` 和 `useEffect`。
3.  **特殊逻辑**：如权限校验字符串、复杂的前端计算、文件上传 bizType 等。

### 第二步：架构对齐重写 (Elite Refactoring)
按照 `@优化文档.md` 的规范执行重写：
*   **前端数据层**：将 `useEffect` 数据抓取 100% 替换为 `TanStack Query (useQuery/useMutation)`。
*   **前端类型层**：严禁使用 `any`。必须利用 `Prisma` 生成的类型或手动定义 `zod` Schema。
*   **后端 API 层 (核心强制)**：
    *   **必须使用 Fastify Schema 序列化**：所有路由必须定义 `response` schema。
    *   **Zod 驱动**：使用 `fastify-type-provider-zod` 进行输入验证和输出序列化。
    *   **安全过滤**：通过 Schema 自动剔除 `password`、`salt` 等敏感字段，严禁直接返回数据库原始对象。
*   **UI 层**：将 Ant Design 组件 1:1 转换为 Mantine v7 组件。
    *   `Button` -> `Button`
    *   `Table` -> `LXTable` (基于 Mantine 封装)
    *   `Modal` -> `Modal`
*   **校验层**：所有的表单校验必须使用 `zodResolver` + `Mantine Form`。

### 第三步：闭环验证 (Closure Verification)
完成迁移后，必须验证：
1.  **类型闭环**：`npm run build` 是否报错？
2.  **逻辑闭环**：新版的功能是否能成功增删改查到数据库（通过 Prisma 验证）？
3.  **UI 质感**：是否符合“高密度桌面质感”？

## 三、 强制性目录规约
所有 Feature 必须严格遵循以下结构：
```text
v2-web/src/features/[feature-name]/
├── api/            # 定义 useQuery 和 useMutation
├── components/     # 模块专属 UI (LX 系列封装)
├── hooks/          # 复杂的业务逻辑 (useActionHandlers)
├── types.ts        # Zod Schema 和导出类型
└── index.tsx       # 模块导出主入口
```

## 四、 错误纠偏
如果发现旧代码中有 Bug，必须在新版中修复，并在注释中注明 `[Fixed Legacy Bug]`。不得为了“100% 复制”而保留明显的代码缺陷。
