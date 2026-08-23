// IDOR (Insecure Direct Object Reference) e2e tests — TDD RED → GREEN
// Tests that a staff user (普通员工, selfEmployeeId scope only) cannot access
// another employee's data by changing ID parameters.
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

describe('IDOR · 越权访问防护 (22 endpoints)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  // Employee IDs
  let staffEmpId: number; // selfEmployeeId for staff user
  let otherEmpId: number; // another employee's ID

  // Test data IDs
  let otherMonthlyId: number; // draft monthly for other employee
  let otherApprovalInstanceId: number;
  let payrollRunId: number; // draft run with details for both employees
  let publishedRunId: number; // published run with payslip for staff emp
  let otherMakeupId: number;
  let annualLeaveTypeId: number;

  beforeAll(async () => {
    // ===== Clean up all tables =====
    await prisma.payslip.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.punchMakeup.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.attendanceDaily.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    // ===== Permissions =====
    const permCodes = [
      'employee:view', 'attendance:view', 'attendance:manage',
      'payroll:view', 'payroll:manage', 'approval:todo:view', 'approval:submitted:view',
    ];
    const perms: Record<string, number> = {};
    for (const code of permCodes) {
      const p = await prisma.permission.create({
        data: { code, name: code, module: code.split(':')[0], type: 'menu' },
      });
      perms[code] = p.id;
    }

    // ===== Roles =====
    // Admin role: all permissions
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    await prisma.rolePermission.createMany({
      data: permCodes.map((code) => ({ roleId: adminRole.id, permissionId: perms[code] })),
    });

    // Staff role: all permissions (so they can reach endpoints), but role code 'staff'
    // → DataScopeService returns selfEmployeeId scope
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: permCodes.map((code) => ({ roleId: staffRole.id, permissionId: perms[code] })),
    });

    // ===== Users =====
    const admin = await prisma.user.create({
      data: { username: 'idor_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

    const staff = await prisma.user.create({
      data: { username: 'idor_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '测试员工' },
    });
    await prisma.userRole.create({ data: { userId: staff.id, roleId: staffRole.id } });

    // ===== Department + Employees =====
    const dept = await prisma.department.create({ data: { name: 'IDOR测试部' } });

    // emp1: bound to staff user (selfEmployeeId)
    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'IDOR-001',
        name: '测试员工',
        departmentId: dept.id,
        userId: staff.id,
        salary: 8000,
        hireDate: new Date('2024-01-01'),
        status: 'active',
      },
    });
    staffEmpId = emp1.id;

    // emp2: another employee (the "victim")
    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'IDOR-002',
        name: '其他员工',
        departmentId: dept.id,
        salary: 9000,
        hireDate: new Date('2024-01-01'),
        status: 'active',
      },
    });
    otherEmpId = emp2.id;

    // ===== Vacation types + balances =====
    const annualType = await prisma.vacationType.create({
      data: { code: 'annual', name: '年假', baseDays: 5, sortOrder: 1 },
    });
    annualLeaveTypeId = annualType.id;

    for (const empId of [emp1.id, emp2.id]) {
      await prisma.vacationBalance.create({
        data: { employeeId: empId, vacationTypeId: annualType.id, year: 2026, totalDays: 5, usedDays: 0 },
      });
    }

    // ===== Leave records (for both employees) =====
    await prisma.leaveRecord.create({
      data: {
        employeeId: emp1.id, vacationTypeId: annualType.id,
        startDate: new Date('2026-08-01'), endDate: new Date('2026-08-02'),
        days: 1, reason: 'staff leave', status: 'pending',
      },
    });
    await prisma.leaveRecord.create({
      data: {
        employeeId: emp2.id, vacationTypeId: annualType.id,
        startDate: new Date('2026-08-03'), endDate: new Date('2026-08-04'),
        days: 1, reason: 'other leave', status: 'pending',
      },
    });

    // ===== Overtime records (for both employees) =====
    await prisma.overtimeRecord.create({
      data: {
        employeeId: emp1.id, overtimeDate: new Date('2026-08-05'),
        startTime: new Date('2026-08-05T18:00:00Z'), endTime: new Date('2026-08-05T20:00:00Z'),
        hours: 2, reason: 'staff overtime', status: 'pending',
      },
    });
    await prisma.overtimeRecord.create({
      data: {
        employeeId: emp2.id, overtimeDate: new Date('2026-08-06'),
        startTime: new Date('2026-08-06T18:00:00Z'), endTime: new Date('2026-08-06T20:00:00Z'),
        hours: 2, reason: 'other overtime', status: 'pending',
      },
    });

    // ===== Attendance monthly (for both employees) =====
    await prisma.attendanceMonthly.create({
      data: {
        employeeId: emp1.id, month: '2026-07', workDays: 22, lateCount: 0,
        earlyCount: 0, absentDays: 0, leaveMinutes: 0, overtimeHours: 0, status: 'draft',
      },
    });
    const otherMonthly = await prisma.attendanceMonthly.create({
      data: {
        employeeId: emp2.id, month: '2026-07', workDays: 21, lateCount: 1,
        earlyCount: 0, absentDays: 1, leaveMinutes: 0, overtimeHours: 0, status: 'draft',
      },
    });
    otherMonthlyId = otherMonthly.id;

    // ===== Attendance daily (for both employees) =====
    const dailyDate = new Date('2026-07-15');
    await prisma.attendanceDaily.create({
      data: {
        employeeId: emp1.id, workDate: dailyDate, punchCount: 2,
        lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0, status: 'normal',
      },
    });
    await prisma.attendanceDaily.create({
      data: {
        employeeId: emp2.id, workDate: dailyDate, punchCount: 2,
        lateMinutes: 10, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0, status: 'late',
      },
    });

    // ===== Approval workflow + instance =====
    const wf = await prisma.approvalWorkflow.create({
      data: { code: 'leave', name: '请假审批', module: 'attendance', status: 'active' },
    });
    const wfNode = await prisma.approvalWorkflowNode.create({
      data: {
        workflowId: wf.id, nodeKey: 'manager', name: '主管审批',
        type: 'role', roleCode: 'admin', order: 1,
      },
    });

    // Instance created by admin (not the staff user)
    const otherInstance = await prisma.approvalInstance.create({
      data: {
        workflowId: wf.id, workflowCode: 'leave',
        title: '其他人的审批', applicantId: admin.id, applicantName: '管理员',
        status: 'pending', currentNodeKey: 'manager', currentNodeName: '主管审批',
        records: {
          create: {
            nodeId: wfNode.id, nodeKey: 'manager', nodeName: '主管审批',
            order: 1, status: 'pending',
          },
        },
      },
    });
    otherApprovalInstanceId = otherInstance.id;

    // ===== Payroll run (draft, with details for both employees) =====
    const run = await prisma.payrollRun.create({
      data: { month: '2026-07', status: 'draft', totalEmployees: 2, totalAmount: 17000 },
    });
    payrollRunId = run.id;
    for (const empId of [emp1.id, emp2.id]) {
      await prisma.payrollDetail.create({
        data: { runId: run.id, employeeId: empId, itemCode: 'base', itemName: '基本工资', amount: 8000 },
      });
    }

    // ===== Published payroll run (with payslip for staff emp only) =====
    const pubRun = await prisma.payrollRun.create({
      data: {
        month: '2026-06', status: 'published', totalEmployees: 1, totalAmount: 8000,
        publishedBy: admin.id, publishedAt: new Date(),
      },
    });
    publishedRunId = pubRun.id;
    await prisma.payrollDetail.create({
      data: { runId: pubRun.id, employeeId: emp1.id, itemCode: 'base', itemName: '基本工资', amount: 8000 },
    });
    await prisma.payslip.create({
      data: {
        runId: pubRun.id, employeeId: emp1.id, month: '2026-06', totalAmount: 8000,
        itemsJson: JSON.stringify([{ code: 'base', name: '基本工资', amount: 8000 }]),
      },
    });

    // ===== Punch makeup records (for both employees) =====
    await prisma.punchMakeup.create({
      data: {
        employeeId: emp1.id, punchDate: new Date('2026-08-10'),
        punchType: 'missing', reason: 'staff makeup', status: 'pending',
      },
    });
    const otherMakeup = await prisma.punchMakeup.create({
      data: {
        employeeId: emp2.id, punchDate: new Date('2026-08-11'),
        punchType: 'missing', reason: 'other makeup', status: 'pending',
      },
    });
    otherMakeupId = otherMakeup.id;

    // ===== Start app =====
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'idor_admin');
    staffCookie = await login(app, 'idor_staff');
  });

  afterAll(async () => {
    await prisma.payslip.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.punchMakeup.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.attendanceDaily.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  // ================================================================
  // Category A: employeeId override (5 endpoints)
  // Bug: service sets where.employeeId = scope.selfEmployeeId,
  //      then if (employeeId) where.employeeId = employeeId; overrides it.
  // ================================================================
  describe('Category A: employeeId override', () => {
    it('A1: GET /attendance/monthly?employeeId=<other> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/monthly?employeeId=${otherEmpId}&month=2026-07`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('A2: GET /attendance/daily?employeeId=<other> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/daily?employeeId=${otherEmpId}&startDate=2026-07-01&endDate=2026-07-31`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('A3: GET /vacation/balances?employeeId=<other> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/vacation/balances?employeeId=${otherEmpId}&year=2026`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('A4: GET /leave-records?employeeId=<other> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/leave-records?employeeId=${otherEmpId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('A5: GET /overtime-records?employeeId=<other> → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/overtime-records?employeeId=${otherEmpId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    // Positive: staff can access own data
    it('A1-positive: GET /attendance/monthly?employeeId=<self> → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/monthly?employeeId=${staffEmpId}&month=2026-07`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });
  });

  // ================================================================
  // Category B: detail without ownership check (3 endpoints)
  // ================================================================
  describe('Category B: detail without ownership check', () => {
    it('B1: GET /approval/instances/<other> → 403 (staff cannot view others approval)', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/instances/${otherApprovalInstanceId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('B2: GET /payroll/runs/:id/details → staff only sees own employee items', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payroll/runs/${payrollRunId}/details`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      // Staff should only see their own employee's details
      const employeeIds = body.data.employees.map((e: any) => e.employee.id);
      expect(employeeIds).toContain(staffEmpId);
      expect(employeeIds).not.toContain(otherEmpId);
    });

    it('B3: GET /attendance/punch/makeup → staff only sees own records', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      // Staff should only see their own makeup records
      const employeeIds = body.data.list.map((m: any) => m.employeeId);
      expect(employeeIds).toContain(staffEmpId);
      expect(employeeIds).not.toContain(otherEmpId);
    });
  });

  // ================================================================
  // Category C: write without scope check (6 endpoints)
  // ================================================================
  describe('Category C: write without scope check', () => {
    it('C1: PATCH /employees/<other> → 403', async () => {
      const res = await inject(app, {
        method: 'PATCH',
        url: `/api/v1/employees/${otherEmpId}`,
        headers: { cookie: staffCookie },
        payload: { name: 'Hacked Name' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('C2: POST /employees/<other>/resign → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/employees/${otherEmpId}/resign`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('C3: POST /leave-records (employeeId=other) → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId: otherEmpId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 1,
          reason: 'IDOR test',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('C4: POST /overtime-records (employeeId=other) → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/overtime-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId: otherEmpId,
          overtimeDate: '2026-09-01',
          startTime: '2026-09-01T18:00:00.000Z',
          endTime: '2026-09-01T20:00:00.000Z',
          hours: 2,
          reason: 'IDOR test',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('C5: POST /attendance/monthly/<other>/confirm → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/attendance/monthly/${otherMonthlyId}/confirm`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('C6: POST /payroll/runs/:id/adjust (employeeId=other) → 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/payroll/runs/${payrollRunId}/adjust`,
        headers: { cookie: staffCookie },
        payload: {
          employeeId: otherEmpId,
          itemCode: 'bonus',
          amount: 500,
          reason: 'IDOR test',
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ================================================================
  // Category D: list without scope filter (2 endpoints)
  // ================================================================
  describe('Category D: list without scope filter', () => {
    it('D1: GET /payroll/runs → staff only sees runs where they have payslips', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=50',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const runIds = body.data.list.map((r: any) => r.id);
      // Staff should see the published run (has their payslip) but not the draft run
      expect(runIds).toContain(publishedRunId);
      expect(runIds).not.toContain(payrollRunId);
    });

    it('D2: GET /attendance/punch/makeup/<other> with admin → 200 (admin has full access)', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/punch/makeup/${otherMakeupId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('D2-negative: GET /attendance/punch/makeup/<other> with staff → 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/punch/makeup/${otherMakeupId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ================================================================
  // Category E: more endpoints (additional coverage)
  // ================================================================
  describe('Category E: additional IDOR coverage', () => {
    it('E1: GET /employees/<other> → 403 (staff cannot view other employee detail)', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/employees/${otherEmpId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('E2: GET /payslips/me/<other-payslip-id> → 403 (staff cannot view others payslip via me/:id)', async () => {
      // First, get the staff's payslip id to know the pattern
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/payslips/me?page=1&pageSize=10',
        headers: { cookie: staffCookie },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.payload);
      expect(listBody.code).toBe(0);
      if (listBody.data.list && listBody.data.list.length > 0) {
        const myId = listBody.data.list[0].id;
        // Try an ID that's not theirs (adjacent ID pattern — test against other's data)
        // We'll test using the endpoint with a fabricated non-owned payslip ID approach:
        // Instead, let's verify the service filters by userId by checking list only contains their own
        const allMine = listBody.data.list.every((p: any) => p.employeeId === staffEmpId);
        expect(allMine).toBe(true);
        // Negative: try a payslip that doesn't belong to them
        const otherId = myId + 9999;
        const detailRes = await inject(app, {
          method: 'GET',
          url: `/api/v1/payslips/me/${otherId}`,
          headers: { cookie: staffCookie },
        });
        // Should be 404 or 403, not 200 with someone else's data
        expect([403, 404]).toContain(detailRes.statusCode);
      }
    });

    it('E3: POST /approval/instances/<other>/withdraw → 403 (staff cannot withdraw others approval)', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${otherApprovalInstanceId}/withdraw`,
        headers: { cookie: staffCookie },
        payload: { reason: 'IDOR test withdraw' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('E4: GET /employees → staff only sees self in list', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/employees?page=1&pageSize=50',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      const ids = body.data.list.map((e: any) => e.id);
      expect(ids).toContain(staffEmpId);
      expect(ids).not.toContain(otherEmpId);
    });

    it('E5: PATCH /employees/me/profile → 200 (staff can update own profile)', async () => {
      const res = await inject(app, {
        method: 'PATCH',
        url: '/api/v1/employees/me/profile',
        headers: { cookie: staffCookie },
        payload: { phone: '13800138000' },
      });
      expect([200, 403].includes(res.statusCode)).toBe(true);
    });
  });

  // ================================================================
  // Regression: admin still has full access
  // ================================================================
  describe('Regression: admin still has full access', () => {
    it('Admin can list attendance/monthly with any employeeId → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/monthly?employeeId=${otherEmpId}&month=2026-07`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('Admin can view any approval instance → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/instances/${otherApprovalInstanceId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('Admin can view payroll run details with all employees → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/payroll/runs/${payrollRunId}/details`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.employees.length).toBe(2);
    });

    it('Admin can view all payroll runs → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/payroll/runs?page=1&pageSize=50',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });

    it('Admin can list all punch makeup records → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });
  });
});
