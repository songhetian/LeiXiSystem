# Ticket: step-1 — 数据层（删表 → Prisma → Zod）

> 对应 REFACTOR_PLAN.md 第 8 章

## 背景

旧库 150+ 张表，必须先清理再造 Prisma schema，否则废弃表全进新模型。删除前确保 mysqldump 备份已就位（step-0）。

## 待办

### 1.1 删除废弃表（写迁移文件，不手动 DROP）
- [ ] 备份表：`shift_schedules_backup` 系列 6 张
- [ ] 聊天：`chat_groups`、`chat_messages`、`chat_group_members`、`chat_room_members`、`conversations`、`conversation_members`、`session_messages`、`messages`、`message_status`、`groups`、`group_members`、`collected_messages`
- [ ] 质检：`quality_*` 全部（约 15 张）
- [ ] 资产/库存/设备：`assets`、`asset_*`、`inventory_*`、`device_*`、`devices`
- [ ] 案例库：`cases`、`case_*`（确认 `crm_customers` 是否仅案例库使用，是则一并删）
- [ ] 冗余合并：`vacation-balance` 与 `vacation-type-balances` 对应表二选一

### 1.2 Prisma 化
- [ ] `prisma db pull` 从清理后库生成 schema
- [ ] 手工整理：命名规范（snake_case 列名 + 关系命名）、索引（外键/高频查询）、decimal 金额字段
- [ ] 新增业务表建模（字段草案见 `docs/schema/new-tables.md`）：`punch_logs`、`attendance_daily`、`attendance_monthly`、`salary_items`、`payroll_runs`、`payroll_details`、`payroll_adjustments`
- [ ] `prisma migrate` 建立基线

### 1.4 数据迁移（A5 / ADR-0008）
- [ ] 编写 legacy → 新 schema 字段映射脚本（员工/工资条/近 12 个月考勤与报销）
- [ ] 迁移前 mysqldump；迁移后抽样对账（员工数/工资条总数/考勤月报行数）
- [ ] 清洗旧库脏数据（孤儿外键、重复工号），发现问题记录报告

### 1.3 共享校验层
- [ ] packages/shared 建立：Zod schemas（员工/考勤/薪资/审批 DTO）
- [ ] 常量与枚举（考勤状态、薪资项目类型、审批状态等）收进 shared

## 完成标准

- [ ] 迁移文件可回滚（migration down 测试）
- [ ] prisma generate 无类型错误
- [ ] 核心表（employees/attendance_*/payroll_*）schema 审查通过
