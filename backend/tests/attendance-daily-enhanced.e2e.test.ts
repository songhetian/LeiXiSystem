// S07 · 考勤日报增强 e2e（请假/补卡合并 + 定时重算任务）（TDD RED 先行）
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

describe('S07 · 考勤日报增强（请假合并 + 定时重算任务）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let empId: number;
  let shiftId: number;
  let vacationTypeId: number;

  beforeAll(async () => {
    await prisma.attendanceDaily.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.vacationType.deleteMany();
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
      data: { username: 'admin_daily2', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_daily2', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    const emp = await prisma.employee.create({
      data: { employeeNo: 'E301', name: '赵六', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empId = emp.id;

    const shift = await prisma.shift.create({
      data: { name: '白班', startTime: '09:00', endTime: '18:00', isNextDay: false },
    });
    shiftId = shift.id;

    const vacType = await prisma.vacationType.create({
      data: { name: '事假', code: 'personal', baseDays: 0 },
    });
    vacationTypeId = vacType.id;

    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-10') },
    });
    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-11') },
    });
    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-12') },
    });

    await prisma.punchLog.createMany({
      data: [
        { employeeNo: 'E301', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 09:00:00'), status: 'matched' },
        { employeeNo: 'E301', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 18:00:00'), status: 'matched' },
        { employeeNo: 'E301', deviceNo: 'DEV01', punchTime: new Date('2026-08-12 09:30:00'), status: 'matched' },
        { employeeNo: 'E301', deviceNo: 'DEV01', punchTime: new Date('2026-08-12 17:30:00'), status: 'matched' },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin_daily2');
    staffCookie = await login(app, 'staff_daily2');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('请假状态合并到日报', () => {
    beforeAll(async () => {
      await prisma.leaveRecord.create({
        data: {
          employeeId: empId,
          vacationTypeId,
          startDate: new Date('2026-08-11'),
          endDate: new Date('2026-08-11'),
          days: 1,
          reason: '家中有事',
          status: 'approved',
        },
      });
    });

    it('重算后：全天请假 → 日报 status=leave', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-12' },
      });

      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily?startDate=2026-08-11&endDate=2026-08-11&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const daily = body.data.list.find((d: any) => d.employee.employeeNo === 'E301');
      expect(daily).toBeDefined();
      expect(daily.status).toBe('leave');
      expect(daily.leaveDays).toBe('1');
    });

    it('非请假日保持原打卡状态', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily?startDate=2026-08-10&endDate=2026-08-10&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      const daily = body.data.list.find((d: any) => d.employee.employeeNo === 'E301');
      expect(daily.status).toBe('normal');
    });

    it('pending状态请假 → 不影响日报状态', async () => {
      await prisma.leaveRecord.create({
        data: {
          employeeId: empId,
          vacationTypeId,
          startDate: new Date('2026-08-12'),
          endDate: new Date('2026-08-12'),
          days: 1,
          reason: '待审批',
          status: 'pending',
        },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-12', endDate: '2026-08-12' },
      });

      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily?startDate=2026-08-12&endDate=2026-08-12&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      const daily = body.data.list.find((d: any) => d.employee.employeeNo === 'E301');
      expect(daily.status).not.toBe('leave');
    });
  });

  describe('重算任务接口', () => {
    it('POST /attendance/daily/recalc → 返回处理条数', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-12' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.count).toBeGreaterThan(0);
    });

    it('重算幂等：两次重算结果一致', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-10' },
      });

      const res1 = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily?startDate=2026-08-10&endDate=2026-08-10&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const data1 = JSON.parse(res1.payload);

      await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: adminCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-10' },
      });

      const res2 = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/daily?startDate=2026-08-10&endDate=2026-08-10&page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const data2 = JSON.parse(res2.payload);

      expect(data1.data.list.length).toBe(data2.data.list.length);
      expect(data1.data.list[0].status).toBe(data2.data.list[0].status);
    });

    it('无权限用户触发重算 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/daily/recalc',
        headers: { cookie: staffCookie },
        payload: { startDate: '2026-08-10', endDate: '2026-08-12' },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
