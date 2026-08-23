// S07 · 考勤日报定时重算任务 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { AttendanceDailyRecalcService } from '../src/attendance/attendance-daily-recalc.service';

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

describe('S07 · 考勤日报定时重算任务', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let empId: number;
  let shiftId: number;

  beforeAll(async () => {
    await prisma.attendanceDaily.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
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
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_cron', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });

    const dept = await prisma.department.create({ data: { name: '测试部' } });
    const emp = await prisma.employee.create({
      data: { employeeNo: 'E401', name: '孙七', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empId = emp.id;

    const shift = await prisma.shift.create({
      data: { name: '常白班', startTime: '09:00', endTime: '18:00', isNextDay: false },
    });
    shiftId = shift.id;

    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-10') },
    });
    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-11') },
    });

    await prisma.punchLog.createMany({
      data: [
        { employeeNo: 'E401', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 09:00:00'), status: 'matched' },
        { employeeNo: 'E401', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 18:00:00'), status: 'matched' },
        { employeeNo: 'E401', deviceNo: 'DEV01', punchTime: new Date('2026-08-11 09:15:00'), status: 'matched' },
        { employeeNo: 'E401', deviceNo: 'DEV01', punchTime: new Date('2026-08-11 17:45:00'), status: 'matched' },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin_cron');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('重算任务记录', () => {
    it('GET /attendance/daily/recalc/tasks → 重算任务列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list).toBeDefined();
      expect(typeof body.data.total).toBe('number');
    });

    it('POST /attendance/daily/recalc → 创建重算任务记录', async () => {
      const beforeRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const beforeCount = JSON.parse(beforeRes.payload).data.total;

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-11' },
      });

      const afterRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const afterBody = JSON.parse(afterRes.payload);
      expect(afterBody.data.total).toBe(beforeCount + 1);
      const latest = afterBody.data.list[0];
      expect(latest.status).toBe('success');
      expect(latest.recordCount).toBe(2);
      expect(latest.startDate).toBeDefined();
      expect(latest.endDate).toBeDefined();
    });

    it('重算失败也记录任务（status=failed）', async () => {
      const service = app.get(AttendanceDailyRecalcService);
      const beforeRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const beforeCount = JSON.parse(beforeRes.payload).data.total;

      const task = await service.createTask({
        startDate: '2099-01-01',
        endDate: '2099-01-02',
        triggerType: 'manual',
      });
      await service.completeTask(task.id, false, 0, 100, '模拟失败');

      const afterRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?status=failed&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const afterBody = JSON.parse(afterRes.payload);
      expect(afterBody.data.total).toBeGreaterThanOrEqual(1);
      const failed = afterBody.data.list.find((t: any) => t.id === task.id);
      expect(failed).toBeDefined();
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('模拟失败');
    });

    it('GET /attendance/daily/recalc/tasks 无权限 → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: 'invalid_cookie' },
      });
      expect([401, 403]).toContain(res.statusCode);
    });
  });

  describe('定时任务调度', () => {
    it('DailyRecalcService 可被注入并执行重算', async () => {
      const service = app.get(AttendanceDailyRecalcService);
      expect(service).toBeDefined();
      expect(typeof service.runDailyRecalc).toBe('function');

      const result = await service.runDailyRecalc();
      expect(result.success).toBe(true);
      expect(result.recordCount).toBeGreaterThanOrEqual(0);
    });

    it('runDailyRecalc 也记录任务到历史', async () => {
      const service = app.get(AttendanceDailyRecalcService);
      const beforeRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const beforeCount = JSON.parse(beforeRes.payload).data.total;

      await service.runDailyRecalc();

      const afterRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily/recalc/tasks?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const afterCount = JSON.parse(afterRes.payload).data.total;
      expect(afterCount).toBe(beforeCount + 1);
    });
  });
});
