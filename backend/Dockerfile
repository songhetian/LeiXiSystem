# 雷犀管理系统 · 后端镜像（本地 Docker 测试版）
# 多阶段构建：builder 编译 TypeScript + 生成 Prisma Client；runner 仅含运行所需文件
# 说明：@lei/shared 的 main 指向 TS 源码（./src/index.ts），tsc 产物在 node 下
# 无法 require，故运行期仍用 tsx 直接执行 TS（devDeps 已含 tsx，零包结构改动）。

# ── Stage 1: Builder ──────────────────────────────────────────
# 安装全部依赖、编译 TypeScript（类型检查）、生成 Prisma Client
FROM node:22-slim AS builder

RUN corepack enable

WORKDIR /app

# 先拷贝清单文件，利用层缓存
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile

# 拷贝全部源码
COPY . .

# 编译 TypeScript（类型检查 + 生成 dist 产物，后者目前未用于运行期）
RUN pnpm --filter @lei/backend exec tsc -p tsconfig.json

# 生成 Prisma Client
RUN pnpm --filter @lei/backend exec prisma generate

# ── Stage 2: Runner ───────────────────────────────────────────
# 仅拷贝运行所需文件，排除测试/导出/前端/legacy 等
FROM node:22-slim AS runner

RUN corepack enable

WORKDIR /app

# 先拷贝清单文件，利用层缓存
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile

# 从 builder 拷贝预生成的 Prisma Client（pnpm install 不会自动生成）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 仅拷贝运行所需源码及配置（不含测试、导出文件、前端、legacy 等）
COPY --from=builder /app/backend/src ./backend/src
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=builder /app/shared/src ./shared/src

# 确保 uploads 挂载点存在，并将所有文件归属 node 用户，以便以非 root 身份运行
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

WORKDIR /app/backend
USER node
EXPOSE 4001

# 启动：先 migrate deploy（执行已有迁移），再 db push（同步 S06-S15 等尚未生成迁移的表），
# 之后执行 seed（幂等演示数据）→ 启动服务。
# 全部使用 && 连接（fail-fast）：任一步骤失败则容器不启动。
CMD ["sh", "-c", "pnpm --filter @lei/backend exec prisma migrate deploy && pnpm --filter @lei/backend exec prisma db push && pnpm --filter @lei/backend exec tsx prisma/seed.ts && pnpm --filter @lei/backend exec tsx src/main.ts"]
