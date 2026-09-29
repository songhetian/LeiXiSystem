import { defineConfig } from 'prisma/config';

// 从 package.json#prisma 迁移而来。该字段已被 Prisma 弃用（Prisma 7 将移除），
// 只要它还留在 package.json 里，每次跑 prisma CLI 都会额外打印一条
//   warn The configuration property `package.json#prisma` is deprecated ...
// 的告警，故按官方指引迁到本文件。
//
// 这里只声明 seed 命令，内容与原 package.json#prisma.seed 逐字一致
// （开发侧 `pnpm --filter @lei/backend run db:seed` 走的就是它）；
// 迁移只换存放位置，不改行为。
//
// schema 显式写出而非依赖默认值：config 内的相对路径由 @prisma/config 的
// transformPathsInConfigToAbsolute 统一按「本文件所在目录」解析，与 cwd 无关，
// 因此写成 'prisma/schema.prisma' 在宿主与容器（/app/backend/prisma.config.ts）下
// 都指向同一个 schema，不引入路径歧义。migrations 目录由 Prisma 依 schema 位置默认推导，
// 即 backend/prisma/migrations，无需在此重复声明。
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node --env-file=../.env --import tsx prisma/seed.ts',
  },
});