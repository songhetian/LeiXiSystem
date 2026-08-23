// S14 · 公告指定接收人 e2e（TDD RED 先行）
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

describe('S14 · 公告指定接收人（全员/部门/人员）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let deptAUserCookie: string;
  let deptBUserCookie: string;

  let deptAId: number;
  let deptBId: number;
  let userAId: number;
  let userBId: number;

  beforeAll(async () => {
    await prisma.broadcastRead.deleteMany();
    await prisma.broadcastRecipient.deleteMany();
    await prisma.broadcast.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();

    const permBroadcastManage = await prisma.permission.create({
      data: { code: 'system:broadcast:manage', name: '公告管理', module: 'system', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permBroadcastManage.id },
      ],
    });

    const admin = await prisma.user.create({
      data: { username: 'admin_r', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const userA = await prisma.user.create({
      data: { username: 'userA', passwordHash: await bcrypt.hash('123456', 10), realName: 'A部门员工' },
    });
    const userB = await prisma.user.create({
      data: { username: 'userB', passwordHash: await bcrypt.hash('123456', 10), realName: 'B部门员工' },
    });
    userAId = userA.id;
    userBId = userB.id;

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: userA.id, roleId: staffRole.id },
        { userId: userB.id, roleId: staffRole.id },
      ],
    });

    const deptA = await prisma.department.create({ data: { name: '研发部' } });
    const deptB = await prisma.department.create({ data: { name: '市场部' } });
    deptAId = deptA.id;
    deptBId = deptB.id;

    await prisma.employee.create({
      data: { name: '员工A', employeeNo: 'EA01', userId: userA.id, departmentId: deptA.id, hireDate: new Date('2024-01-01') },
    });
    await prisma.employee.create({
      data: { name: '员工B', employeeNo: 'EB01', userId: userB.id, departmentId: deptB.id, hireDate: new Date('2024-01-01') },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();
    adminCookie = await login(app, 'admin_r');
    deptAUserCookie = await login(app, 'userA');
    deptBUserCookie = await login(app, 'userB');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('创建公告时指定接收人', () => {
    it('创建全员公告（recipientType=all）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: { title: '全员通知', content: '这是全员公告', recipientType: 'all' },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.recipientType).toBe('all');
    });

    it('创建部门公告（recipientType=department + departmentIds）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: {
          title: '研发部通知',
          content: '研发部专属',
          recipientType: 'department',
          recipientDepartmentIds: [deptAId],
        },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.recipientType).toBe('department');
    });

    it('创建指定人员公告（recipientType=user + userIds）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: {
          title: '私人通知',
          content: '只给A看',
          recipientType: 'user',
          recipientUserIds: [userAId],
        },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.recipientType).toBe('user');
    });

    it('recipientType=department 但未传 departmentIds → 报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: { title: '缺部门', recipientType: 'department' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });
  });

  describe('员工端按接收人范围可见', () => {
    beforeAll(async () => {
      // 发布3篇公告：全员、研发部、只给A
      const drafts = await prisma.broadcast.findMany({ where: { status: 'draft' } });
      for (const d of drafts) {
        await inject(app, {
          method: 'POST',
          url: `/api/v1/system/broadcasts/${d.id}/publish`,
          headers: { cookie: adminCookie },
        });
      }
    });

    it('全员公告：所有用户都能看到', async () => {
      const resA = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptAUserCookie },
      });
      const resB = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptBUserCookie },
      });
      const listA = JSON.parse(resA.payload).data.list;
      const listB = JSON.parse(resB.payload).data.list;
      expect(listA.find((b: any) => b.title === '全员通知')).toBeDefined();
      expect(listB.find((b: any) => b.title === '全员通知')).toBeDefined();
    });

    it('部门公告：只有对应部门员工可见', async () => {
      const resA = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptAUserCookie },
      });
      const resB = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptBUserCookie },
      });
      const listA = JSON.parse(resA.payload).data.list;
      const listB = JSON.parse(resB.payload).data.list;
      expect(listA.find((b: any) => b.title === '研发部通知')).toBeDefined();
      expect(listB.find((b: any) => b.title === '研发部通知')).toBeUndefined();
    });

    it('指定人员公告：只有指定用户可见', async () => {
      const resA = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptAUserCookie },
      });
      const resB = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts',
        headers: { cookie: deptBUserCookie },
      });
      const listA = JSON.parse(resA.payload).data.list;
      const listB = JSON.parse(resB.payload).data.list;
      expect(listA.find((b: any) => b.title === '私人通知')).toBeDefined();
      expect(listB.find((b: any) => b.title === '私人通知')).toBeUndefined();
    });

    it('未读数量按可见范围计算', async () => {
      const resA = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts/unread-count',
        headers: { cookie: deptAUserCookie },
      });
      const resB = await inject(app, {
        method: 'GET',
        url: '/api/v1/broadcasts/unread-count',
        headers: { cookie: deptBUserCookie },
      });
      // A 可见 3 篇（全员+研发部+私人），B 可见 1 篇（全员）
      expect(JSON.parse(resA.payload).data.count).toBe(3);
      expect(JSON.parse(resB.payload).data.count).toBe(1);
    });
  });

  describe('更新公告接收人', () => {
    let bcId: number;

    beforeAll(async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/broadcasts',
        headers: { cookie: adminCookie },
        payload: { title: '待改公告', recipientType: 'all' },
      });
      bcId = JSON.parse(res.payload).data.id;
    });

    it('草稿状态可修改接收人类型和范围', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/broadcasts/${bcId}`,
        headers: { cookie: adminCookie },
        payload: { recipientType: 'department', recipientDepartmentIds: [deptBId] },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.recipientType).toBe('department');
    });

    it('已发布公告不能修改接收人', async () => {
      await inject(app, {
        method: 'POST',
        url: `/api/v1/system/broadcasts/${bcId}/publish`,
        headers: { cookie: adminCookie },
      });
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/broadcasts/${bcId}`,
        headers: { cookie: adminCookie },
        payload: { recipientType: 'all' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });
  });

  describe('公告详情包含接收人信息', () => {
    it('管理端详情返回接收人配置', async () => {
      const bc = await prisma.broadcast.findFirst({ where: { title: '研发部通知' } });
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/system/broadcasts/${bc!.id}`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.recipientType).toBe('department');
      expect(body.data.recipients).toBeDefined();
    });
  });
});
