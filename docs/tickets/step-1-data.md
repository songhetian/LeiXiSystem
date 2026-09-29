# Ticket: step-1 — 数据层（删表 → Prisma → Zod）

> 对应 REFACTOR_PLAN.md 第 8 章
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 背景

旧库 150+ 张表，必须先清理再造 Prisma schema，否则废弃表全进新模型。删除前确保 mysqldump 备份已就位（step-0）。

## 待办

### 1.1 删除废弃表（写迁移文件，不手动 DROP）

**结论：已达成。** 判别依据：旧 21 个 migration 已压缩为唯一基线
`backend/prisma/migrations/0_init/migration.sql`，基线内不再出现任何废弃表名。

- [x] 备份表：`shift_schedules_backup` 系列 —— 基线中 0 匹配
- [x] 聊天：`chat_*` / `conversation*` / `messages` / `groups` 等 —— 基线中 0 匹配
- [x] 质检：`quality_*` —— 基线中 0 匹配
- [x] 资产/库存/设备：`assets` / `asset_*` / `inventory_*` —— 基线中 0 匹配；
      仅保留 `punch_devices`（打卡设备，**非**废弃的 `devices` 表，属正当业务表）
- [x] 案例库：`cases` / `case_*` / `crm_customers` —— 基线中 0 匹配
- [x] 冗余合并：休假额度表——基线只保留 `vacation_type_balances`

### 1.2 Prisma 化

- [x] schema 生成并手工整理 —— 现库 **87 张表**，命名规范（snake_case 列名 + 关系命名）已统一
- [x] 索引（外键/高频查询）、金额 decimal 字段 —— 见 `backend/prisma/schema.prisma`
- [x] 新增业务表建模：`punch_logs`、`attendance_daily`、`attendance_monthly`、
      `salary_items`、`payroll_runs`、`payroll_details`、`payroll_adjustments`
      —— 基线内 7 张表全部 `CREATE TABLE` 存在
- [x] 建立迁移基线 —— `0_init`（`prisma db push` 入口已全部移除，schema 变更只能走 migration，见 ADR-0017）

### 1.3 共享校验层

- [x] 共享包建立 —— 落地为 `shared/`（包名 `@lei/shared`），导出 `index.ts` + `schemas/`
- [ ] Zod schemas（员工/考勤/薪资/审批 DTO）收进 shared —— **部分达成 / 与计划不一致**：
      实际 Zod DTO 就近放在后端 `backend/src/**/dto/*.schemas.ts`（当前 1 个文件
      `employees/dto/employee-tx.schemas.ts`）；`shared` 目前只导出 `employeeNoSchema`，
      被 2 个后端文件消费。前端未消费 shared 的 Zod。
- [ ] 常量与枚举（考勤状态、薪资项目类型、审批状态等）收进 shared —— 未集中；
      枚举来源为 Prisma `$Enums`，状态口径分散在 `backend/src/attendance/*`（见「口径单一来源」）

### 1.4 数据迁移（A5 / ADR-0008）

- [x] legacy → 新 schema 字段映射脚本 —— `backend/prisma/seed-real-data.ts`（真实数据种子，
      含单测 `prisma/__tests__/seed-real-data.spec.ts`）
- [ ] 迁移前 mysqldump；迁移后抽样对账（员工数/工资条总数/考勤月报行数）—— 运维动作，无法从仓库核实
- [ ] 清洗旧库脏数据（孤儿外键、重复工号）—— 未见清洗报告；`employeeNoSchema` 承担部分工号校验

## 完成标准

- [x] prisma generate 无类型错误 —— `tsc --noEmit` = 0
- [x] 核心表（employees / attendance_* / payroll_*）schema 审查通过 —— 87 表基线在库
- [ ] 迁移文件可回滚（migration down 测试）—— **不适用/未提供**：ADR-0017 明确
      无 down 脚本，回滚依赖事前 `mysqldump` 备份（见 step-5）

## 与计划不一致 / 遗留

1. **共享校验层未按计划集中**：计划把 Zod schema / 枚举全收进 `packages/shared`，
   实际只有 `employeeNoSchema`；其余 DTO 就近在后端。若前端需要复用校验，
   需要在后续 ticket 里决定「继续就近」还是「上收 shared」，否则两边规则会漂移。
2. **回滚策略变更**：原「migration down 测试」被 ADR-0017 取代为「备份即回滚」，
   本 ticket 的完成标准需相应改写，不要按旧口径验收。
3. **数据迁移对账无留痕**：迁移是否抽样对账、旧库清洗结果均无法从仓库核实，
   属上线前必须人工补一次的动作。
