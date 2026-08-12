# ADR-0014: 前端 feature 与后端模块一一对应 + feature 隔离

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

前端从 Vite 重写为 Next.js + Arco + Refine。旧项目页面/组件散落（pages/ 与 components/ 双轨、90+ 文件无归属），需要建立与后端模块一致的前端组织，防止重构后再次混乱。

## 决策

1. **features/ 与后端 Module 一一对应**：dashboard、employee、attendance、payroll、expense、training、system、auth；每个 feature 自含 pages/（App Router 路由）+ components/ + hooks/ + api.ts（仅对接本模块接口）。
2. **依赖单向**：`app/ → features/ → shared/`；**feature 之间禁止互相 import**（组件/状态/hooks 均不可跨 feature 引用）。
3. **跨 feature 需要复用的东西一律下沉 shared**：公共组件（9 个）、api client、日期/金额工具、zustand 全局状态；业务特有代码留在各自 feature。
4. **公共组件优先**：先查 `shared/components` 再建 feature 内组件（REFACTOR_PLAN 11.1-4）。
5. 菜单由路由表 + 权限动态生成（Refine resources），feature 不自行注册菜单。

## 备选（已排除）

- 按页面类型分层（pages/components/hooks 全局目录）：旧项目即因此混乱，否决。
- feature 间允许引用（就近共享）：导致隐式依赖、删除测试失效，否决。

## 后果

- 正向：前后端模块一一对应，切分上下文（如删考试功能）时前后端同步删目录即可；feature 隔离使重构/测试/权限绑定（PermissionGate 按 feature 粒度）都清晰。
- 成本：跨 feature 的公共诉求必须先下沉 shared（多一道抽象动作）；严格隔离偶尔需要"先抽 shared 再引用"。
- 约束：ESLint 配置 `no-restricted-imports` 限制跨 feature import 路径；shared/components 只收"业务无关"组件。
