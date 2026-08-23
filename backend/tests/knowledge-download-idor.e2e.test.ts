// 知识库下载端点 JWT cookie IDOR 漏洞 (TDD RED 先行)
// 漏洞: downloadAttachment() 当请求携带有效 JWT cookie 但无 preview token 时，
// tokenFileUrl 保持 undefined，IDOR 校验被跳过，任何已登录用户可枚举 attachmentId 下载任意附件
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

describe('知识库下载 JWT cookie IDOR 防护 (P0)', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;    // has knowledge:view
  let noviewCookie: string;   // no knowledge:view permission
  let adminCookie: string;    // has knowledge:manage

  let publishedAttId: number;    // attachment of a published article
  let draftAttId: number;        // attachment of a draft (unpublished) article
  let previewTokenAttId: number; // attachment for preview token regression test

  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'knowledge');
  const testFiles = [
    path.join(uploadsDir, 'idor-published.pdf'),
    path.join(uploadsDir, 'idor-draft.pdf'),
    path.join(uploadsDir, 'idor-preview.pdf'),
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
    const noviewRole = await prisma.role.create({ data: { code: 'noview', name: '无查看权限角色' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: staffRole.id, permissionId: permView.id },
        // noviewRole has NO knowledge permissions
      ],
    });

    // ===== Users =====
    const admin = await prisma.user.create({
      data: { username: 'idor_admin', passwordHash: await bcrypt.hash('123456', 10), realName: 'IDOR管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'idor_staff', passwordHash: await bcrypt.hash('123456', 10), realName: 'IDOR员工' },
    });
    const noview = await prisma.user.create({
      data: { username: 'idor_noview', passwordHash: await bcrypt.hash('123456', 10), realName: 'IDOR无权限用户' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
        { userId: noview.id, roleId: noviewRole.id },
      ],
    });

    // ===== Category + Articles =====
    const cat = await prisma.knowledgeCategory.create({ data: { name: 'IDOR测试分类' } });

    // Published article
    const pubArticle = await prisma.knowledgeArticle.create({
      data: { categoryId: cat.id, title: '已发布文章', content: 'test', createdBy: admin.id, status: 'published' },
    });

    // Draft (unpublished) article
    const draftArticle = await prisma.knowledgeArticle.create({
      data: { categoryId: cat.id, title: '草稿文章', content: 'test', createdBy: admin.id, status: 'draft' },
    });

    // Another published article for preview token regression test
    const previewArticle = await prisma.knowledgeArticle.create({
      data: { categoryId: cat.id, title: '预览测试文章', content: 'test', createdBy: admin.id, status: 'published' },
    });

    // ===== Create test files =====
    fs.mkdirSync(uploadsDir, { recursive: true });
    for (const f of testFiles) {
      fs.writeFileSync(f, Buffer.from('%PDF-1.4 IDOR test file content'));
    }

    // ===== Create attachments =====
    const pubAtt = await prisma.knowledgeAttachment.create({
      data: { articleId: pubArticle.id, fileName: 'published.pdf', fileUrl: '/uploads/knowledge/idor-published.pdf', mimeType: 'application/pdf' },
    });
    publishedAttId = pubAtt.id;

    const draftAtt = await prisma.knowledgeAttachment.create({
      data: { articleId: draftArticle.id, fileName: 'draft.pdf', fileUrl: '/uploads/knowledge/idor-draft.pdf', mimeType: 'application/pdf' },
    });
    draftAttId = draftAtt.id;

    const previewAtt = await prisma.knowledgeAttachment.create({
      data: { articleId: previewArticle.id, fileName: 'preview.pdf', fileUrl: '/uploads/knowledge/idor-preview.pdf', mimeType: 'application/pdf' },
    });
    previewTokenAttId = previewAtt.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'idor_admin');
    staffCookie = await login(app, 'idor_staff');
    noviewCookie = await login(app, 'idor_noview');
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
  // 测试1: 已登录 staff (有 knowledge:view) 通过 JWT cookie 下载已发布文章附件 → 200
  // ================================================================
  it('staff 通过 JWT cookie 下载已发布文章附件 → 200', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/knowledge/attachments/${publishedAttId}/download`,
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(200);
  });

  // ================================================================
  // 测试2: 已登录 staff 通过 JWT cookie 下载未发布文章附件 → 403
  // ================================================================
  it('staff 通过 JWT cookie 下载未发布文章附件 → 403', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/knowledge/attachments/${draftAttId}/download`,
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // ================================================================
  // 测试3: 已登录 noview (无 knowledge:view) 通过 JWT cookie 下载已发布文章附件 → 403
  // ================================================================
  it('无 knowledge:view 权限用户通过 JWT cookie 下载已发布文章附件 → 403', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/knowledge/attachments/${publishedAttId}/download`,
      headers: { cookie: noviewCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // ================================================================
  // 测试4: 未登录用户无 token 无 cookie 下载 → 401
  // ================================================================
  it('未登录用户下载附件 → 401', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/knowledge/attachments/${publishedAttId}/download`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ================================================================
  // 测试5: 有效 preview token 下载附件仍然正常工作（回归测试）
  // ================================================================
  describe('preview token 回归测试', () => {
    let previewToken: string;

    it('获取预览 token', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/preview-url?attachmentId=${previewTokenAttId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const tokenMatch = body.data.previewUrl.match(/token=([^&]+)/);
      expect(tokenMatch).not.toBeNull();
      previewToken = tokenMatch[1];
    });

    it('用 preview token 下载附件 → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/knowledge/attachments/${previewTokenAttId}/download?token=${encodeURIComponent(previewToken)}`,
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
