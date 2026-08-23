// 知识库安全 · 路径遍历漏洞 + 下载端点 IDOR (TDD RED 先行)
// 漏洞1: resolveFilePath() 不校验路径遍历，/uploads/../../etc/passwd 可逃逸
// 漏洞2: downloadAttachment() 不校验 token 中的 fileUrl 与请求的 attachmentId 匹配
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
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

describe('知识库安全 · 路径遍历 + 下载 IDOR', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let articleId: number;

  // Attachment IDs
  let traversalAttId1: number; // fileUrl = /uploads/../../etc/passwd
  let traversalAttId2: number; // fileUrl = /etc/passwd (absolute)
  let validAttId: number;      // fileUrl = /uploads/knowledge/sec-valid.pdf (exists)
  let attAId: number;          // fileUrl = /uploads/knowledge/sec-a.pdf (exists)
  let attBId: number;          // fileUrl = /uploads/knowledge/sec-b.pdf (exists)

  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'knowledge');
  const testFiles = [
    path.join(uploadsDir, 'sec-valid.pdf'),
    path.join(uploadsDir, 'sec-a.pdf'),
    path.join(uploadsDir, 'sec-b.pdf'),
  ];

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.knowledgeAttachment.deleteMany();
    await prisma.knowledgeArticle.deleteMany();
    await prisma.knowledgeCategory.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    // ===== Permissions =====
    const permManage = await prisma.permission.create({
      data: { code: 'knowledge:manage', name: '知识库管理', module: 'knowledge', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'knowledge:view', name: '知识库查看', module: 'knowledge', type: 'menu' },
    });

    // ===== Roles =====
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: staffRole.id, permissionId: permView.id },
      ],
    });

    // ===== Users =====
    const admin = await prisma.user.create({
      data: { username: 'sec_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '安全管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'sec_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '安全员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    // ===== Category + Article =====
    const cat = await prisma.knowledgeCategory.create({ data: { name: '安全测试分类' } });
    const article = await prisma.knowledgeArticle.create({
      data: { categoryId: cat.id, title: '安全测试文章', content: 'test', createdBy: admin.id },
    });
    articleId = article.id;

    // ===== Create test files in uploads =====
    fs.mkdirSync(uploadsDir, { recursive: true });
    for (const f of testFiles) {
      fs.writeFileSync(f, Buffer.from('%PDF-1.4 security test file content'));
    }

    // ===== Create attachments =====
    const t1 = await prisma.knowledgeAttachment.create({
      data: { articleId, fileName: 'traversal1.pdf', fileUrl: '/uploads/../../etc/passwd', mimeType: 'application/pdf' },
    });
    traversalAttId1 = t1.id;

    const t2 = await prisma.knowledgeAttachment.create({
      data: { articleId, fileName: 'traversal2.pdf', fileUrl: '/etc/passwd', mimeType: 'application/pdf' },
    });
    traversalAttId2 = t2.id;

    const v = await prisma.knowledgeAttachment.create({
      data: { articleId, fileName: 'valid.pdf', fileUrl: '/uploads/knowledge/sec-valid.pdf', mimeType: 'application/pdf' },
    });
    validAttId = v.id;

    const a = await prisma.knowledgeAttachment.create({
      data: { articleId, fileName: 'a.pdf', fileUrl: '/uploads/knowledge/sec-a.pdf', mimeType: 'application/pdf' },
    });
    attAId = a.id;

    const b = await prisma.knowledgeAttachment.create({
      data: { articleId, fileName: 'b.pdf', fileUrl: '/uploads/knowledge/sec-b.pdf', mimeType: 'application/pdf' },
    });
    attBId = b.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'sec_admin');
    staffCookie = await login(app, 'sec_staff');
  });

  afterAll(async () => {
    // Cleanup test files
    for (const f of testFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    await app.close();
    await prisma.$disconnect();
  });

  // ================================================================
  // 漏洞1: 路径遍历防护 (P0)
  // ================================================================
  describe('路径遍历防护 (P0)', () => {
    it('fileUrl=/uploads/../../etc/passwd → 400 BadRequest', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${traversalAttId1}/download`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('fileUrl=/etc/passwd (绝对路径) → 400 BadRequest', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${traversalAttId2}/download`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('fileUrl=/uploads/knowledge/sec-valid.pdf (合法路径) → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${validAttId}/download`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ================================================================
  // 漏洞2: 下载端点 IDOR 防护 (P0)
  // ================================================================
  describe('下载端点 IDOR 防护 (P0)', () => {
    let tokenA: string;

    it('获取附件A的预览 token', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-url?attachmentId=${attAId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const tokenMatch = body.data.previewUrl.match(/token=([^&]+)/);
      expect(tokenMatch).not.toBeNull();
      tokenA = tokenMatch[1];
    });

    it('用附件A的 token 下载附件A → 200 (正常)', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${attAId}/download?token=${encodeURIComponent(tokenA)}`,
      });
      expect(res.statusCode).toBe(200);
    });

    it('用附件A的 token 下载附件B → 403 (IDOR)', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${attBId}/download?token=${encodeURIComponent(tokenA)}`,
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
