# 雷犀管理系统 · 前端镜像（本地 Docker 测试版）
# Next.js 14 生产构建（next build）+ next start
FROM node:22-slim

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
# 生产构建
RUN npx next build

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
