# T18 — 提交已应用但未入库的 Prisma 迁移

**日期**：2026-08-13
**状态**：✅ 完成（已提交 `1c559e1`）

## 背景与误判纠正
上一轮（S04 修复后）基于 `prisma migrate status` 超时被 abort，从 migration 文件夹列表推断
"S09–S15 缺 migration、DB 缺表、代码跑不起来"。本次重新核查，**该推断错误**。

## 实查结论
- `prisma migrate status` → **Database schema is up to date!**（schema 与已应用迁移完全同步）
- `leixin_v2` 实际存在 **47 张业务表 + `_prisma_migrations`**，覆盖 schema 全部 47 个 model
- `_prisma_migrations` 记录 **9 个迁移全部 finished_at 非空**（含两个 add_punch_device_relation）
- 9 个迁移文件夹中：`init` 已提交；其余 **7 个已在 DB 应用却从未 commit**（untracked）
- 两个 `add_punch_device_relation` 时间戳不同（05914 / 05937），是 Prisma 眼中独立迁移，无冲突

## 行动
不生成任何新 migration（否则与已应用状态冲突）。仅把 7 个已应用迁移文件夹补提交进 git，
使全新库 `prisma migrate deploy` 可复现。

## 验证（跑通既有 e2e，用户 T18 子目标）
逐个 suite 运行（规避双 AppModule 同进程 bootstrap 冲突），S05–S15 共 **116 个 e2e 全绿**：
- punch-sync 8 / punch-device-crud 14 / punch-makeup-approval 11
- attendance-daily 7 / attendance-monthly 5
- leave-approval 7
- payroll 7 / payslips 5
- reimbursement 11
- knowledge 9
- approval-workflow 9
- broadcast-recipients 11
- reports 11

## 关键经验
1. **`prisma migrate status` 超时会被 SIGTERM abort，导致误判**——重跑即可，别基于文件夹列表脑补缺表。
2. MySQL 下 `migrate status` 不需要 shadow DB，直接读真实库，结论可靠。
3. 双 e2e suite 同进程运行会 bootstrap 两个 AppModule 互相干扰（假失败），**必须逐个 suite 跑**。
4. DATABASE_URL 指向 `leixin_v2`（非 schema 里写的 leixi_sys），排查表时别查错库。
