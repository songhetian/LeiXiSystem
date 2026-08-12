# ADR-0006: UI 规范强制 Arco Design Pro 企业级标准

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

旧项目 UI 混乱的根源：antd 与手写组件混用、图标 3 套、图表 2 套、Win11 双主题并存、样式无 token。重构必须从源头立规矩，避免二次混乱。

## 决策

- UI 组件一律使用 `@arco-design/web-react`，**禁止**手写基础组件、禁止引入其他 UI 库。
- 布局/导航/页面结构严格以 **Arco Design Pro**（arco-cli 生成的 Next 模板）为标准。
- 主题 Token 强制：主色 #165DFF、8px 间距网格、圆角 4/8px、字号 12-24 五档、语义状态色，禁止散落硬编码。
- **重复调用组件必须抽取公共组件统一调用**（≥3 次即抽）：PageContainer / ProTable / SearchForm / ModalForm / StatusTag / AsyncSelect / UploadImage / EmptyState / ResultState / ConfirmButton，Step 3 前端搭建时先建齐再写页面。
- 组件分层：shared 通用组件 → feature 业务组件 → 页面只组装；props 用 TS interface，禁止 any。
- 企业级标准：一致性、反馈及时、危险操作二次确认、菜单+按钮双级权限、可访问性、性能（虚拟滚动/懒加载/分包）。

完整规范见 REFACTOR_PLAN.md 第 11 章（含 9 条页面验收清单）。

## 后果

- 正向：全站视觉与交互统一，公共组件一次实现处处复用，页面开发速度与可维护性显著提升。
- 成本：Step 3 需先投入建公共组件库；已决定放弃 antd 存量 UI（随重写清零）。
