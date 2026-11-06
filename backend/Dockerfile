# 雷犀管理系统 · 后端镜像（本地 Docker 测试版）
# 多阶段构建：builder 编译 TypeScript + 生成 Prisma Client；runner 仅含运行所需文件
# 说明：运行期用 ts-node 直跑 TS 源码（@lei/shared 的 main 指向 TS 源码，tsc 产物在
# node 下无法 require）。注意不能用 tsx —— tsx 基于 esbuild，而 esbuild 不支持
# emitDecoratorMetadata，会导致 Nest 的类型注入全部变 undefined（详见 entrypoint.sh）。

# ── Stage 1: Builder ──────────────────────────────────────────
# 安装全部依赖、编译 TypeScript（类型检查）、生成 Prisma Client
FROM node:22-slim AS builder

# corepack 会按 package.json 的 packageManager 字段下载 pnpm；
# 国内网络直连 registry.npmjs.org 易超时，改走 npmmirror（仅构建期生效）
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
# 注意：慢网调优参数（fetch-timeout / fetch-retries / network-concurrency）不能用
# `ENV npm_config_xxx` 传递 —— pnpm 11 不读取 npm_config_ 前缀环境变量，实测缓存目录
# 与并发设置全部失效（store 命中 0）。必须写成 pnpm CLI 参数，见下方 install 行。
RUN corepack enable

# Prisma 靠 openssl 才能探测宿主 libssl 版本：镜像缺它时会打印
#   prisma:warn Prisma failed to detect the libssl/openssl version to use
# 并回落到 openssl-1.1.x 引擎（而 node:22-slim 是 Debian bookworm，实际只有 libssl3），
# 属于「能跑但引擎选错」的隐患，故显式安装。
# 必须先把 Debian 源换成国内镜像再 update：实测本机到 deb.debian.org:80 是
# `connect (111: Connection refused)`，apt 索引下载失败只留下 W: 警告，随后
# `apt-get install openssl` 直接报 `E: Unable to locate package openssl` —— 报错
# 看着像「包名不对」，实际是网络不通。与仓库已有的 npmmirror 取 pnpm 同理。
# 放在 COPY 之前，让该层可被后续构建复用。
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先拷贝清单文件 + .npmrc（registry 指向 npmmirror），利用层缓存；
# 注意：`.npmrc` 必须在 pnpm install 之前拷入，否则安装走默认源
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
# 两个 BuildKit 缓存挂载：
#   /pnpm-store  已下载的包（跨次构建复用，慢网下不必每次重下全量）
#   /pnpm-cache  pnpm 元数据缓存，内含 lockfile supply-chain 校验结论，
#                命中后跳过按条目联网核对（pnpm 11 冷启动时该项可达数分钟）
# 慢网调优（必须走 CLI 参数，ENV 形式 pnpm 11 不认）：
#   --fetch-timeout / --fetch-retries / --fetch-retry-maxtimeout  单请求易中断 → 放宽并重试
#   --network-concurrency  pnpm 11 默认并发高达 64，慢链路上会把连接全部拖死 → 压到 6
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-cache,target=/pnpm-cache \
    pnpm install --frozen-lockfile \
      --store-dir=/pnpm-store --cache-dir=/pnpm-cache \
      --fetch-timeout=900000 --fetch-retries=5 --fetch-retry-maxtimeout=180000 \
      --network-concurrency=6

# 拷贝全部源码
COPY . .

# 生成 Prisma Client —— 必须早于 tsc：
# tsc 做的是全量类型检查，而 @prisma/client 的模型类型（EmployeeStatus 等）
# 与 Prisma.Decimal 都来自 generate 产物；顺序颠倒只会拿到桩类型，
# 报 "has no exported member 'EmployeeStatus'" / "Property 'Decimal' does not exist"。
RUN pnpm --filter @lei/backend exec prisma generate

# 编译 TypeScript（类型检查 + 生成 dist 产物，后者目前未用于运行期）。
# 开 incremental 并把 tsbuildinfo 挂成 BuildKit cache：源码小改后的重复构建
# 只重查变动的文件子图，类型检查时间显著缩短（全量 ~1 分钟 → 常态十几秒）。
# tsc 自带内容哈希校验，缓存不会导致漏检。
RUN --mount=type=cache,id=tsbuildinfo,target=/app/backend/.tscache \
    pnpm --filter @lei/backend exec tsc -p tsconfig.json \
      --incremental --tsBuildInfoFile /app/backend/.tscache/main.tsbuildinfo

# ── Stage 2: Runner ───────────────────────────────────────────
# 仅拷贝运行所需文件，排除测试/导出/前端/legacy 等
FROM node:22-slim AS runner

# 与 builder 同理：corepack 需从 npmmirror 取 pnpm，pnpm install 需读 .npmrc
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable

# 同 builder：装 openssl 供 Prisma 探测 libssl；同样需先换国内 Debian 源，
# 否则 apt 索引拉不下来（详见 builder 段说明）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先拷贝清单文件，利用层缓存
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
# 只装 @lei/backend 及其工作区依赖（含 @lei/shared）：
# 后端运行期用 ts-node 直跑 TS 源码，ts-node / typescript / prisma CLI 都在 backend 的
# devDependencies 里，必须装；而 frontend 的依赖树（Next/React/Arco 等）与后端运行无关，
# 一并装进来只会让镜像白白多出近 1GB。frontend/package.json 仍需拷入，否则 pnpm 无法
# 解析 workspace 清单。
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-cache,target=/pnpm-cache \
    pnpm install --frozen-lockfile --filter @lei/backend... \
      --store-dir=/pnpm-store --cache-dir=/pnpm-cache \
      --fetch-timeout=900000 --fetch-retries=5 --fetch-retry-maxtimeout=180000 \
      --network-concurrency=6

# 仅拷贝运行所需源码及配置（不含测试、导出文件、前端、legacy 等）
COPY --from=builder /app/backend/src ./backend/src
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/tsconfig.json ./backend/tsconfig.json
# Prisma 配置（seed 命令已从 package.json#prisma 迁到这里）。运行期
# entrypoint.sh 的 migrate deploy 会读取它；不带进镜像虽然也能跑（schema 走默认路径），
# 但 package.json#prisma 的弃用告警会重新出现，且配置与镜像内容不一致。
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=builder /app/shared/src ./shared/src

# 生成 Prisma Client —— 不能从 builder 拷 node_modules/.prisma：
# pnpm 布局下该产物实际落在
#   node_modules/.pnpm/@prisma+client@<版本>_<peer 哈希>/node_modules/.prisma
# 哈希目录名不可硬编码（拷贝路径会 not found）。就地生成等价，且不依赖路径细节。
RUN pnpm --filter @lei/backend exec prisma generate

# 启动脚本（负责迁移 + 可选种子 + 启动服务，见 backend/entrypoint.sh）
COPY backend/entrypoint.sh ./backend/entrypoint.sh
RUN chmod +x ./backend/entrypoint.sh

# 确保 uploads 挂载点存在并归属 node 用户（运行期唯一写入点：local-storage.driver
# 的 resolve(process.cwd(), 'uploads')）。只 chown 该目录，绝不能写成 chown -R node:node /app：
# overlayfs 下递归改属主会触发 copy-up，把整个 node_modules（约 1.5G）复制进新层，
# 直接把镜像体积翻倍。其余文件由 root 持有但都是 644/755，node 用户读取无需属主权限。
RUN mkdir -p /app/backend/uploads && chown node:node /app/backend/uploads

WORKDIR /app/backend
USER node
EXPOSE 4001

# 启动：统一交给 entrypoint.sh
#   · prisma migrate deploy（结构变更唯一入口；既有库自动打基线 0_init）
#   · seed 仅在 SEED_ON_BOOT=true 时执行
#   · 不再使用 prisma db push（历史上它导致迁移链与 schema 脱节，见 0_init/migration.sql 说明）
CMD ["sh", "./entrypoint.sh"]
