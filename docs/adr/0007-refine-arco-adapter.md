# ADR-0007: Refine × Arco 自写适配层

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

前端选定 Refine（数据层）+ Arco Design（UI）。但 **Refine 官方 UI 集成包仅覆盖 antd / mui / mantine / chakra，没有 Arco**。直接使用会出现两套写法（Refine 数据 hooks + 手写列表），违背统一组件规范（REFACTOR_PLAN 11.5）。

## 决策

**ProTable 内部用 Refine `useTable` 的返回值手动映射 Arco `Table`**——自写薄适配层，收在 ProTable 一个组件内完成（搜索、分页、排序、导出联动），不引入第三方桥接库。业务页面只感知 ProTable，不直接接触 Refine 表格细节。

## 后果

- 正向：业务代码保持"Arco 风格"单一写法，适配成本被公共组件吸收，后续可扩展。
- 成本：ProTable 开发需理解 Refine useTable 的返回结构（data/total/current/pageSize/sorters/filters）并映射到 Arco Table 的受控 props；适配层需单测覆盖（分页/排序/搜索联动）。
- 约束：ProTable 必须实现（REFACTOR_PLAN 11.5），且是 Step 3 第一个要建的公共组件。
