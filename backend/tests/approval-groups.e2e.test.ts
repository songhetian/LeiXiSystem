// S09 · 审批组 CRUD e2e（TDD RED 先行）
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

describe('S09 · 审批组 CRUD', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let userCookie: string;
  let user1Id: number;
  let user2Id: number;
  let user3Id: number;

  beforeAll(async () => {
    await prisma.approvalGroupMember.deleteMany();
    await prisma.approvalGroup.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permManage = await prisma.permission.create({
      data: { code: 'approval:manage', name: '审批管理', module: 'approval', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'approval:view', name: '审批查看', module: 'approval', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });

    const admin = await prisma.user.create({
      data: { username: 'admin_group', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const u1 = await prisma.user.create({
      data: { username: 'u1_group', passwordHash: await bcrypt.hash('123456', 10), name: '用户1' },
    });
    const u2 = await prisma.user.create({
      data: { username: 'u2_group', passwordHash: await bcrypt.hash('123456', 10), name: '用户2' },
    });
    const u3 = await prisma.user.create({
      data: { username: 'u3_group', passwordHash: await bcrypt.hash('123456', 10), name: '用户3' },
    });
    user1Id = u1.id;
    user2Id = u2.id;
    user3Id = u3.id;

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: u1.id, roleId: staffRole.id },
        { userId: u2.id, roleId: staffRole.id },
        { userId: u3.id, roleId: staffRole.id },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin_group');
    userCookie = await login(app, 'u1_group');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('审批组 CRUD', () => {
    it('POST /approval/groups → 创建审批组', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: adminCookie },
        payload: { name: '财务审批组', code: 'finance_group', memberIds: [user1Id, user2Id] },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('财务审批组');
      expect(body.data.code).toBe('finance_group');
      expect(body.data.members).toHaveLength(2);
    });

    it('GET /approval/groups → 审批组列表', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: adminCookie },
        payload: { name: '人事审批组', code: 'hr_group', memberIds: [user3Id] },
      });

      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeGreaterThanOrEqual(2);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /approval/groups/:id → 审批组详情（含成员）', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const group = JSON.parse(listRes.payload).data.list[0];

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/groups/${group.id}`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.id).toBe(group.id);
      expect(body.data.members).toBeDefined();
      expect(body.data.members.length).toBeGreaterThan(0);
    });

    it('PUT /approval/groups/:id → 更新审批组（名称、成员）', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const group = JSON.parse(listRes.payload).data.list.find((g: any) => g.code === 'finance_group');

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/approval/groups/${group.id}`,
        headers: { cookie: adminCookie },
        payload: { name: '财务审批组（更新）', memberIds: [user1Id, user3Id] },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('财务审批组（更新）');
      expect(body.data.members).toHaveLength(2);
    });

    it('DELETE /approval/groups/:id → 删除审批组', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: adminCookie },
        payload: { name: '待删组', code: 'to_delete_group', memberIds: [] },
      });
      const groupId = JSON.parse(createRes.payload).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: adminCookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);

      const getRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/groups/${groupId}`,
        headers: { cookie: adminCookie },
      });
      expect([404, 200]).toContain(getRes.statusCode);
    });

    it('审批组编码重复 → 错误码', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: adminCookie },
        payload: { name: '重复编码组', code: 'hr_group', memberIds: [] },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).not.toBe(0);
    });
  });

  describe('边界用例', () => {
    it('创建空成员组 → 成功但members为空', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/groups',
        headers: { cookie: adminCookie },
        payload: { name: '空组', code: 'empty_group', memberIds: [] },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.members).toHaveLength(0);
    });

    it('更新时保留未指定字段', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/groups?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const group = JSON.parse(listRes.payload).data.list.find((g: any) => g.code === 'hr_group');

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/approval/groups/${group.id}`,
        headers: { cookie: adminCookie },
        payload: { status: 0 },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('人事审批组');
      expect(body.data.status).toBe(0);
    });
  });
});
