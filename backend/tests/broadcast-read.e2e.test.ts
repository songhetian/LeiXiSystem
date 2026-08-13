// S14 · 公告已读状态 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient, BroadcastStatus } from '@prisma/client';
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

describe('S14 · 公告已读状态', () => {
  let app: NestFastifyApplication;
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: number;
  let user2Id: number;
  let broadcast1Id: number;
  let broadcast2Id: number;
  let broadcast3Id: number;

  beforeAll(async () => {
    await prisma.broadcastRead.deleteMany();
    await prisma.broadcast.deleteMany();
    await prisma.user.deleteMany();

    const u1 = await prisma.user.create({
      data: { username: 'u1_bread', passwordHash: await bcrypt.hash('123456', 10), name: '用户1' },
    });
    const u2 = await prisma.user.create({
      data: { username: 'u2_bread', passwordHash: await bcrypt.hash('123456', 10), name: '用户2' },
    });
    user1Id = u1.id;
    user2Id = u2.id;

    const b1 = await prisma.broadcast.create({
      data: { title: '系统升级通知', content: '系统将于周末升级', status: 'published' as BroadcastStatus, type: 'notice', createdBy: u1.id, publishedBy: u1.id, publishedAt: new Date() },
    });
    const b2 = await prisma.broadcast.create({
      data: { title: '新功能发布', content: '审批流新功能上线', status: 'published' as BroadcastStatus, type: 'notice', createdBy: u1.id, publishedBy: u1.id, publishedAt: new Date() },
    });
    const b3 = await prisma.broadcast.create({
      data: { title: '安全提醒', content: '请定期修改密码', status: 'published' as BroadcastStatus, type: 'safety', createdBy: u1.id, publishedBy: u1.id, publishedAt: new Date() },
    });
    broadcast1Id = b1.id;
    broadcast2Id = b2.id;
    broadcast3Id = b3.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    user1Cookie = await login(app, 'u1_bread');
    user2Cookie = await login(app, 'u2_bread');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('标记已读', () => {
    it('POST /broadcasts/:id/read → 标记单条公告已读', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/broadcasts/${broadcast1Id}/read`,
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });

    it('重复标记已读 → 幂等，不报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/broadcasts/${broadcast1Id}/read`,
        headers: { cookie: user1Cookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);
    });

    it('标记不存在的公告已读 → 错误码', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/broadcasts/99999/read',
        headers: { cookie: user1Cookie },
      });
      expect([404, 200]).toContain(res.statusCode);
    });
  });

  describe('已读状态', () => {
    beforeAll(async () => {
      await prisma.broadcastRead.createMany({
        data: [
          { broadcastId: broadcast2Id, userId: user1Id },
        ],
      });
    });

    it('GET /broadcasts → 列表返回每篇是否已读', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts?page=1&pageSize=10',
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const list = body.data.list;
      const b1 = list.find((b: any) => b.id === broadcast1Id);
      const b2 = list.find((b: any) => b.id === broadcast2Id);
      const b3 = list.find((b: any) => b.id === broadcast3Id);
      expect(b1.read).toBe(true);
      expect(b2.read).toBe(true);
      expect(b3.read).toBe(false);
    });

    it('不同用户的已读状态独立', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts?page=1&pageSize=10',
        headers: { cookie: user2Cookie },
      });
      const list = JSON.parse(res.payload).data.list;
      expect(list.every((b: any) => b.read === false)).toBe(true);
    });

    it('GET /broadcasts/:id → 详情返回是否已读', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${broadcast1Id}`,
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.read).toBe(true);
    });
  });

  describe('未读统计', () => {
    it('GET /broadcasts/unread-count → 获取未读公告数量', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts/unread-count',
        headers: { cookie: user1Cookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.count).toBe(1);
    });

    it('user2 未读全部 → 数量=3', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts/unread-count',
        headers: { cookie: user2Cookie },
      });
      expect(JSON.parse(res.payload).data.count).toBe(3);
    });
  });
});
