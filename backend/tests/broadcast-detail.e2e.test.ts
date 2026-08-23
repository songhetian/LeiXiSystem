// 公告详情发布状态 + 接收人校验 (TDD RED 先行)
// 漏洞5: GET /broadcasts/:id 不校验公告是否已发布，不校验用户是否为接收人
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient, BroadcastRecipientType } from '@prisma/client';
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

describe('公告详情发布状态 + 接收人校验 (P1)', () => {
  let app: NestFastifyApplication;
  let inDeptCookie: string;
  let outDeptCookie: string;
  let draftBcId: number;
  let publishedAllId: number;
  let publishedUserId: number;
  let publishedDeptId: number;

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.broadcastRead.deleteMany();
    await prisma.broadcastRecipient.deleteMany();
    await prisma.broadcast.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    // ===== Permissions (a dummy permission so users can log in) =====
    const perm = await prisma.permission.create({
      data: { code: 'broadcast:view', name: '公告查看', module: 'system', type: 'menu' },
    });
    const role = await prisma.role.create({ data: { code: 'staff', name: '员工' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });

    // ===== Departments =====
    const deptA = await prisma.department.create({ data: { name: '部门A-BRD' } });
    const deptB = await prisma.department.create({ data: { name: '部门B-BRD' } });

    // ===== Users + Employees =====
    const userIn = await prisma.user.create({
      data: { username: 'brd_in', passwordHash: await bcrypt.hash('123456', 10), realName: '部门A员工' },
    });
    const userOut = await prisma.user.create({
      data: { username: 'brd_out', passwordHash: await bcrypt.hash('123456', 10), realName: '部门B员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: userIn.id, roleId: role.id },
        { userId: userOut.id, roleId: role.id },
      ],
    });
    await prisma.employee.create({
      data: {
        employeeNo: 'BRD-001', name: '部门A员工', departmentId: deptA.id,
        userId: userIn.id, salary: 8000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    await prisma.employee.create({
      data: {
        employeeNo: 'BRD-002', name: '部门B员工', departmentId: deptB.id,
        userId: userOut.id, salary: 9000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });

    // ===== Broadcasts =====
    // 1. Draft (unpublished)
    const draft = await prisma.broadcast.create({
      data: {
        title: '草稿公告', content: 'draft content', type: 'notice',
        recipientType: 'all', createdBy: userIn.id, status: 'draft',
      },
    });
    draftBcId = draft.id;

    // 2. Published, recipientType=all
    const pubAll = await prisma.broadcast.create({
      data: {
        title: '全员公告', content: 'all content', type: 'notice',
        recipientType: 'all', createdBy: userIn.id, status: 'published',
        publishedBy: userIn.id, publishedAt: new Date(),
      },
    });
    publishedAllId = pubAll.id;

    // 3. Published, recipientType=user, recipient = userIn
    const pubUser = await prisma.broadcast.create({
      data: {
        title: '指定用户公告', content: 'user content', type: 'notice',
        recipientType: 'user', createdBy: userIn.id, status: 'published',
        publishedBy: userIn.id, publishedAt: new Date(),
        recipients: { create: [{ recipientType: BroadcastRecipientType.user, userId: userIn.id }] },
      },
    });
    publishedUserId = pubUser.id;

    // 4. Published, recipientType=department, recipient = deptA
    const pubDept = await prisma.broadcast.create({
      data: {
        title: '指定部门公告', content: 'dept content', type: 'notice',
        recipientType: 'department', createdBy: userIn.id, status: 'published',
        publishedBy: userIn.id, publishedAt: new Date(),
        recipients: { create: [{ recipientType: BroadcastRecipientType.department, departmentId: deptA.id }] },
      },
    });
    publishedDeptId = pubDept.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    inDeptCookie = await login(app, 'brd_in');
    outDeptCookie = await login(app, 'brd_out');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('发布状态校验', () => {
    it('未发布公告 GET /broadcasts/:id → 404', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${draftBcId}`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('接收人范围校验', () => {
    it('全员公告 → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${publishedAllId}`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('指定用户公告 - 接收人 → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${publishedUserId}`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(200);
    });

    it('指定用户公告 - 非接收人 → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${publishedUserId}`,
        headers: { cookie: outDeptCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('指定部门公告 - 部门内 → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${publishedDeptId}`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(200);
    });

    it('指定部门公告 - 部门外 → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/broadcasts/${publishedDeptId}`,
        headers: { cookie: outDeptCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ================================================================
  // markRead 发布状态校验 (P2): 未发布公告不可标记已读
  // ================================================================
  describe('markRead 发布状态校验 (P2)', () => {
    it('标记未发布公告为已读 → 404', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/broadcasts/${draftBcId}/read`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('标记已发布全员公告为已读 → 200', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/broadcasts/${publishedAllId}/read`,
        headers: { cookie: inDeptCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });
});
