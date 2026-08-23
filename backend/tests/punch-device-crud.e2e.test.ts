// S05 · 打卡设备管理 CRUD e2e（TDD RED 先行）
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

describe('S05 · 打卡设备管理 CRUD（/api/v1/attendance/punch/devices）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    await prisma.punchSyncState.deleteMany();
    await prisma.punchDevice.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();

    const permManage = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_dev', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_dev', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
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
    adminCookie = await login(app, 'admin_dev');
    staffCookie = await login(app, 'staff_dev');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('创建设备', () => {
    it('POST /devices → 创建设备成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
        payload: { name: '大门设备', deviceNo: 'DEV001', ipAddress: '192.168.1.100', port: 80, apiKey: 'secret123' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('大门设备');
      expect(body.data.deviceNo).toBe('DEV001');
      expect(body.data.ipAddress).toBe('192.168.1.100');
      expect(body.data.enabled).toBe(true);
    });

    it('设备编号唯一约束：重复 deviceNo 报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
        payload: { name: '重复编号', deviceNo: 'DEV001', ipAddress: '192.168.1.101' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('必填字段校验：缺少 deviceNo 报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
        payload: { name: '缺编号', ipAddress: '192.168.1.102' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('端口默认 80，enabled 默认 true', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
        payload: { name: '默认值设备', deviceNo: 'DEV002', ipAddress: '192.168.1.103' },
      });
      const body = JSON.parse(res.payload);
      expect(body.data.port).toBe(80);
      expect(body.data.enabled).toBe(true);
    });

    it('无权限用户不能创建', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: staffCookie },
        payload: { name: '越权', deviceNo: 'DEV003', ipAddress: '192.168.1.104' },
      });
      expect(res.statusCode).not.toBe(200);
    });
  });

  describe('设备列表', () => {
    it('GET /devices → 返回设备列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('设备详情', () => {
    let deviceId: number;

    beforeAll(async () => {
      const d = await prisma.punchDevice.findFirst({ where: { deviceNo: 'DEV001' } });
      deviceId = d!.id;
    });

    it('GET /devices/:id → 返回设备详情', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/punch/devices/${deviceId}`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.id).toBe(deviceId);
      expect(body.data.deviceNo).toBe('DEV001');
    });

    it('GET /devices/:id 不存在 → 404', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/devices/99999',
        headers: { cookie: adminCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });

  describe('更新设备', () => {
    let deviceId: number;

    beforeAll(async () => {
      const d = await prisma.punchDevice.findFirst({ where: { deviceNo: 'DEV001' } });
      deviceId = d!.id;
    });

    it('PUT /devices/:id → 更新名称和 IP', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/attendance/punch/devices/${deviceId}`,
        headers: { cookie: adminCookie },
        payload: { name: '大门设备（更新）', ipAddress: '192.168.1.200' },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('大门设备（更新）');
      expect(body.data.ipAddress).toBe('192.168.1.200');
      expect(body.data.deviceNo).toBe('DEV001');
    });

    it('更新设备启用状态', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/attendance/punch/devices/${deviceId}`,
        headers: { cookie: adminCookie },
        payload: { enabled: false },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.enabled).toBe(false);
    });

    it('更新为已存在的 deviceNo → 冲突报错', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/attendance/punch/devices/${deviceId}`,
        headers: { cookie: adminCookie },
        payload: { deviceNo: 'DEV002' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('PUT /devices/:id 不存在 → 404', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: '/api/v1/attendance/punch/devices/99999',
        headers: { cookie: adminCookie },
        payload: { name: '不存在' },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });

  describe('删除设备', () => {
    it('DELETE /devices/:id → 删除设备成功', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
        payload: { name: '待删设备', deviceNo: 'DEV_DEL', ipAddress: '192.168.1.250' },
      });
      const id = JSON.parse(createRes.payload).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/attendance/punch/devices/${id}`,
        headers: { cookie: adminCookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);

      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/devices',
        headers: { cookie: adminCookie },
      });
      const list = JSON.parse(listRes.payload).data.list;
      expect(list.find((d: any) => d.id === id)).toBeUndefined();
    });

    it('DELETE /devices/:id 不存在 → 404', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: '/api/v1/attendance/punch/devices/99999',
        headers: { cookie: adminCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });
});
