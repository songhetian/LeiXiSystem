// S10 · 算薪增强（薪资项目/调整项/撤回） e2e（TDD RED 先行）
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

describe('S10 · 算薪增强（薪资项目/调整项/撤回）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let employeeId: number;

  beforeAll(async () => {
    await prisma.payslip.deleteMany();
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.salaryItem.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
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
        { roleId: staffRole.id, permissionId: permView.id },
      ],
    });

    const admin = await prisma.user.create({
      data: { username: 'admin_pay', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_pay', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '财务部' } });

    const emp = await prisma.employee.create({
      data: {
        employeeNo: 'PAY-001',
        name: '张三',
        departmentId: dept.id,
        userId: staff.id,
        salary: 5000,
        hireDate: new Date('2025-01-01'),
        status: 'active',
      },
    });
    employeeId = emp.id;

    await prisma.attendanceMonthly.createMany({
      data: [
        {
          employeeId: emp.id,
          month: '2026-02',
          workDays: 22,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
        {
          employeeId: emp.id,
          month: '2026-03',
          workDays: 22,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
        {
          employeeId: emp.id,
          month: '2026-04',
          workDays: 22,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          status: 'confirmed',
          confirmedBy: admin.id,
          confirmedAt: new Date(),
        },
        {
          employeeId: emp.id,
          month: '2026-05',
          workDays: 22,
          lateCount: 0,
          earlyCount: 0,
          absentDays: 0,
          leaveMinutes: 0,
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

    adminCookie = await login(app, 'admin_pay');
    staffCookie = await login(app, 'staff_pay');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('薪资项目配置', () => {
    it('应该能获取薪资项目列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('应该能创建薪资项目（基本工资）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
        payload: {
          code: 'base_salary',
          name: '基本工资',
          type: 'earning',
          amount: 5000,
          sortOrder: 1,
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.code).toBe('base_salary');
      expect(body.data.name).toBe('基本工资');
      expect(body.data.type).toBe('earning');
    });

    it('应该能创建薪资项目（社保扣除）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
        payload: {
          code: 'social_security',
          name: '社保',
          type: 'deduction',
          amount: 500,
          sortOrder: 10,
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.type).toBe('deduction');
    });

    it('重复编码应该报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
        payload: {
          code: 'base_salary',
          name: '基本工资2',
          type: 'earning',
          amount: 6000,
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(409);
      expect(body.code).toBeDefined();
    });

    it('应该能更新薪资项目', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const item = listBody.data.find((i: any) => i.code === 'base_salary');

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/payroll/items/${item.id}`,
        headers: { cookie: adminCookie },
        payload: {
          name: '基本工资(更新)',
          amount: 5500,
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('基本工资(更新)');
      expect(Number(body.data.amount)).toBe(5500);
    });

    it('应该能禁用薪资项目', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/items',
        headers: { cookie: adminCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const item = listBody.data.find((i: any) => i.code === 'social_security');

      const res = await inject(app, {
        method: 'PATCH',
        url: `/api/v1/payroll/items/${item.id}`,
        headers: { cookie: adminCookie },
        payload: { enabled: false },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.enabled).toBe(false);
    });
  });

  describe('调整项', () => {
    let runId: number;

    beforeAll(async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-02' },
      });
      const createBody = JSON.parse(createRes.body);
      runId = createBody.data.id;
    });

    it('应该能给员工添加调整项（奖金）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/adjust`,
        headers: { cookie: adminCookie },
        payload: {
          employeeId,
          itemCode: 'bonus',
          itemName: '绩效奖金',
          amount: 1000,
          reason: '1月绩效优秀',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
      expect(Number(body.data.amount)).toBe(1000);
    });

    it('明细中应该包含调整项金额', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payroll/runs/${runId}/details`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      const emp = body.data.employees.find((e: any) => e.employee.id === employeeId);
      expect(emp).toBeDefined();
      expect(emp.adjustments).toBeDefined();
      expect(emp.adjustments.length).toBeGreaterThanOrEqual(1);
    });

    it('确认后的批次不能添加调整项', async () => {
      await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/confirm`,
        headers: { cookie: adminCookie },
      });

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/adjust`,
        headers: { cookie: adminCookie },
        payload: {
          employeeId,
          itemCode: 'bonus2',
          itemName: '额外奖金',
          amount: 500,
          reason: '测试',
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(422);
      expect(body.code).toBeDefined();
    });
  });

  describe('撤回功能', () => {
    let runId: number;

    beforeAll(async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-03' },
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

    it('已发布的批次可以撤回（无已查看工资条）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/recall`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('recalled');
    });

    it('已查看的工资条不可撤回', async () => {
      const run2Res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-04' },
      });
      const run2Body = JSON.parse(run2Res.body);
      const run2Id = run2Body.data.id;

      await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${run2Id}/confirm`,
        headers: { cookie: adminCookie },
      });
      await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${run2Id}/publish`,
        headers: { cookie: adminCookie },
      });

      const payslipListRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips/me',
        headers: { cookie: staffCookie },
      });
      const payslipListBody = JSON.parse(payslipListRes.body);
      const payslipId = payslipListBody.data.list[0].id;

      await inject(app, {
        method: 'POST',
        url: `/api/v1/payslips/me/${payslipId}/view`,
        headers: { cookie: staffCookie },
      });

      const recallRes = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${run2Id}/recall`,
        headers: { cookie: adminCookie },
      });
      const recallBody = JSON.parse(recallRes.body);
      expect(recallRes.statusCode).toBe(422);
      expect(recallBody.code).toBeDefined();
    });

    it('draft 状态不能撤回', async () => {
      const run3Res = await inject(app, {
        method: 'POST',
        url: '/api/v1/payroll/runs',
        headers: { cookie: adminCookie },
        payload: { month: '2026-05' },
      });
      const run3Body = JSON.parse(run3Res.body);
      const run3Id = run3Body.data.id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${run3Id}/recall`,
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(409);
      expect(body.code).toBeDefined();
    });
  });
});
