# 雷犀管理系统 · 前端镜像（多阶段构建 + standalone）
# Builder: 编译 Next.js standalone 产物
# Runner: 仅拷贝 standalone 产物，镜像 ~200MB

# ====== Builder ======
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

WORKDIR /app/frontend
# 生产构建（output: 'standalone' 产出 .next/standalone）
RUN npx next build

# ====== Runner ======
FROM node:22-slim AS runner

WORKDIR /app

# 环境变量默认值
ENV NODE_ENV=production
ENV PORT=4000

# 拷贝 standalone 产物（含最小化 node_modules 和 server.js）
COPY --from=builder /app/frontend/.next/standalone ./
# 拷贝静态资源
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

# 归属 node 用户
RUN chown -R node:node /app
USER node

EXPOSE 4000

# standalone server 入口
CMD ["node", "frontend/server.js"]
