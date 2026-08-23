// 调休转换 scope 校验 (TDD RED 先行)
// 漏洞6: vacation.service.ts convertOvertimeToCompensatory() 不校验 employeeId 是否在调用者 scope 内
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

describe('调休转换 scope 校验 (P1)', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;
  let staffEmpId: number;
  let otherEmpId: number;
  let staffOvertimeId: number;
  let otherOvertimeId: number;
  let vacationTypeId: number;

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
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
    const permView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });

    // ===== Roles =====
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: staffRole.id, permissionId: permManage.id },
        { roleId: staffRole.id, permissionId: permView.id },
      ],
    });

    // ===== Departments =====
    const deptA = await prisma.department.create({ data: { name: '调休A部' } });
    const deptB = await prisma.department.create({ data: { name: '调休B部' } });

    // ===== Users + Employees =====
    const staffUser = await prisma.user.create({
      data: { username: 'vc_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '调休员工' },
    });
    await prisma.userRole.create({ data: { userId: staffUser.id, roleId: staffRole.id } });

    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'VC-001', name: '调休员工', departmentId: deptA.id,
        userId: staffUser.id, salary: 8000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'VC-002', name: '其他员工', departmentId: deptB.id,
        salary: 9000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    staffEmpId = emp1.id;
    otherEmpId = emp2.id;

    // ===== Vacation Type (compensatory) =====
    const vt = await prisma.vacationType.create({
      data: { code: 'compensatory', name: '调休', baseDays: 0, sortOrder: 1 },
    });
    vacationTypeId = vt.id;

    // ===== Approved Overtime Records =====
    const ot1 = await prisma.overtimeRecord.create({
      data: {
        employeeId: emp1.id, overtimeDate: new Date('2026-08-01'),
        startTime: new Date('2026-08-01T18:00:00'), endTime: new Date('2026-08-01T22:00:00'),
        hours: 4, reason: 'staff overtime', status: 'approved',
      },
    });
    staffOvertimeId = ot1.id;

    const ot2 = await prisma.overtimeRecord.create({
      data: {
        employeeId: emp2.id, overtimeDate: new Date('2026-08-02'),
        startTime: new Date('2026-08-02T18:00:00'), endTime: new Date('2026-08-02T22:00:00'),
        hours: 4, reason: 'other overtime', status: 'approved',
      },
    });
    otherOvertimeId = ot2.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    staffCookie = await login(app, 'vc_staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('调休转换 scope 校验', () => {
    it('员工转换其他员工的加班为调休 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert',
        headers: { cookie: staffCookie },
        payload: {
          employeeId: otherEmpId,
          overtimeId: otherOvertimeId,
          vacationTypeId,
          hours: 4,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('员工转换自己的加班为调休 → 200', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert',
        headers: { cookie: staffCookie },
        payload: {
          employeeId: staffEmpId,
          overtimeId: staffOvertimeId,
          vacationTypeId,
          hours: 4,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });
});
