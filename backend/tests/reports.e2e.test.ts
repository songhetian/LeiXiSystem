// S15 · 报表中心 e2e（TDD RED 先行）
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

describe('S15 · 报表中心', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let managerCookie: string;
  let staffCookie: string;
  let dept1Id: number;
  let dept2Id: number;
  let emp1Id: number;
  let emp2Id: number;
  let emp3Id: number;

  beforeAll(async () => {
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permView = await prisma.permission.create({
      data: { code: 'reports:view', name: '报表查看', module: 'reports', type: 'menu' },
    });
    const permAttendanceView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });
    const permPayrollView = await prisma.permission.create({
      data: { code: 'payroll:view', name: '薪资查看', module: 'payroll', type: 'menu' },
    });

    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const managerRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: adminRole.id, permissionId: permAttendanceView.id },
        { roleId: adminRole.id, permissionId: permPayrollView.id },
        { roleId: managerRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permAttendanceView.id },
        { roleId: staffRole.id, permissionId: permAttendanceView.id },
      ],
    });

    const admin = await prisma.user.create({
      data: { username: 'admin_report', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager_report', passwordHash: await bcrypt.hash('123456', 10), realName: '张主管' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff_report', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工' },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    const dept1 = await prisma.department.create({ data: { name: '研发部' } });
    const dept2 = await prisma.department.create({ data: { name: '市场部' } });
    dept1Id = dept1.id;
    dept2Id = dept2.id;

    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'R001', name: '张三', departmentId: dept1.id,
        salary: 10000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'R002', name: '李四', departmentId: dept1.id,
        salary: 8000, hireDate: new Date('2024-03-01'), status: 'active',
      },
    });
    const emp3 = await prisma.employee.create({
      data: {
        employeeNo: 'M001', name: '王五', departmentId: dept2.id,
        salary: 9000, hireDate: new Date('2024-02-01'), status: 'active',
      },
    });
    emp1Id = emp1.id;
    emp2Id = emp2.id;
    emp3Id = emp3.id;

    await prisma.userDepartment.create({
      data: { userId: manager.id, departmentId: dept1.id },
    });

    await prisma.attendanceMonthly.createMany({
      data: [
        { employeeId: emp1.id, month: '2026-07', workDays: 22, lateCount: 1, absentDays: 0, overtimeHours: 8, status: 'confirmed' },
        { employeeId: emp2.id, month: '2026-07', workDays: 21, lateCount: 3, absentDays: 1, overtimeHours: 4, status: 'confirmed' },
        { employeeId: emp3.id, month: '2026-07', workDays: 22, lateCount: 0, absentDays: 0, overtimeHours: 2, status: 'confirmed' },
      ],
    });

    const payrollRun = await prisma.payrollRun.create({
      data: {
        month: '2026-07',
        status: 'published',
        totalEmployees: 3,
        totalAmount: 27000,
      },
    });

    await prisma.payrollDetail.createMany({
      data: [
        { runId: payrollRun.id, employeeId: emp1.id, itemCode: 'base_salary', itemName: '基本工资', amount: 10000 },
        { runId: payrollRun.id, employeeId: emp1.id, itemCode: 'overtime_pay', itemName: '加班费', amount: 800 },
        { runId: payrollRun.id, employeeId: emp1.id, itemCode: 'social_security', itemName: '社保', amount: -1000 },
        { runId: payrollRun.id, employeeId: emp2.id, itemCode: 'base_salary', itemName: '基本工资', amount: 8000 },
        { runId: payrollRun.id, employeeId: emp2.id, itemCode: 'overtime_pay', itemName: '加班费', amount: 400 },
        { runId: payrollRun.id, employeeId: emp2.id, itemCode: 'social_security', itemName: '社保', amount: -800 },
        { runId: payrollRun.id, employeeId: emp3.id, itemCode: 'base_salary', itemName: '基本工资', amount: 9000 },
        { runId: payrollRun.id, employeeId: emp3.id, itemCode: 'overtime_pay', itemName: '加班费', amount: 200 },
        { runId: payrollRun.id, employeeId: emp3.id, itemCode: 'social_security', itemName: '社保', amount: -900 },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin_report');
    managerCookie = await login(app, 'manager_report');
    staffCookie = await login(app, 'staff_report');
  });

  afterAll(async () => {
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await app.close();
  });

  describe('考勤月报报表', () => {
    it('管理员可以查看全部门考勤月报汇总', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly?month=2026-07',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.departments.length).toBeGreaterThanOrEqual(2);
      const total = body.data.summary;
      expect(Number(total.totalEmployees)).toBe(3);
      expect(Number(total.totalOvertimeHours)).toBe(14);
    });

    it('按部门维度汇总考勤数据', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly?month=2026-07',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      const dept = body.data.departments.find((d: any) => d.name === '研发部');
      expect(dept).toBeDefined();
      expect(Number(dept.employeeCount)).toBe(2);
      expect(Number(dept.totalOvertimeHours)).toBe(12);
      expect(Number(dept.totalLateCount)).toBe(4);
    });

    it('部门主管只能看到本部门数据', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly?month=2026-07',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.departments.length).toBe(1);
    });

    it('普通员工无报表权限', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly?month=2026-07',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('人力成本报表', () => {
    it('管理员可以查看人力成本按部门汇总', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/labor-cost?month=2026-07',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.departments.length).toBeGreaterThanOrEqual(2);
      expect(Number(body.data.summary.totalAmount)).toBeGreaterThan(0);
    });

    it('研发部人力成本正确汇总', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/labor-cost?month=2026-07',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.payload);
      const dept = body.data.departments.find((d: any) => d.name === '研发部');
      expect(dept).toBeDefined();
      expect(Number(dept.employeeCount)).toBe(2);
      expect(Number(dept.totalBaseSalary)).toBe(18000);
      expect(Number(dept.totalOvertimePay)).toBe(1200);
    });

    it('部门主管只能看到本部门人力成本', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/labor-cost?month=2026-07',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.departments.length).toBe(1);
    });
  });

  describe('报表导出（CSV）', () => {
    it('考勤月报导出 CSV，内容正确', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly/export?month=2026-07&format=csv',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      const lines = res.payload.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines[0]).toContain('部门');
      expect(lines[0]).toContain('员工数');
      expect(lines[0]).toContain('加班时长');
      const deptLine = lines.find((l: string) => l.includes('研发部'));
      expect(deptLine).toBeDefined();
      expect(deptLine).toContain('2');
    });

    it('人力成本导出 CSV，内容正确', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/labor-cost/export?month=2026-07&format=csv',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.payload.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines[0]).toContain('部门');
      expect(lines[0]).toContain('基本工资');
      expect(lines[0]).toContain('总金额');
      const deptLine = lines.find((l: string) => l.includes('研发部'));
      expect(deptLine).toBeDefined();
      expect(deptLine).toContain('18000');
    });

    it('部门主管导出只能看到本部门数据', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly/export?month=2026-07&format=csv',
        headers: { cookie: managerCookie },
      });
      expect(res.statusCode).toBe(200);
      const lines = res.payload.trim().split('\n');
      const deptLines = lines.filter((l: string) => !l.includes('部门') && l.trim().length > 0);
      expect(deptLines.length).toBe(1);
    });

    it('普通员工无导出权限', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-monthly/export?month=2026-07&format=csv',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
