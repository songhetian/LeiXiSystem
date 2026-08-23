// 审批组 PermissionGuard 防护 (TDD RED 先行)
// 漏洞4: approval-group.controller.ts 仅有 JwtAuthGuard，缺少 PermissionGuard 和 @RequirePermission
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

describe('审批组 PermissionGuard 防护 (P0)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let noPermCookie: string;
  let groupId: number;

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.approvalGroup.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    // ===== Permissions =====
    const permManage = await prisma.permission.create({
      data: { code: 'approval:manage', name: '审批管理', module: 'approval', type: 'menu' },
    });
    // 给无权限用户一个无关权限，确保能登录但无法访问审批组
    const permOther = await prisma.permission.create({
      data: { code: 'system:log', name: '日志查看', module: 'system', type: 'menu' },
    });

    // ===== Roles =====
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const noPermRole = await prisma.role.create({ data: { code: 'noperm', name: '无审批权限' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: noPermRole.id, permissionId: permOther.id },
      ],
    });

    // ===== Users =====
    const admin = await prisma.user.create({
      data: { username: 'ag_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const noPerm = await prisma.user.create({
      data: { username: 'ag_noperm', passwordHash: await bcrypt.hash('123456', 10), realName: '无权限用户' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: noPerm.id, roleId: noPermRole.id },
      ],
    });

    // ===== Approval Group =====
    const group = await prisma.approvalGroup.create({
      data: { code: 'AG-TDD-001', name: '权限测试审批组', description: 'TDD test', createdBy: admin.id },
    });
    groupId = group.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'ag_admin');
    noPermCookie = await login(app, 'ag_noperm');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('无权限用户被拦截', () => {
    it('无权限用户 GET /approval/groups → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: noPermCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('无权限用户 GET /approval/groups/:id → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: noPermCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('无权限用户 POST /approval/groups → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: noPermCookie },
        payload: { name: 'hacked-group', code: 'HACK-001', description: 'should fail' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('无权限用户 PUT /approval/groups/:id → 403', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: noPermCookie },
        payload: { name: 'hacked-name' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('无权限用户 DELETE /approval/groups/:id → 403', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: noPermCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('有权限用户正常访问', () => {
    it('管理员 GET /approval/groups → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('管理员 GET /approval/groups/:id → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });
});
