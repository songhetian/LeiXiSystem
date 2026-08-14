# 雷犀管理系统 · 后端镜像（本地 Docker 测试版）
# 说明：@lei/shared 的 main 指向 TS 源码（./src/index.ts），tsc 产物在 node 下
# 无法 require，故运行期用 tsx 直接执行 TS（devDeps 已含 tsx，零包结构改动）。
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

WORKDIR /app/backend
EXPOSE 3001

# 启动：迁移 → seed（幂等演示数据）→ 服务
CMD ["sh", "-c", "pnpm --filter @lei/backend exec prisma migrate deploy && ./node_modules/.bin/tsx prisma/seed.ts && ./node_modules/.bin/tsx src/main.ts"]
