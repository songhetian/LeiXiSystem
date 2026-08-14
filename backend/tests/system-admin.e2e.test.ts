// S14 · 系统管理（操作日志 + 公告 + 用户/角色管理）e2e（TDD RED 先行）
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

describe('S14 · 系统管理（操作日志 + 公告）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    await prisma.operationLog.deleteMany();
    await prisma.broadcast.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();

    const permSystem = await prisma.permission.create({
      data: { code: 'system:manage', name: '系统管理', module: 'system', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'system:view', name: '系统查看', module: 'system', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permSystem.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('操作日志', () => {
    it('写操作应该自动记录操作日志', async () => {
      const before = await prisma.operationLog.count();

      await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: { title: '测试公告', content: '测试内容' },
      });

      const after = await prisma.operationLog.count();
      expect(after).toBeGreaterThan(before);
    });

    it('GET /system/logs 应该返回操作日志列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/logs?page=1&pageSize=20',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('普通员工不能查看操作日志 → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/logs',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('公告管理', () => {
    it('应该创建公告成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: { title: '系统升级通知', content: '今晚系统升级', type: 'notice' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
    });

    it('应该获取公告列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/broadcasts?page=1&pageSize=20',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('发布公告后状态变为 published', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/broadcasts?status=draft',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const draftId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/system/broadcasts/${draftId}/publish`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('published');
      expect(body.data.publishedAt).toBeDefined();
    });

    it('员工可以查看已发布的公告', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
      expect(body.data.list[0].status).toBe('published');
    });
  });

  describe('用户管理', () => {
    it('应该获取用户列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/users?page=1&pageSize=20',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });

    it('应该为用户分配角色', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/users?page=1&pageSize=20',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const staffUser = listBody.data.list.find((u: any) => u.username === 'staff');
      const roleRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
      });
      const roleBody = JSON.parse(roleRes.body);
      const adminRoleId = roleBody.data.find((r: any) => r.code === 'admin').id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/system/users/${staffUser.id}/roles`,
        headers: { cookie: adminCookie },
        payload: { roleIds: [adminRoleId] },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });

    it('重置密码后旧密码不可登录、新密码可登录（T27）', async () => {
      const created = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/users',
        headers: { cookie: adminCookie },
        payload: { username: 'pwreset', password: 'old123456', name: '密码重置测试' },
      });
      const createdBody = JSON.parse(created.body);
      expect(created.statusCode).toBe(200);
      const uid = createdBody.data.id;

      const upd = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/users/${uid}`,
        headers: { cookie: adminCookie },
        payload: { password: 'new123456' },
      });
      expect(upd.statusCode).toBe(200);
      expect(JSON.parse(upd.body).code).toBe(0);

      const oldLogin = await inject(app, {
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'pwreset', password: 'old123456' },
      });
      expect(JSON.parse(oldLogin.body).code).toBe(5001);

      const newLogin = await inject(app, {
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'pwreset', password: 'new123456' },
      });
      expect(JSON.parse(newLogin.body).code).toBe(0);
    });

    it('应该获取角色列表（含权限点）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
