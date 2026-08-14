// S10 · 算薪引擎 + 批次 e2e（TDD RED 先行）
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

describe('S10 · 算薪引擎 + 批次', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;

  beforeAll(async () => {
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
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

    const dept = await prisma.department.create({ data: { name: '算薪部' } });

    // 创建3名测试员工（对应原型3人对账样例）
    // 员工A：满勤 + 平日加班10h → 基本工资 5000
    // 员工B：缺勤2天 + 迟到3次 + 休息日加班8h → 基本工资 6000
    // 员工C：月中入职（出勤11天）+ 请假3天 → 基本工资 4000
    const empA = await prisma.employee.create({
      data: {
        employeeNo: 'PY-010',
        name: '算薪员工A',
        departmentId: dept.id,
        salary: 5000,
        hireDate: new Date('2025-01-01'),
      },
    });
    const empB = await prisma.employee.create({
      data: {
        employeeNo: 'PY-020',
        name: '算薪员工B',
        departmentId: dept.id,
        salary: 6000,
        hireDate: new Date('2025-01-01'),
      },
    });
    const empC = await prisma.employee.create({
      data: {
        employeeNo: 'PY-030',
        name: '算薪员工C',
        departmentId: dept.id,
        salary: 4000,
        hireDate: new Date('2025-01-15'),
      },
    });

    // 写入确认的考勤月报（S08已确认）
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /payroll/runs — 创建算薪批次', () => {
    it('应该成功创建算薪批次并生成3名员工的薪资明细', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-01' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
    });

    it('重复创建同一月份应该返回 3001 错误', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-01' },
      });
      const body = JSON.parse(res.body);
      expect(body.code).toBe(3001);
    });
  });

  describe('GET /payroll/runs — 算薪批次列表', () => {
    it('应该返回算薪批次列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /payroll/runs/:id/details — 算薪明细', () => {
    it('应该返回员工薪资明细（含薪资项汇总）', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const runId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payroll/runs/${runId}/details`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.employees.length).toBe(3);
    });
  });

  describe('POST /payroll/runs/:id/confirm — 确认算薪', () => {
    it('应该成功确认，状态变为 confirmed', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const runId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/confirm`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('confirmed');
    });

    it('重复确认应该返回 3003 错误', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const runId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/confirm`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(body.code).toBe(3003);
    });
  });

  describe('POST /payroll/runs/:id/publish — 发布算薪（员工端可见）', () => {
    it('应该成功发布，状态变为 published', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=10',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const runId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/publish`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('published');
    });
  });
});
