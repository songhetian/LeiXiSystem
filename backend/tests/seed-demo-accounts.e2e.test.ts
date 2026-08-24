// RED: 所有用户都是员工 —— 每个演示账号都应能获取自己的员工档案（/employees/me 不应 404）
// 背景：seed 之前只把 staff 绑定到员工档案（userId 按演示身份写死），admin 无档案 → 194 → 404
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { seedBusiness } from '../prisma/seed';

const prisma = new PrismaClient();
const inject = (app: NestFastifyApplication, opts: any) =>
  app.getHttpAdapter().getInstance().inject(opts);

async function login(app: NestFastifyApplication, username: string, password = '123456') {
  const res = await inject(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password },
  });
  const sc = res.headers['set-cookie'] as string | string[];
  return (Array.isArray(sc) ? sc[0] : sc).split(';')[0];
}

describe('S· 演示账号均视为员工（/employees/me 不 404）', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // 运行真实 seed（幂等）以验证 demo 账号的“用户→员工档案”绑定
    await seedBusiness(prisma);

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('admin（超级管理员）也是员工：GET /employees/me → 200，返回“系统管理员”档案', async () => {
    const cookieStr = await login(app, 'admin');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees/me',
      headers: { cookie: cookieStr },
    });
    const body = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('系统管理员');
  });

  it('staff（普通员工）能获取自己的档案：GET /employees/me → 200', async () => {
    const cookieStr = await login(app, 'staff');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees/me',
      headers: { cookie: cookieStr },
    });
    const body = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toBeDefined();
  });
});