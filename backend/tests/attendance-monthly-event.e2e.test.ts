// S08 · 考勤月报确认领域事件 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

describe('S08 · 考勤月报确认领域事件', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let eventEmitter: EventEmitter2;
  let empId: number;
  let shiftId: number;

  beforeAll(async () => {
    await prisma.attendanceMonthly.deleteMany();
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
      data: { username: 'admin_event', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    const emp = await prisma.employee.create({
      data: { employeeNo: 'E501', name: '周八', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empId = emp.id;

    const shift = await prisma.shift.create({
      data: { name: '白班', startTime: '09:00', endTime: '18:00', isNextDay: false },
    });
    shiftId = shift.id;

    const dates = ['01', '02', '03', '04', '05'];
    for (const d of dates) {
      await prisma.schedule.create({
        data: { employeeId: empId, shiftId, workDate: new Date(`2026-07-${d}`) },
      });
      await prisma.punchLog.createMany({
        data: [
          { employeeNo: 'E501', deviceNo: 'DEV01', punchTime: new Date(`2026-07-${d} 09:00:00`), status: 'matched' },
          { employeeNo: 'E501', deviceNo: 'DEV01', punchTime: new Date(`2026-07-${d} 18:00:00`), status: 'matched' },
        ],
      });
    }

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin_event');
    eventEmitter = app.get(EventEmitter2);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('月报确认触发领域事件', () => {
    it('confirm 月报时发布 attendance.monthly.confirmed 事件', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-07-01', endDate: '2026-07-05' },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/monthly/generate',
        headers: { cookie: adminCookie },
        payload: { month: '2026-07' },
      });

      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/monthly?month=2026-07&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const monthlyList = JSON.parse(listRes.payload).data.list;
      const monthlyId = monthlyList[0].id;

      let eventReceived: any = null;
      const handler = (payload: any) => {
        eventReceived = payload;
      };
      eventEmitter.on('attendance.monthly.confirmed', handler);

      await inject(app, {
        method: 'POST',
        url: `/api/v1/attendance/monthly/${monthlyId}/confirm`,
        headers: { cookie: adminCookie },
      });

      expect(eventReceived).not.toBeNull();
      expect(eventReceived.monthlyId).toBe(monthlyId);
      expect(eventReceived.month).toBe('2026-07');
      expect(eventReceived.confirmedBy).toBeDefined();
      expect(eventReceived.confirmedAt).toBeDefined();

      eventEmitter.off('attendance.monthly.confirmed', handler);
    });

    it('事件包含员工汇总数据', async () => {
      const juneDates = ['01', '02', '03'];
      for (const d of juneDates) {
        await prisma.schedule.create({
          data: { employeeId: empId, shiftId, workDate: new Date(`2026-06-${d}`) },
        });
        await prisma.punchLog.createMany({
          data: [
            { employeeNo: 'E501', deviceNo: 'DEV01', punchTime: new Date(`2026-06-${d} 09:00:00`), status: 'matched' },
            { employeeNo: 'E501', deviceNo: 'DEV01', punchTime: new Date(`2026-06-${d} 18:00:00`), status: 'matched' },
          ],
        });
      }

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-06-01', endDate: '2026-06-03' },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/monthly/generate',
        headers: { cookie: adminCookie },
        payload: { month: '2026-06' },
      });

      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/monthly?month=2026-06&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const monthlyList = JSON.parse(listRes.payload).data.list;
      const monthlyId = monthlyList[0].id;

      let eventReceived: any = null;
      const handler = (payload: any) => {
        eventReceived = payload;
      };
      eventEmitter.on('attendance.monthly.confirmed', handler);

      await inject(app, {
        method: 'POST',
        url: `/api/v1/attendance/monthly/${monthlyId}/confirm`,
        headers: { cookie: adminCookie },
      });

      expect(eventReceived.employeeCount).toBeGreaterThan(0);
      expect(eventReceived.totalWorkDays).toBeDefined();

      eventEmitter.off('attendance.monthly.confirmed', handler);
    });

    it('重复 confirm 不发布事件（已确认状态）', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/monthly?month=2026-07&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const monthlyList = JSON.parse(listRes.payload).data.list;
      const monthlyId = monthlyList[0].id;

      let eventCount = 0;
      const handler = () => {
        eventCount++;
      };
      eventEmitter.on('attendance.monthly.confirmed', handler);

      await inject(app, {
        method: 'POST',
        url: `/api/v1/attendance/monthly/${monthlyId}/confirm`,
        headers: { cookie: adminCookie },
      });

      expect(eventCount).toBe(0);
      eventEmitter.off('attendance.monthly.confirmed', handler);
    });
  });
});
