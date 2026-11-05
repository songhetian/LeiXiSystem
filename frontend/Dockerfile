# 雷犀管理系统 · 前端镜像（多阶段构建）
# Builder: 编译 Next.js 生产产物
# Runner: 安装生产依赖 + next start（见下方「为什么不用 standalone」说明）

# 为什么不用 `output: 'standalone'` 直接跑 server.js：
#   本仓库是 pnpm workspace，Next 的文件追踪把 `next` / `react` 写成了相对
#   符号链接 `../../node_modules/.pnpm/<pkg>@<ver>_<peer哈希>/node_modules/<pkg>`，
#   其参照基准是 tracing root（= /app/frontend），即期望 store 位于
#   /app/node_modules/.pnpm。而 standalone 产物自身既不含该 store，也不含
#   包本体 —— 无论把 standalone 拷到 /app 还是 /app/frontend，运行期都必然
#   `Error: Cannot find module 'next'`（已实测）。且该链接层级里含 peer 哈希
#   目录名，补齐 store 属于「猜路径」，不可靠。
#   故运行期改为 next start：由 runner 自行安装生产依赖来解析模块，
#   不依赖任何符号链接推算。

# ====== Stage 1: Builder ======
FROM node:22-slim AS builder

# corepack 会按 package.json 的 packageManager 字段下载 pnpm；
# 国内网络直连 registry.npmjs.org 易超时，改走 npmmirror（仅构建期生效）
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
# 注意：慢网调优参数（fetch-timeout / fetch-retries / network-concurrency）不能用
# `ENV npm_config_xxx` 传递 —— pnpm 11 不读取 npm_config_ 前缀环境变量，实测缓存目录
# 与并发设置全部失效（store 命中 0）。必须写成 pnpm CLI 参数，见下方 install 行。
RUN corepack enable

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

WORKDIR /app/frontend

# 构建期约束（都只作用于 builder 阶段）：
#   NEXT_TELEMETRY_DISABLED        关闭 Next 遥测上报，少一次出网
#   NEXT_IGNORE_INCORRECT_LOCKFILE 跳过 Next 的「自动补 @next/swc-* 依赖」逻辑。
#       该逻辑用 findup 找 package-lock.json，命中就联网查 registry 并回写；
#       pnpm workspace 下这一步既无意义（真正的锁文件是 pnpm-lock.yaml），
#       镜像源不可达时还会抛 TypeError: Cannot read properties of undefined
#       (reading 'os')。.dockerignore 已排除 package-lock.json，此处再加一道保险。
#   NODE_OPTIONS                   限制 V8 堆上限，避免小内存机器被内核 OOM killer
#       直接杀掉（表现为构建日志末尾 Killed / exit code 137）
#   NEXT_BUILD_CPUS                构建 worker 并发降到 1（next.config.mjs 读取），
#       峰值内存约减半；代价是构建耗时略增，对小内存 ECS 是必要交换
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_IGNORE_INCORRECT_LOCKFILE=1 \
    NODE_OPTIONS=--max-old-space-size=1536 \
    NEXT_BUILD_CPUS=1

# 兜底开关：默认 0（保留 next build 内的 TypeScript 校验）。
# 机器内存确实不足以跑完类型检查时，可这样构建：
#   docker compose -f docker-compose.prod.yml --env-file .env.production \
#     build --build-arg NEXT_SKIP_TYPECHECK=1 frontend
# 此时请改为在本地/CI 单独执行 pnpm --filter @lei/frontend exec tsc --noEmit。
ARG NEXT_SKIP_TYPECHECK=0
ENV NEXT_SKIP_TYPECHECK=${NEXT_SKIP_TYPECHECK}

# 生产构建。
# 用 pnpm exec 而不是 npx：npx 在解析不到本地 bin 时会去 registry 拉一个 next
# 跑构建（版本与锁文件不一致），pnpm exec 只会用本 workspace 已安装的那一份。
RUN pnpm --filter @lei/frontend exec next build

# 清掉 standalone 与 build cache：
#   standalone —— 运行期不用（理由见文件头），且体积可观，留着只会白占镜像层
#   cache      —— 增量编译缓存，仅构建期有用
RUN rm -rf .next/standalone .next/cache

# ====== Stage 2: Runner ======
FROM node:22-slim AS runner

# 与 builder 同理：corepack 需从 npmmirror 取 pnpm，pnpm install 需读 .npmrc
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable

WORKDIR /app

# 环境变量默认值（next start 用 -p 显式指定端口，此处保留供其它工具读取）
ENV NODE_ENV=production
ENV PORT=4000

# 先拷贝清单文件，利用层缓存
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY shared/package.json shared/
# 只装生产依赖：next start 运行期只需要 @lei/frontend 的 dependencies。
# 不带 --prod 会把 tailwind/jest/testing-library 等构建期依赖一并装进运行镜像。
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-cache,target=/pnpm-cache \
    pnpm install --frozen-lockfile --prod --filter @lei/frontend \
      --store-dir=/pnpm-store --cache-dir=/pnpm-cache \
      --fetch-timeout=900000 --fetch-retries=5 --fetch-retry-maxtimeout=180000 \
      --network-concurrency=6

# 运行期所需产物：构建结果（含 BUILD_ID / required-server-files.json）、
# 静态资源与 public、以及 next start 会读取的配置文件
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/next.config.mjs ./frontend/next.config.mjs

# 归属 node 用户
RUN chown -R node:node /app
USER node

WORKDIR /app/frontend
EXPOSE 4000

# next start 会读取 .next/routes-manifest.json 与 next.config.mjs；
# 显式 -p 4000 与 nginx 反代（frontend:4000）和 compose 健康检查保持一致。
# 注意入口必须写 Next 的 JS 入口（node_modules/next/dist/bin/next）：
# pnpm 生成的 node_modules/.bin/next 是 sh 包装脚本，用 node 去执行会报
# `SyntaxError: missing ) after argument list`。
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "4000"]