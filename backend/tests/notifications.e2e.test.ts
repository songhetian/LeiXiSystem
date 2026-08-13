// S11 · 通知中心 e2e（TDD RED 先行）
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

describe('S11 · 通知中心', () => {
  let app: NestFastifyApplication;
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: number;
  let user2Id: number;

  beforeAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permView = await prisma.permission.create({
      data: { code: 'notification:view', name: '通知查看', module: 'notification', type: 'menu' },
    });
    const userRole = await prisma.role.create({ data: { code: 'user', name: '用户' } });
    await prisma.rolePermission.create({
      data: { roleId: userRole.id, permissionId: permView.id },
    });

    const user1 = await prisma.user.create({
      data: { username: 'user_notify1', passwordHash: await bcrypt.hash('123456', 10), name: '用户1' },
    });
    const user2 = await prisma.user.create({
      data: { username: 'user_notify2', passwordHash: await bcrypt.hash('123456', 10), name: '用户2' },
    });
    user1Id = user1.id;
    user2Id = user2.id;

    await prisma.userRole.createMany({
      data: [
        { userId: user1.id, roleId: userRole.id },
        { userId: user2.id, roleId: userRole.id },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    user1Cookie = await login(app, 'user_notify1');
    user2Cookie = await login(app, 'user_notify2');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('通知列表', () => {
    beforeAll(async () => {
      await prisma.notification.createMany({
        data: [
          { userId: user1Id, title: '工资条已发布', content: '您2026年7月工资条已发布', type: 'payslip', read: false },
          { userId: user1Id, title: '请假审批通过', content: '您的事假申请已通过', type: 'leave', read: false },
          { userId: user1Id, title: '系统公告', content: '系统升级通知', type: 'system', read: true },
          { userId: user2Id, title: '加班审批通过', content: '您的加班申请已通过', type: 'overtime', read: false },
        ],
      });
    });

    it('GET /notifications → 我的通知列表（分页）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(3);
      expect(body.data.total).toBeGreaterThanOrEqual(3);
    });

    it('通知按创建时间倒序', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user1Cookie },
      });
      const list = JSON.parse(res.payload).data.list;
      for (let i = 0; i < list.length - 1; i++) {
        expect(new Date(list[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i + 1].createdAt).getTime());
      }
    });

    it('用户只能看到自己的通知', async () => {
      const res1 = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user1Cookie },
      });
      const list1 = JSON.parse(res1.payload).data.list;
      expect(list1.every((n: any) => n.userId === user1Id)).toBe(true);

      const res2 = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user2Cookie },
      });
      const list2 = JSON.parse(res2.payload).data.list;
      expect(list2.length).toBe(1);
      expect(list2[0].title).toBe('加班审批通过');
    });
  });

  describe('未读统计', () => {
    it('GET /notifications/unread-count → 未读数量', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.count).toBe(2);
    });
  });

  describe('标记已读', () => {
    it('POST /notifications/:id/read → 单条标记已读', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user1Cookie },
      });
      const unread = JSON.parse(listRes.payload).data.list.find((n: any) => !n.read);
      expect(unread).toBeDefined();

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/notifications/${unread.id}/read`,
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);

      const countRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: { cookie: user1Cookie },
      });
      expect(JSON.parse(countRes.payload).data.count).toBe(1);
    });

    it('POST /notifications/read-all → 全部标记已读', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/notifications/read-all',
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.count).toBe(1);

      const countRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: { cookie: user1Cookie },
      });
      expect(JSON.parse(countRes.payload).data.count).toBe(0);
    });

    it('不能标记他人通知为已读 → 404/错误码', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/notifications?page=1&pageSize=10',
        headers: { cookie: user2Cookie },
      });
      const user2Notification = JSON.parse(listRes.payload).data.list[0];

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/notifications/${user2Notification.id}/read`,
        headers: { cookie: user1Cookie },
      });
      expect([403, 404]).toContain(res.statusCode);
    });
  });
});
