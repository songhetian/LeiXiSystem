// S11 · 工资条自助 + 通知 e2e（TDD RED 先行）
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

describe('S11 · 工资条自助 + 通知', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let staffEmpId: number;
  let runId: number;

  beforeAll(async () => {
    await prisma.payslip.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.attendanceDaily.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();

    const permManage = await prisma.permission.create({
      data: { code: 'payroll:manage', name: '薪资管理', module: 'payroll', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'payroll:view', name: '薪资查看', module: 'payroll', type: 'menu' },
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

    const dept = await prisma.department.create({ data: { name: '工资条部' } });

    // 创建3名测试员工
    const empA = await prisma.employee.create({
      data: {
        employeeNo: 'PS-010',
        name: '工资条员工A',
        departmentId: dept.id,
        salary: 5000,
        hireDate: new Date('2025-01-01'),
      },
    });
    const empB = await prisma.employee.create({
      data: {
        employeeNo: 'PS-020',
        name: '工资条员工B',
        departmentId: dept.id,
        salary: 6000,
        hireDate: new Date('2025-01-01'),
      },
    });
    const empC = await prisma.employee.create({
      data: {
        employeeNo: 'PS-030',
        name: '工资条员工C',
        departmentId: dept.id,
        salary: 4000,
        hireDate: new Date('2025-01-15'),
      },
    });
    staffEmpId = empA.id;
    await prisma.employee.update({ where: { id: empA.id }, data: { userId: staff.id } });

    // 写入确认的考勤月报
    await prisma.attendanceMonthly.createMany({
      data: [
        {
          employeeId: empA.id,
          month: '2026-01',
          workDays: 22,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 0,
          leaveMinutes: 0,
          overtimeHours: 10,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
        {
          employeeId: empB.id,
          month: '2026-01',
          workDays: 20,
          lateCount: 3,
          earlyCount: 0,
          absentDays: 2,
          leaveMinutes: 0,
          overtimeHours: 0,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
        {
          employeeId: empC.id,
          month: '2026-01',
          workDays: 11,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 3,
          leaveMinutes: 240,
          overtimeHours: 0,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');

    // 创建算薪批次并发布（S10功能）
    const createRes = await inject(app, {
      method: 'POST',
      url: '/api/v1/payroll/runs',
      headers: { cookie: adminCookie },
      payload: { month: '2026-01' },
    });
    const createBody = JSON.parse(createRes.body);
    runId = createBody.data.id;

    await inject(app, {
      method: 'POST',
      url: `/api/v1/payroll/runs/${runId}/confirm`,
      headers: { cookie: adminCookie },
    });
    await inject(app, {
      method: 'POST',
      url: `/api/v1/payroll/runs/${runId}/publish`,
      headers: { cookie: adminCookie },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /payslips/me — 员工自助查看本人工资条', () => {
    it('员工应该能看到自己的工资条列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips/me',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('工资条详情应该包含薪资明细项', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips/me',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const payslipId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payslips/me/${payslipId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('POST /payslips/me/:id/view — 标记已查看', () => {
    it('员工查看后状态变为 viewed，记录 viewedAt', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips/me',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const payslipId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payslips/me/${payslipId}/view`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('viewed');
      expect(body.data.viewedAt).toBeDefined();
    });

    it('员工不能查看别人的工资条 → 404', async () => {
      // 获取所有工资条，找到一个不是员工A的
      const allRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips?runId=' + runId,
        headers: { cookie: adminCookie },
      });
      const allBody = JSON.parse(allRes.body);
      const otherPayslip = allBody.data.list.find((p: any) => p.employeeId !== staffEmpId);

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payslips/me/${otherPayslip.id}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(body.code).toBe(4004);
    });
  });

  describe('GET /payslips — HR 管理工资条（部门隔离）', () => {
    it('HR 可以查看工资条列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips?runId=' + runId,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBe(3);
    });
  });
});
