// S02 · 认证与权限 e2e（TDD RED 先行，对齐 spec 第 4 章错误码 + CONTEXT 业务规则）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
const inject = (app: NestFastifyApplication, opts: any) =>
  app.getHttpAdapter().getInstance().inject(opts);

describe('S02 · 认证与权限（/api/v1/auth）', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // 种子：测试用户 admin + 角色 admin + 权限
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    const role = await prisma.role.create({
      data: { code: 'admin', name: '管理员' },
    });
    const perm = await prisma.permission.create({
      data: { code: 'employee:view', name: '员工查看', module: 'employee', type: 'menu' },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('123456', 10),
        realName: '管理员',
        status: 'active',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ---- 登录 ----
  it('正确凭据登录 → 200 + Set-Cookie + 用户信息', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: '123456' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.user.username).toBe('admin');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('错误密码 → HTTP 401 + 业务码 5001', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe(5001);
  });

  // ---- 当前用户 ----
  it('未登录访问 /auth/me → 401 + 业务码 5002', async () => {
    const res = await inject(app, { method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe(5002);
  });

  it('携带 token 访问 /auth/me → 200 返回当前用户', async () => {
    const login = await inject(app, {
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: '123456' },
    });
    const cookies = login.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = (cookies as string | string[]);
    const cookie = (Array.isArray(cookieStr) ? cookieStr[0] : cookieStr).split(';')[0];
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.user.username).toBe('admin');
  });

  // ---- 权限守卫（RBAC） ----
  it('有权限访问受保护接口 → 200', async () => {
    const login = await inject(app, {
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: '123456' },
    });
    const cookies = login.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = (cookies as string | string[]);
    const cookie = (Array.isArray(cookieStr) ? cookieStr[0] : cookieStr).split(';')[0];
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it('无权限用户访问受保护接口 → 403 + 业务码 5003', async () => {
    // 种子一个无权限用户 staff
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), realName: '普通员工', status: 'active' },
    });
    const login = await inject(app, {
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'staff', password: '123456' },
    });
    const cookies = login.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = (cookies as string | string[]);
    const cookie = (Array.isArray(cookieStr) ? cookieStr[0] : cookieStr).split(';')[0];
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
    await prisma.user.delete({ where: { username: 'staff' } });
  });
});
