// S12 · 知识库 + Open-File-Viewer 预览 e2e（TDD RED 先行）
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

describe('S12 · 知识库 + Open-File-Viewer 预览', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let categoryId: number;
  let articleId: number;
  let attachmentId: number;

  beforeAll(async () => {
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
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
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

  describe('知识分类 CRUD', () => {
    it('应该创建分类成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/knowledge/categories',
        headers: { cookie: adminCookie },
        payload: { name: '新人培训' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
      categoryId = body.data.id;
    });

    it('应该获取分类列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/knowledge/categories',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('文章 CRUD + 阅读统计', () => {
    it('应该创建文章成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/knowledge/articles',
        headers: { cookie: adminCookie },
        payload: {
          categoryId,
          title: '入职手册',
          content: '# 欢迎加入',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
      articleId = body.data.id;
    });

    it('应该获取文章列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles?categoryId=${categoryId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('查看文章详情应该增加阅读量', async () => {
      const before = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${articleId}`,
        headers: { cookie: staffCookie },
      });
      const beforeBody = JSON.parse(before.body);
      const beforeCount = beforeBody.data.viewCount;

      const after = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${articleId}`,
        headers: { cookie: staffCookie },
      });
      const afterBody = JSON.parse(after.body);
      expect(afterBody.data.viewCount).toBe(beforeCount + 1);
    });

    it('无管理权限的员工不能创建文章 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/knowledge/articles',
        headers: { cookie: staffCookie },
        payload: { categoryId, title: '测试', content: '测试内容' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('附件 + 预览签名 URL', () => {
    it('应该为附件生成带签名的预览 URL', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '培训资料.pdf',
          fileUrl: 'https://oss.example.com/knowledge/train.pdf',
          fileSize: 1024000,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
      attachmentId = body.data.id;
    });

    it('GET /knowledge/preview-url 应该返回前端预览路由 URL', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-url?attachmentId=${attachmentId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.previewUrl).toBeDefined();
      expect(body.data.previewUrl).toContain('token=');
      expect(body.data.previewUrl).toMatch(/^\/knowledge\/preview\//);
      expect(body.data.expiresAt).toBeDefined();
    });

    it('附件列表应该包含附件信息', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
