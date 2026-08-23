// S05 · XFace600 同步服务 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PunchSyncService } from '../src/attendance/punch-sync.service';

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

describe('S05 · XFace600 打卡同步（/api/v1/attendance/punch/sync）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    await prisma.punchLog.deleteMany();
    await prisma.punchSyncState.deleteMany();
    await prisma.punchDevice.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

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
      data: { username: 'admin_sync', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_sync', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    await prisma.employee.create({
      data: { employeeNo: 'E201', name: '李四', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    await prisma.employee.create({
      data: { employeeNo: 'E202', name: '王五', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin_sync');
    staffCookie = await login(app, 'staff_sync');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('同步状态查询', () => {
    it('GET /attendance/punch/sync/status → 返回同步状态（lastSyncTime）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/sync/status',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.lastSyncTime).toBeDefined();
      expect(body.data.deviceStatus).toBeDefined();
    });

    it('无权限用户查询同步状态 → 403 + 5003', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/sync/status',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('手动触发同步', () => {
    it('POST /attendance/punch/sync → 手动触发同步，返回新增条数', async () => {
      const syncService = app.get(PunchSyncService) as any;
      syncService.fetchFromDevice = (jest.fn() as any).mockResolvedValue({
        ret: 0,
        total: 4,
        rows: [
          { emp_code: 'E201', punch_time: '2026-08-12 08:00:00', device_sn: 'DEV001' },
          { emp_code: 'E201', punch_time: '2026-08-12 18:00:00', device_sn: 'DEV001' },
          { emp_code: 'E202', punch_time: '2026-08-12 08:30:00', device_sn: 'DEV001' },
          { emp_code: 'E202', punch_time: '2026-08-12 17:45:00', device_sn: 'DEV001' },
        ],
      });

      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/sync',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.newCount).toBe(4);
      expect(body.data.source).toBe('api');
    });

    it('重复同步相同数据 → 去重，新增条数为0', async () => {
      const syncService = app.get(PunchSyncService) as any;
      syncService.fetchFromDevice = (jest.fn() as any).mockResolvedValue({
        ret: 0,
        total: 4,
        rows: [
          { emp_code: 'E201', punch_time: '2026-08-12 08:00:00', device_sn: 'DEV001' },
          { emp_code: 'E201', punch_time: '2026-08-12 18:00:00', device_sn: 'DEV001' },
          { emp_code: 'E202', punch_time: '2026-08-12 08:30:00', device_sn: 'DEV001' },
          { emp_code: 'E202', punch_time: '2026-08-12 17:45:00', device_sn: 'DEV001' },
        ],
      });

      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/sync',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.newCount).toBe(0);
    });

    it('增量同步：同步后lastSyncTime更新', async () => {
      const statusRes1 = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/sync/status',
        headers: { cookie: adminCookie },
      });
      const status1 = JSON.parse(statusRes1.payload);

      const syncService = app.get(PunchSyncService) as any;
      syncService.fetchFromDevice = (jest.fn() as any).mockResolvedValue({
        ret: 0,
        total: 1,
        rows: [
          { emp_code: 'E201', punch_time: '2026-08-13 09:00:00', device_sn: 'DEV001' },
        ],
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/sync',
        headers: { cookie: adminCookie },
      });

      const statusRes2 = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/sync/status',
        headers: { cookie: adminCookie },
      });
      const status2 = JSON.parse(statusRes2.payload);
      expect(new Date(status2.data.lastSyncTime).getTime())
        .toBeGreaterThan(new Date(status1.data.lastSyncTime).getTime());
    });

    it('无权限用户触发同步 → 403 + 5003', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/sync',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('设备离线/API异常 → 返回错误码 2006', async () => {
      const syncService = app.get(PunchSyncService) as any;
      syncService.fetchFromDevice = (jest.fn() as any).mockRejectedValue(new Error('device offline'));

      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/sync',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(502);
      expect(body.code).toBe(2006);
    });
  });

  describe('同步后流水验证', () => {
    it('同步后流水可查询，source=api', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch?page=1&pageSize=20',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const apiRecords = body.data.list.filter((item: any) => item.source === 'api');
      expect(apiRecords.length).toBeGreaterThan(0);
    });
  });
});
