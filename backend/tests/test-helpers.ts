// E2E 测试样板工具（P2-04）：消除各 *.e2e.test.ts 中重复的 Bootstrap / 登录 / 清理逻辑。
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
export { prisma };

/** 创建测试用 NestJS 应用实例（含 cookie 注册 + 全局前缀）。 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(cookie as any);
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

/** HTTP 注入辅助（Fastify inject）。 */
export function inject(app: NestFastifyApplication, opts: Record<string, unknown>) {
  return app.getHttpAdapter().getInstance().inject(opts);
}

/** 登录并返回 cookie 字符串（`access_token=xxx`）。 */
export async function loginAs(
  app: NestFastifyApplication,
  username: string,
  password: string,
): Promise<string> {
  const res = await inject(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password },
  });
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error('Login failed: no cookie returned');
  const cookieStr = cookies as string | string[];
  return (Array.isArray(cookieStr) ? cookieStr[0] : cookieStr).split(';')[0];
}

/** 携带 cookie 的 inject 快捷方法。 */
export function authInject(
  app: NestFastifyApplication,
  cookieStr: string,
  opts: Record<string, unknown>,
) {
  return inject(app, { ...opts, headers: { cookie: cookieStr } });
}

/** 清空指定表（传入 Prisma model 名）。 */
export async function cleanup(...tableNames: string[]) {
  for (const table of tableNames) {
    await (prisma as unknown as Record<string, { deleteMany: (args: unknown) => Promise<unknown> }>)[table].deleteMany({});
  }
}

/** 关闭应用并断开数据库连接。 */
export async function teardown(app: NestFastifyApplication) {
  await app.close();
  await prisma.$disconnect();
}
