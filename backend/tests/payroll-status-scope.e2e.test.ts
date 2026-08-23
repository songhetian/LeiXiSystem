// 薪资状态转换 scope 校验 (TDD RED 先行)
// 漏洞7: payroll.service.ts confirmRun/publishRun/recallRun 不验证 run 是否在调用者 scope 内
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

describe('薪资状态转换 scope 校验 (P1)', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;
  let adminCookie: string;
  let runId: number;
  let empIds: number[] = [];

  beforeAll(async () => {
    // ===== Cleanup =====
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payslip.deleteMany();
    await prisma.payrollRun.deleteMany();
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
      data: { code: 'payroll:manage', name: '薪资管理', module: 'payroll', type: 'menu' },
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

    // ===== Departments =====
    const deptA = await prisma.department.create({ data: { name: '薪资A部' } });
    const deptB = await prisma.department.create({ data: { name: '薪资B部' } });

    // ===== Users + Employees =====
    const staffUser = await prisma.user.create({
      data: { username: 'ps_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '薪资员工' },
    });
    const adminUser = await prisma.user.create({
      data: { username: 'ps_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '薪资管理员' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: staffUser.id, roleId: staffRole.id },
        { userId: adminUser.id, roleId: adminRole.id },
      ],
    });

    // Staff employee (in deptA)
    await prisma.employee.create({
      data: {
        employeeNo: 'PS-001', name: '薪资员工', departmentId: deptA.id,
        userId: staffUser.id, salary: 8000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });

    // 3 other employees (in deptB, no user binding)
    for (let i = 2; i <= 4; i++) {
      const emp = await prisma.employee.create({
        data: {
          employeeNo: `PS-00${i}`, name: `其他员工${i}`, departmentId: deptB.id,
          salary: 9000 + i * 1000, hireDate: new Date('2024-01-01'), status: 'active',
        },
      });
      empIds.push(emp.id);
    }

    // ===== Payroll Run + Details =====
    const run = await prisma.payrollRun.create({
      data: { month: '2026-07', status: 'draft', totalEmployees: 3, totalAmount: 30000 },
    });
    runId = run.id;

    for (const empId of empIds) {
      await prisma.payrollDetail.create({
        data: { runId, employeeId: empId, itemCode: 'basic', itemName: '基本工资', amount: 10000 },
      });
    }

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    staffCookie = await login(app, 'ps_staff');
    adminCookie = await login(app, 'ps_admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('薪资状态转换 scope 校验', () => {
    it('员工 confirm 包含非本人员工的批次 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/confirm`,
        headers: { cookie: staffCookie },
        payload: { checkedEmployeeIds: empIds },
      });
      expect(res.statusCode).toBe(403);
    });

    it('员工 publish 包含非本人员工的批次 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/publish`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('员工 recall 包含非本人员工的批次 → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/recall`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('管理员 confirm 批次 → 200', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${runId}/confirm`,
        headers: { cookie: adminCookie },
        payload: { checkedEmployeeIds: empIds },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });
});
