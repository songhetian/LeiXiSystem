# Tickets — 重构任务拆解

> 本目录是重构执行的**任务清单**，与 `REFACTOR_PLAN.md` 配套使用：方案讲"为什么/怎么做"，tickets 讲"做什么/做没做完"。
>
> - **垂直切片**（执行粒度）：见 [slices/](./slices/README.md) —— S01~S15 端到端切片，含依赖关系，**优先完成核心曳光弹 S05→S07→S08→S10**
> - **阶段 ticket**（验收粒度）：step-0 ~ step-5，按阶段推进与验收
> - 状态约定：`- [ ]` 未开始 → `- [x]` 已完成（完成时追加 `@ 日期`）
> - 每阶段结束必须：可运行、可回滚、独立 commit

| Ticket | 阶段 | 对应方案章节 | 状态 |
|---|---|---|---|
| [step-0-prep.md](./step-0-prep.md) | 准备与脚手架 | REFACTOR_PLAN 9-1 | 进行中（决策已拍板） |
| [step-1-data.md](./step-1-data.md) | 数据层 | 第 8 章 | 未开始 |
| [step-2-backend.md](./step-2-backend.md) | 后端移植 | 第 7.2 节 | 未开始 |
| [step-3-frontend.md](./step-3-frontend.md) | 前端搭建 | 第 7.3 节 + 第 11 章 | 未开始 |
| [step-4-punch-payroll.md](./step-4-punch-payroll.md) | 打卡机 + 算薪 | 第 6 章 | 未开始 |
| [step-5-launch.md](./step-5-launch.md) | 收尾部署 | 9-5 | 未开始 |
