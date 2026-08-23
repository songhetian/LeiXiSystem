// S12 · 知识库增强（阅读统计日表 + 预览token验证）e2e（TDD RED 先行）
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

describe('S12 · 知识库增强（阅读统计日表 + 预览token验证）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let categoryId: number;
  let articleId: number;
  let attachmentId: number;

  beforeAll(async () => {
    await prisma.knowledgeArticleDailyStat.deleteMany();
    await prisma.knowledgeAttachment.deleteMany();
    await prisma.knowledgeArticle.deleteMany();
    await prisma.knowledgeCategory.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();

    const permManage = await prisma.permission.create({
      data: { code: 'knowledge:manage', name: '知识库管理', module: 'knowledge', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'knowledge:view', name: '知识库查看', module: 'knowledge', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: staffRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_stat', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_stat', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const cat = await prisma.knowledgeCategory.create({ data: { name: '培训资料' } });
    categoryId = cat.id;

    const article = await prisma.knowledgeArticle.create({
      data: {
        categoryId,
        title: '入职指南',
        content: '# 欢迎',
        createdBy: admin.id,
        viewCount: 10,
      },
    });
    articleId = article.id;

    const att = await prisma.knowledgeAttachment.create({
      data: {
        articleId,
        fileName: '培训手册.pdf',
        fileUrl: 'https://oss.example.com/handbook.pdf',
        fileSize: 2048000,
        mimeType: 'application/pdf',
      },
    });
    attachmentId = att.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    const twoDaysAgo = new Date(today.getTime() - 86400000 * 2);
    await prisma.knowledgeArticleDailyStat.createMany({
      data: [
        { articleId, date: twoDaysAgo, viewCount: 3, uniqueViewers: 2 },
        { articleId, date: yesterday, viewCount: 5, uniqueViewers: 4 },
        { articleId, date: today, viewCount: 2, uniqueViewers: 2 },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin_stat');
    staffCookie = await login(app, 'staff_stat');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('阅读统计日表', () => {
    it('应该获取文章阅读趋势（按天统计）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${articleId}/stats/daily?days=7`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      const firstDay = body.data[0];
      expect(firstDay.date).toBeDefined();
      expect(firstDay.viewCount).toBeDefined();
      expect(firstDay.uniqueViewers).toBeDefined();
    });

    it('应该获取知识库总览统计', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/knowledge/stats/summary',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.totalArticles).toBeGreaterThanOrEqual(1);
      expect(body.data.totalCategories).toBeGreaterThanOrEqual(1);
      expect(body.data.totalViews).toBeGreaterThanOrEqual(10);
      expect(body.data.todayViews).toBeDefined();
    });

    it('查看文章详情时应该写入日统计记录', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/knowledge/articles',
        headers: { cookie: adminCookie },
        payload: {
          categoryId,
          title: '日统计测试文章',
          content: '测试内容',
        },
      });
      const createBody = JSON.parse(createRes.body);
      const newArticleId = createBody.data.id;

      const beforeRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${newArticleId}/stats/daily?days=7`,
        headers: { cookie: adminCookie },
      });
      const beforeBody = JSON.parse(beforeRes.body);
      expect(beforeBody.data.length).toBe(0);

      const view1 = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${newArticleId}`,
        headers: { cookie: staffCookie },
      });
      const view1Body = JSON.parse(view1.body);
      expect(view1.statusCode).toBe(200);
      expect(view1Body.code).toBe(0);

      const view2 = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${newArticleId}`,
        headers: { cookie: staffCookie },
      });
      const view2Body = JSON.parse(view2.body);
      expect(view2.statusCode).toBe(200);
      expect(view2Body.code).toBe(0);
      expect(view2Body.data.viewCount).toBe(view1Body.data.viewCount + 1);

      const afterRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${newArticleId}/stats/daily?days=7`,
        headers: { cookie: adminCookie },
      });
      const afterBody = JSON.parse(afterRes.body);
      expect(afterBody.data.length).toBe(1);
      expect(afterBody.data[0].viewCount).toBe(2);
      expect(afterBody.data[0].uniqueViewers).toBe(1);
    });

    it('普通员工不能查看统计 → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${articleId}/stats/daily`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('预览 token 验证', () => {
    it('应该能验证合法的预览 token', async () => {
      const urlRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-url?attachmentId=${attachmentId}`,
        headers: { cookie: staffCookie },
      });
      const urlBody = JSON.parse(urlRes.body);
      const previewUrl = urlBody.data.previewUrl;
      const tokenMatch = previewUrl.match(/token=([^&]+)/);
      expect(tokenMatch).not.toBeNull();
      const token = tokenMatch[1];

      const verifyRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-verify?token=${encodeURIComponent(token)}`,
      });
      const verifyBody = JSON.parse(verifyRes.body);
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyBody.code).toBe(0);
      expect(verifyBody.data.valid).toBe(true);
      expect(verifyBody.data.fileUrl).toBeDefined();
      expect(verifyBody.data.fileName).toBeDefined();
    });

    it('无效 token 验证失败', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/knowledge/preview-verify?token=invalid-token-12345',
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(false);
    });

    it('过期 token 验证失败', async () => {
      const expiredToken = 'eyJmaWxlVXJsIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9mLnBkZiIsImZpbGVOYW1lIjoidGVzdC5wZGYiLCJleHBpcmVzQXQiOjAsInNpZyI6ImJhZCJ9';
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-verify?token=${encodeURIComponent(expiredToken)}`,
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.valid).toBe(false);
    });

    it('不传 token 返回错误', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/knowledge/preview-verify',
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBeDefined();
    });
  });
});
