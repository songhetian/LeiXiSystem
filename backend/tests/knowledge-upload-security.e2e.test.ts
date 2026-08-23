// 知识库附件上传安全校验 e2e 测试
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { ERROR_CODES } from '../src/common/error-codes';

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

describe('知识库附件上传安全校验', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let articleId: number;

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
      data: { username: 'sec_admin_upload', passwordHash: await bcrypt.hash('123456', 10), realName: '安全管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'sec_staff_upload', passwordHash: await bcrypt.hash('123456', 10), realName: '安全员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const cat = await prisma.knowledgeCategory.create({ data: { name: '安全测试分类' } });
    const article = await prisma.knowledgeArticle.create({
      data: { categoryId: cat.id, title: '安全测试文章', content: 'test', createdBy: admin.id },
    });
    articleId = article.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'sec_admin_upload');
    staffCookie = await login(app, 'sec_staff_upload');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('合法文件类型上传成功', () => {
    it('PDF 文档上传成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '安全手册.pdf',
          fileUrl: '/uploads/knowledge/安全手册.pdf',
          fileSize: 1024000,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.fileName).toBe('安全手册.pdf');
    });

    it('DOCX 文档上传成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '培训资料.docx',
          fileUrl: '/uploads/knowledge/培训资料.docx',
          fileSize: 2048000,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });

    it('PNG 图片上传成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '截图.png',
          fileUrl: '/uploads/knowledge/截图.png',
          fileSize: 512000,
          mimeType: 'image/png',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });

    it('TXT 文本上传成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '说明.txt',
          fileUrl: '/uploads/knowledge/说明.txt',
          fileSize: 10240,
          mimeType: 'text/plain',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });
  });

  describe('非法文件类型上传失败', () => {
    it('EXE 可执行文件被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'malicious.exe',
          fileUrl: '/uploads/knowledge/malicious.exe',
          fileSize: 1000,
          mimeType: 'application/x-msdownload',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
    });

    it('JS 脚本文件被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'xss.js',
          fileUrl: '/uploads/knowledge/xss.js',
          fileSize: 1000,
          mimeType: 'application/javascript',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
    });

    it('HTML 文件被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'phish.html',
          fileUrl: '/uploads/knowledge/phish.html',
          fileSize: 1000,
          mimeType: 'text/html',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
    });

    it('SVG 文件被拒绝（XSS 风险）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'image.svg',
          fileUrl: '/uploads/knowledge/image.svg',
          fileSize: 1000,
          mimeType: 'image/svg+xml',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
    });

    it('CSS 文件被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'style.css',
          fileUrl: '/uploads/knowledge/style.css',
          fileSize: 1000,
          mimeType: 'text/css',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
    });
  });

  describe('文件大小校验', () => {
    it('超过 10MB 的文件被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'large.pdf',
          fileUrl: '/uploads/knowledge/large.pdf',
          fileSize: 11 * 1024 * 1024,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      expect(body.message).toContain('10MB');
    });

    it('等于 10MB 的文件允许上传', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'exact-10mb.pdf',
          fileUrl: '/uploads/knowledge/exact-10mb.pdf',
          fileSize: 10 * 1024 * 1024,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });
  });

  describe('文件名安全处理', () => {
    it('路径遍历文件名被安全处理', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: '../../../etc/passwd.pdf',
          fileUrl: '/uploads/knowledge/test.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.fileName).not.toContain('..');
      expect(body.data.fileName).not.toContain('/');
      expect(body.data.fileName).not.toContain('\\');
    });

    it('扩展名大小写不敏感（.PDF 上传成功）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: adminCookie },
        payload: {
          fileName: 'DOCUMENT.PDF',
          fileUrl: '/uploads/knowledge/document.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
    });
  });

  describe('权限校验', () => {
    it('无管理权限的员工不能上传附件 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/knowledge/articles/${articleId}/attachments`,
        headers: { cookie: staffCookie },
        payload: {
          fileName: 'test.pdf',
          fileUrl: '/uploads/knowledge/test.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
