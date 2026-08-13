import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { SettingsModule } from '../src/settings/settings.module';

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

describe('T23 · 系统参数设置模块', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    // 幂等准备：admin 角色(535) + 用户 + 设置管理权限 + 默认参数
    const adminRole = await prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin', name: '管理员' },
    });
    const perm = await prisma.permission.upsert({
      where: { code: 'system:setting:update' },
      update: {},
      create: { code: 'system:setting:update', name: '系统设置管理', module: 'system', type: 'api' },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const staff = await prisma.user.upsert({
      where: { username: 'staff' },
      update: {},
      create: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
    const staffRole = await prisma.role.upsert({
      where: { code: 'staff' },
      update: {},
      create: { code: 'staff', name: '普通员工' },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: staff.id, roleId: staffRole.id } },
      update: {},
      create: { userId: staff.id, roleId: staffRole.id },
    });
    await prisma.systemSetting.upsert({
      where: { key: 'companyName' },
      update: { value: '雷犀科技' },
      create: { group: 'general', key: 'companyName', value: '雷犀科技', label: '公司名称' },
    });
    // 变更目标（独立 key，避免污染 companyName 的读取断言）
    await prisma.systemSetting.upsert({
      where: { key: 'themeColor' },
      update: { value: 'blue' },
      create: { group: 'general', key: 'themeColor', value: 'blue', label: '主题色' },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('RED→GREEN: GET /settings 返回已种子参数(含 companyName)', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/settings',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe(0);
    const company = body.data.find((s: any) => s.key === 'companyName');
    expect(company).toBeDefined();
    expect(company.value).toBe('雷犀科技');
  });

  it('RED→GREEN: GET /settings/:key 返回单条', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/settings/companyName',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.value).toBe('雷犀科技');
  });

  it('RED→GREEN: PUT /settings/:key 更新值并持久化', async () => {
    const res = await inject(app, {
      method: 'PUT',
      url: '/api/v1/settings/themeColor',
      headers: { cookie: adminCookie },
      payload: { value: 'green' },
    });
    expect(res.statusCode).toBe(200);
    const get = await inject(app, {
      method: 'GET',
      url: '/api/v1/settings/themeColor',
      headers: { cookie: adminCookie },
    });
    expect(JSON.parse(get.payload).data.value).toBe('green');
  });

  it('RED→GREEN: 无更新权限的 staff 调用 PUT → 403', async () => {
    const res = await inject(app, {
      method: 'PUT',
      url: '/api/v1/settings/themeColor',
      headers: { cookie: staffCookie },
      payload: { value: '黑客改色' },
    });
    expect(res.statusCode).toBe(403);
  });
});
