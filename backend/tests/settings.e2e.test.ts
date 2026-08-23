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
    const adminRole = await prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin', name: '管理员' },
    });
    const updatePerm = await prisma.permission.upsert({
      where: { code: 'system:setting:update' },
      update: {},
      create: { code: 'system:setting:update', name: '系统设置管理', module: 'system', type: 'api' },
    });
    const viewPerm = await prisma.permission.upsert({
      where: { code: 'system:setting:view' },
      update: {},
      create: { code: 'system:setting:view', name: '系统设置查看', module: 'system', type: 'api' },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: updatePerm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: updatePerm.id },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: viewPerm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: viewPerm.id },
    });
    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: { passwordHash: await bcrypt.hash('123456', 10) },
      create: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.upsert({
      where: { username: 'staff' },
      update: { passwordHash: await bcrypt.hash('123456', 10) },
      create: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
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
    await prisma.systemSetting.upsert({
      where: { key: 'themeColor' },
      update: { value: 'blue' },
      create: { group: 'general', key: 'themeColor', value: 'blue', label: '主题色' },
    });
    await prisma.systemSetting.upsert({
      where: { key: 'historyTestKey' },
      update: { value: 'initial' },
      create: { group: 'general', key: 'historyTestKey', value: 'initial', label: '历史测试键' },
    });
    await prisma.systemSettingHistory.deleteMany({ where: { settingKey: 'historyTestKey' } });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
  }, 60000);

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

  describe('T23-2 · 配置变更历史', () => {
    it('修改配置后产生历史记录', async () => {
      const beforeCount = await prisma.systemSettingHistory.count({ where: { settingKey: 'historyTestKey' } });
      const res = await inject(app, {
        method: 'PUT',
        url: '/api/v1/settings/historyTestKey',
        headers: { cookie: adminCookie },
        payload: { value: 'changed' },
      });
      expect(res.statusCode).toBe(200);
      const afterCount = await prisma.systemSettingHistory.count({ where: { settingKey: 'historyTestKey' } });
      expect(afterCount).toBe(beforeCount + 1);
      const history = await prisma.systemSettingHistory.findFirst({
        where: { settingKey: 'historyTestKey' },
        orderBy: { changedAt: 'desc' },
      });
      expect(history).toBeDefined();
      expect(history!.oldValue).toBe('initial');
      expect(history!.newValue).toBe('changed');
    });

    it('未修改的配置不产生历史记录', async () => {
      const beforeCount = await prisma.systemSettingHistory.count({ where: { settingKey: 'historyTestKey' } });
      const res = await inject(app, {
        method: 'PUT',
        url: '/api/v1/settings/historyTestKey',
        headers: { cookie: adminCookie },
        payload: { value: 'changed' },
      });
      expect(res.statusCode).toBe(200);
      const afterCount = await prisma.systemSettingHistory.count({ where: { settingKey: 'historyTestKey' } });
      expect(afterCount).toBe(beforeCount);
    });

    it('GET /settings/history 查询变更历史按时间倒序', async () => {
      await prisma.systemSettingHistory.deleteMany({ where: { settingKey: 'historyTestKey' } });
      await prisma.systemSetting.update({ where: { key: 'historyTestKey' }, data: { value: 'initial' } });
      await inject(app, {
        method: 'PUT',
        url: '/api/v1/settings/historyTestKey',
        headers: { cookie: adminCookie },
        payload: { value: 'v1' },
      });
      await new Promise((r) => setTimeout(r, 10));
      await inject(app, {
        method: 'PUT',
        url: '/api/v1/settings/historyTestKey',
        headers: { cookie: adminCookie },
        payload: { value: 'v2' },
      });
      await new Promise((r) => setTimeout(r, 10));
      await inject(app, {
        method: 'PUT',
        url: '/api/v1/settings/historyTestKey',
        headers: { cookie: adminCookie },
        payload: { value: 'v3' },
      });

      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/settings/history',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const items = body.data.filter((h: any) => h.settingKey === 'historyTestKey');
      expect(items.length).toBe(3);
      expect(items[0].newValue).toBe('v3');
      expect(items[1].newValue).toBe('v2');
      expect(items[2].newValue).toBe('v1');
    });

    it('GET /settings/history?key=xxx 按 key 筛选', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/settings/history?key=historyTestKey',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((h: any) => {
        expect(h.settingKey).toBe('historyTestKey');
      });
    });

    it('无查看权限的 staff 调用 GET /settings/history → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/settings/history',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
