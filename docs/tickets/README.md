# Tickets — 重构任务拆解

> 本目录是重构执行的**任务清单**，与 `REFACTOR_PLAN.md` 配套使用：方案讲"为什么/怎么做"，tickets 讲"做什么/做没做完"。
>
> - **垂直切片**（执行粒度）：见 [slices/](./slices/README.md) —— S01~S15 端到端切片，含依赖关系，**优先完成核心曳光弹 S05→S07→S08→S10**
> - **阶段 ticket**（验收粒度）：step-0 ~ step-5，按阶段推进与验收
> - 状态约定：`- [ ]` 未开始 → `- [x]` 已完成（完成时追加 `@ 日期`）
> - 每阶段结束必须：可运行、可回滚、独立 commit
>
> **状态核对：2026-09-29**。下列状态栏按仓库实际证据核对后的结论填写，
> 不是计划口径；各行 ticket 内已逐条标注 `[x]/[ ]` 与偏差原因。

| Ticket | 阶段 | 对应方案章节 | 状态（2026-09-29 核对） |
|---|---|---|---|
| [step-0-prep.md](./step-0-prep.md) | 准备与脚手架 | REFACTOR_PLAN 9-1 | 基本达成（决策已拍板；未打 tag、分支 39 提交未推送） |
| [step-1-data.md](./step-1-data.md) | 数据层 | 第 8 章 | 基本达成（87 表基线；共享校验层未按计划集中） |
| [step-2-backend.md](./step-2-backend.md) | 后端移植 | 第 7.2 节 | 基本达成（DTO 未上收 shared；模块命名有差异） |
| [step-3-frontend.md](./step-3-frontend.md) | 前端搭建 | 第 7.3 节 + 第 11 章 | 基本达成（**未采用 Refine**；2 个通用组件缺口） |
| [step-4-punch-payroll.md](./step-4-punch-payroll.md) | 打卡机 + 算薪 | 第 6 章 | 代码就绪、**硬件阻塞**（XFace600 未到货）；3 人对账样例基线已建立，真实批次复跑待上线时 |
| [step-5-launch.md](./step-5-launch.md) | 收尾部署 | 9-5 | 部署编排就绪，**未上线**；KKFileView 项作废 |
