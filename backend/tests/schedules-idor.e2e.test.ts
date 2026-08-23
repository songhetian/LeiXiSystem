// 排班列表 IDOR 防护 (TDD RED 先行)
// 漏洞3: schedules.service.ts list() 中 query.employeeId 直接覆盖 scope.selfEmployeeId
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

describe('排班列表 IDOR 防护 (P0)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let staffEmpId: number;
  let otherEmpId: number;

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    // ===== Permissions =====
    const permManage = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });

    // ===== Roles =====
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: staffRole.id, permissionId: permManage.id },
      ],
    });

    // ===== Users =====
    const admin = await prisma.user.create({
      data: { username: 'sched_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'sched_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    // ===== Department + Employees =====
    const dept = await prisma.department.create({ data: { name: '排班测试部' } });
    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'SCH-001', name: '排班员工', departmentId: dept.id,
        userId: staff.id, salary: 8000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'SCH-002', name: '其他员工', departmentId: dept.id,
        salary: 9000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    staffEmpId = emp1.id;
    otherEmpId = emp2.id;

    // ===== Shift + Schedules =====
    const shift = await prisma.shift.create({
      data: { name: '早班-SCH', startTime: '09:00', endTime: '18:00', isNextDay: false },
    });
    await prisma.schedule.create({
      data: { employeeId: emp1.id, shiftId: shift.id, workDate: new Date('2026-08-15') },
    });
    await prisma.schedule.create({
      data: { employeeId: emp2.id, shiftId: shift.id, workDate: new Date('2026-08-15') },
    });

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'sched_admin');
    staffCookie = await login(app, 'sched_staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('排班列表 IDOR', () => {
    it('普通员工 GET /schedules?employeeId=<其他员工> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/schedules?employeeId=${otherEmpId}&startDate=2026-08-01&endDate=2026-08-31`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('普通员工 GET /schedules?employeeId=<自己> → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/schedules?employeeId=${staffEmpId}&startDate=2026-08-01&endDate=2026-08-31`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('普通员工 GET /schedules (不带 employeeId) → 200, 仅返回自己的排班', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/schedules?startDate=2026-08-01&endDate=2026-08-31',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const empIds = body.data.list.map((s: any) => s.employeeId);
      expect(empIds).toContain(staffEmpId);
      expect(empIds).not.toContain(otherEmpId);
    });

    it('管理员 GET /schedules?employeeId=<任意> → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/schedules?employeeId=${otherEmpId}&startDate=2026-08-01&endDate=2026-08-31`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });
});
