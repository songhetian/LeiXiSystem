// S07 · 考勤日报 e2e（TDD RED 先行）
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

describe('S07 · 考勤日报（重算 + 查询）', () => {
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
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
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

    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-10') },
    });

    await prisma.punchLog.createMany({
      data: [
        { employeeNo: 'E101', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 08:05:00'), status: 'matched' },
        { employeeNo: 'E101', deviceNo: 'DEV01', punchTime: new Date('2026-08-10 18:30:00'), status: 'matched' },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('重算日报 → 生成正常日报（迟到5min + 加班90min）', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/daily/recalc',
      headers: { cookie: adminCookie },
      payload: {
        employeeId: empId,
        startDate: '2026-08-10',
        endDate: '2026-08-10',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.count).toBe(1);

    const daily = await prisma.attendanceDaily.findUnique({
      where: { employeeId_workDate: { employeeId: empId, workDate: new Date('2026-08-10') } },
    });
    expect(daily).not.toBeNull();
    expect(daily!.lateMinutes).toBe(5);
    expect(daily!.overtimeMinutes).toBe(90);
    expect(daily!.status).toBe('late');
    expect(daily!.punchCount).toBe(2);
    expect(daily!.shiftId).toBe(shiftId);
  });

  it('重算无排班日期 → 不生成日报（count=0）', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/daily/recalc',
      headers: { cookie: adminCookie },
      payload: {
        employeeId: empId,
        startDate: '2026-12-25',
        endDate: '2026-12-25',
      },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.count).toBe(0);
  });

  it('日报列表查询 → 按日期范围筛选', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/daily?startDate=2026-08-01&endDate=2026-08-31',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    const first = body.data.list[0];
    expect(first.employee).toBeDefined();
    expect(first.shift).toBeDefined();
  });

  it('日报列表 → 按员工筛选', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/attendance/daily?employeeId=${empId}&startDate=2026-08-01&endDate=2026-08-31`,
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(1);
  });

  it('日报列表 → 按状态筛选（late）', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/daily?status=late&startDate=2026-08-01&endDate=2026-08-31',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('无打卡 + 有排班 → status=absent', async () => {
    await prisma.schedule.create({
      data: { employeeId: empId, shiftId, workDate: new Date('2026-08-11') },
    });

    await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/daily/recalc',
      headers: { cookie: adminCookie },
      payload: {
        employeeId: empId,
        startDate: '2026-08-11',
        endDate: '2026-08-11',
      },
    });

    const daily = await prisma.attendanceDaily.findUnique({
      where: { employeeId_workDate: { employeeId: empId, workDate: new Date('2026-08-11') } },
    });
    expect(daily!.status).toBe('absent');
    expect(daily!.punchCount).toBe(0);
    expect(daily!.firstPunch).toBeNull();
  });

  it('无权限访问 → 403 + 5003', async () => {
    const staffCookie = await login(app, 'staff');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/daily?startDate=2026-08-01&endDate=2026-08-31',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });
});
