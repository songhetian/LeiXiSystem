# Issue Tracker

- **类型**: Local Markdown（本地文件）
- **仓库**: 无（当前未接入 GitHub）
- **PR as request surface**: no
- **自定义说明**:
  - Ticket 存放于 `docs/tickets/`，按重构阶段拆分，每个文件内含任务清单。
  - 每个任务项格式：`- [ ] 任务描述（引用 REFACTOR_PLAN.md 章节）`
  - 状态约定：`- [ ]` 未开始；`- [x]` 已完成；完成后在任务行尾追加 `@ <日期>`。
  - 新需求/缺陷建议先写 PRD 再拆 ticket（见 mattpocock `to-prd` 技能）。

## 切换到 GitHub（可选）

如需接入 GitHub Issue：
1. 在 WorkBuddy 连接器中连接 GitHub（OAuth），或本地安装 `gh` 并登录。
2. 将上方 `类型` 改为 `GitHub CLI` / `GitHub MCP`，并填写 `仓库: <owner>/<repo>`。
3. 之后 `to-prd` / `to-issues` 技能将直接创建 Issue。
