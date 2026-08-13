// S08 · 考勤月报 + 结账锁定 e2e（TDD RED 先行）
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

describe('S08 · 考勤月报 + 结账锁定', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let empId: number;
  let shiftId: number;

  beforeAll(async () => {
    await prisma.attendanceMonthly.deleteMany();
    await prisma.attendanceDaily.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
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
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });
    const dept = await prisma.department.create({ data: { name: '客服部' } });
    const emp = await prisma.employee.create({
      data: { employeeNo: 'E101', name: '张三', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empId = emp.id;

    const shift = await prisma.shift.create({
      data: { name: '早班', startTime: '08:00', endTime: '17:00', isNextDay: false },
    });
    shiftId = shift.id;

    for (let i = 1; i <= 5; i++) {
      const date = new Date(`2026-08-${String(i).padStart(2, '0')}`);
      await prisma.schedule.create({
        data: { employeeId: empId, shiftId, workDate: date },
      });
      await prisma.punchLog.createMany({
        data: [
          { employeeNo: 'E101', deviceNo: 'DEV01', punchTime: new Date(`2026-08-${String(i).padStart(2, '0')} 08:00:00`), status: 'matched' },
          { employeeNo: 'E101', deviceNo: 'DEV01', punchTime: new Date(`2026-08-${String(i).padStart(2, '0')} 18:00:00`), status: 'matched' },
        ],
      });
    }

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('生成月报 → 从日报聚合正确', async () => {
    await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/daily/recalc',
      headers: { cookie: adminCookie },
      payload: { employeeId: empId, startDate: '2026-08-01', endDate: '2026-08-05' },
    });

    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/monthly/generate',
      headers: { cookie: adminCookie },
      payload: { employeeId: empId, month: '2026-08' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);

    const monthly = await prisma.attendanceMonthly.findUnique({
      where: { employeeId_month: { employeeId: empId, month: '2026-08' } },
    });
    expect(monthly).not.toBeNull();
    expect(monthly!.workDays.toNumber()).toBe(5);
    expect(monthly!.overtimeHours.toNumber()).toBe(5);
    expect(monthly!.status).toBe('draft');
  });

  it('月报列表查询 → 按月份筛选', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/monthly?month=2026-08',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('确认结账 → status=confirmed，记录确认人和时间', async () => {
    const monthly = await prisma.attendanceMonthly.findUnique({
      where: { employeeId_month: { employeeId: empId, month: '2026-08' } },
    });

    const res = await inject(app, {
      method: 'POST',
      url: `/api/v1/attendance/monthly/${monthly!.id}/confirm`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);

    const confirmed = await prisma.attendanceMonthly.findUnique({
      where: { employeeId_month: { employeeId: empId, month: '2026-08' } },
    });
    expect(confirmed!.status).toBe('confirmed');
    expect(confirmed!.confirmedBy).not.toBeNull();
    expect(confirmed!.confirmedAt).not.toBeNull();
  });

  it('已确认月报 → 重新生成被拒绝（409 + 2004）', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/monthly/generate',
      headers: { cookie: adminCookie },
      payload: { employeeId: empId, month: '2026-08' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(2004);
  });

  it('无权限访问 → 403 + 5003', async () => {
    const staffCookie = await login(app, 'staff');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/monthly?month=2026-08',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });
});
