// S15 · 报表中心增强（异步导出 + Excel）e2e（TDD RED 先行）
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

describe('S15 · 报表中心增强（异步导出 + Excel）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let dept1Id: number;
  let emp1Id: number;

  beforeAll(async () => {
    await prisma.exportTask.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permView = await prisma.permission.create({
      data: { code: 'reports:view', name: '报表查看', module: 'reports', type: 'menu' },
    });

    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_export', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_export', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const dept1 = await prisma.department.create({ data: { name: '研发部' } });
    dept1Id = dept1.id;

    const emp1 = await prisma.employee.create({
      data: {
        name: '张三',
        employeeNo: 'E001',
        departmentId: dept1.id,
        userId: admin.id,
        salary: 8000,
        hireDate: new Date('2024-01-01'),
      },
    });
    emp1Id = emp1.id;

    await prisma.attendanceMonthly.create({
      data: {
        employeeId: emp1.id,
        month: '2026-06',
        workDays: 22,
        lateCount: 1,
        earlyCount: 0,
        absentDays: 0,
        leaveMinutes: 0,
        overtimeHours: 10,
        status: 'confirmed',
        confirmedBy: admin.id,
        confirmedAt: new Date(),
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin_export');
    staffCookie = await login(app, 'staff_export');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('异步导出任务', () => {
    it('应该能创建考勤月报异步导出任务', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'attendance-monthly',
          month: '2026-06',
          format: 'xlsx',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.taskId).toBeDefined();
      expect(body.data.status).toBe('pending');
    });

    it('应该能查询导出任务状态', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'attendance-monthly',
          month: '2026-06',
          format: 'csv',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const taskId = createBody.data.taskId;

      const statusRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reports/export/${taskId}/status`,
        headers: { cookie: adminCookie },
      });
      const statusBody = JSON.parse(statusRes.payload);
      expect(statusRes.statusCode).toBe(200);
      expect(statusBody.code).toBe(0);
      expect(statusBody.data.taskId).toBe(taskId);
      expect(statusBody.data.status).toBeDefined();
      expect(['pending', 'processing', 'completed', 'failed']).toContain(statusBody.data.status);
    });

    it('任务完成后应该能下载文件', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'attendance-monthly',
          month: '2026-06',
          format: 'csv',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const taskId = createBody.data.taskId;

      await new Promise(r => setTimeout(r, 500));

      const statusRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reports/export/${taskId}/status`,
        headers: { cookie: adminCookie },
      });
      const statusBody = JSON.parse(statusRes.payload);

      if (statusBody.data.status === 'completed') {
        expect(statusBody.data.downloadUrl).toBeDefined();
        expect(statusBody.data.fileName).toBeDefined();
      }
    });

    it('普通员工不能创建导出任务 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: staffCookie },
        payload: {
          type: 'attendance-monthly',
          month: '2026-06',
          format: 'csv',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('缺失必要参数返回错误', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: { format: 'csv' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBeDefined();
    });

    it('不支持的导出类型返回错误', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'invalid-type',
          month: '2026-06',
          format: 'csv',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBeDefined();
    });
  });

  describe('导出任务列表', () => {
    it('应该能获取我的导出任务列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/export/tasks',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list).toBeDefined();
      expect(body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('任务列表按创建时间倒序', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/export/tasks',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      if (body.data.list.length >= 2) {
        const first = new Date(body.data.list[0].createdAt).getTime();
        const second = new Date(body.data.list[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('Excel 导出', () => {
    it('考勤月报支持 xlsx 格式导出', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'attendance-monthly',
          month: '2026-06',
          format: 'xlsx',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      expect(createRes.statusCode).toBe(200);
      expect(createBody.code).toBe(0);
      expect(createBody.data.taskId).toBeDefined();
    });

    it('人力成本支持 xlsx 格式导出', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/reports/export',
        headers: { cookie: adminCookie },
        payload: {
          type: 'labor-cost',
          month: '2026-06',
          format: 'xlsx',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      expect(createRes.statusCode).toBe(200);
      expect(createBody.code).toBe(0);
      expect(createBody.data.taskId).toBeDefined();
    });
  });
});
