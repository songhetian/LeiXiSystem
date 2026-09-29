#!/bin/sh
# 雷犀管理系统 · 后端容器启动脚本
#
# 职责（顺序固定、任一步失败即退出，容器不启动）：
#   1. 数据库迁移：prisma migrate deploy —— 结构变更的唯一入口，禁止使用 db push
#      · 空数据库：由基线迁移 0_init 一次性建全 87 张表；
#      · 既有数据库（历史上由 db push 建成、无迁移记录）：migrate deploy 会返回 P3005，
#        脚本自动执行一次基线标记 `migrate resolve --applied 0_init` 后重试，
#        不重建任何表、不触碰既有数据；
#      · 其它错误：直接退出，避免带着半截结构启动服务。
#   2. 种子数据：仅当 SEED_ON_BOOT=true 时执行（默认 false，避免污染生产数据）。
#   3. 启动服务：node --require ts-node/register src/main.ts
#      · 不能用 tsx：tsx 基于 esbuild，而 esbuild 不支持 emitDecoratorMetadata，
#        容器里所有「按类型注入」的依赖都会变成 undefined（Nest 不报错、
#        直接空参实例化），表现为 /api/v1/health 与 /api/v1/metrics 一律 500。
#      · 与开发脚本 `node --require ts-node/register src/main.ts` 保持同一运行期，
#        保证 DI 语义在开发/生产完全一致（ts-node 走 tsc，会产出设计类型元数据）。
#
# 背景见 backend/prisma/migrations/0_init/migration.sql 顶部说明。
set -e

BASELINE_MIGRATION="0_init"

cd /app/backend

echo "[entrypoint] 执行数据库迁移：prisma migrate deploy"
if ! migrate_out=$(pnpm --filter @lei/backend exec prisma migrate deploy 2>&1); then
  echo "$migrate_out"

  # P3005：数据库非空但无迁移历史 —— 既有库（由 db push 建成）的预期表现
  if echo "$migrate_out" | grep -q "P3005"; then
    echo "[entrypoint] 检测到非空数据库且无迁移历史（P3005），判定为既有数据库"
    echo "[entrypoint] 执行基线标记：prisma migrate resolve --applied ${BASELINE_MIGRATION}"
    pnpm --filter @lei/backend exec prisma migrate resolve --applied "${BASELINE_MIGRATION}"
    echo "[entrypoint] 基线标记完成，重新执行迁移"
    pnpm --filter @lei/backend exec prisma migrate deploy
  else
    echo "[entrypoint] 迁移失败且非 P3005，终止启动" >&2
    exit 1
  fi
fi
echo "[entrypoint] 数据库迁移完成"

if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "[entrypoint] SEED_ON_BOOT=true，执行种子数据（幂等）"
  pnpm --filter @lei/backend exec tsx prisma/seed.ts
else
  echo "[entrypoint] 跳过种子数据（如需执行请设置 SEED_ON_BOOT=true）"
fi

echo "[entrypoint] 启动后端服务"
# 运行期用 ts-node（= 开发脚本同一套），原因见文件头第 3 条说明
exec node --require ts-node/register src/main.ts