// S06+S09 · 请假/加班接入真实审批流 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient, Prisma } from '@prisma/client';
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

describe('S06+S09 · 请假接入真实审批流', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;
  let managerCookie: string;
  let hrCookie: string;
  let employeeId: number;
  let annualLeaveTypeId: number;
  let deptId: number;
  let staffUserId: number;
  let managerUserId: number;

  beforeAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });
    const permManage = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });

    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    const managerRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: staffRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permManage.id },
        { roleId: hrRole.id, permissionId: permView.id },
        { roleId: hrRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: adminRole.id, permissionId: permManage.id },
      ],
    });

    const staff = await prisma.user.create({
      data: { username: 'staff_approval', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager_approval', passwordHash: await bcrypt.hash('123456', 10), realName: '张主管' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr_approval', passwordHash: await bcrypt.hash('123456', 10), realName: '李HR' },
    });
    staffUserId = staff.id;
    managerUserId = manager.id;

    await prisma.userRole.createMany({
      data: [
        { userId: staff.id, roleId: staffRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: hr.id, roleId: hrRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    deptId = dept.id;

    await prisma.userDepartment.create({
      data: { userId: staff.id, departmentId: dept.id },
    });
    await prisma.userDepartment.create({
      data: { userId: manager.id, departmentId: dept.id },
    });

    const emp = await prisma.employee.create({
      data: {
        employeeNo: 'E001', name: '王员工', departmentId: dept.id, userId: staff.id,
        salary: 8000, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    employeeId = emp.id;

    const annualType = await prisma.vacationType.create({
      data: { code: 'annual', name: '年假', sortOrder: 1 },
    });
    annualLeaveTypeId = annualType.id;

    await prisma.vacationBalance.create({
      data: {
        employeeId: emp.id,
        vacationTypeId: annualType.id,
        year: 2026,
        totalDays: 10,
        usedDays: 0,
      },
    });

    await prisma.approvalWorkflow.create({
      data: {
        code: 'leave',
        name: '请假审批',
        module: 'attendance',
        status: 'active',
        nodes: {
          create: [
            { nodeKey: 'dept_manager', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'hr', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
          ],
        },
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    staffCookie = await login(app, 'staff_approval');
    managerCookie = await login(app, 'manager_approval');
    hrCookie = await login(app, 'hr_approval');
  });

  afterAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await app.close();
  });

  describe('请假申请 → 审批流', () => {
    it('创建请假申请，状态为 pending，额度不扣减', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          days: 1,
          reason: '有事',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.status).toBe('pending');

      const balance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: 2026,
          },
        },
      });
      expect(Number(balance!.usedDays)).toBe(0);
    });

    it('提交请假审批，状态变为 approving', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/leave-records/mine',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.payload);
      const leaveId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/submit`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.status).toBe('approving');
      expect(body.data.approvalInstanceId).toBeDefined();
    });

    it('部门主管审批通过，流转到 HR 审批，额度仍未扣减', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/leave-records/mine',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.payload);
      const leaveId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.status).toBe('approving');

      const balance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: 2026,
          },
        },
      });
      expect(Number(balance!.usedDays)).toBe(0);
    });

    it('HR 审批通过，请假完成，额度扣减', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/leave-records/mine',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.payload);
      const leaveId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/approve`,
        headers: { cookie: hrCookie },
        payload: { comment: '同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.status).toBe('approved');

      const balance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: 2026,
          },
        },
      });
      expect(Number(balance!.usedDays)).toBe(1);

      const changes = await prisma.vacationBalanceChange.findMany({
        where: { employeeId, changeType: 'deduction' },
      });
      expect(changes.length).toBe(1);
    });

    it('主管驳回请假，状态变为 rejected，额度不扣减', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-08-20',
          endDate: '2026-08-20',
          days: 2,
          reason: '有事',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const leaveId = createBody.data.id;

      await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/submit`,
        headers: { cookie: staffCookie },
      });

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/reject`,
        headers: { cookie: managerCookie },
        payload: { comment: '驳回' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.status).toBe('rejected');

      const balance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: 2026,
          },
        },
      });
      expect(Number(balance!.usedDays)).toBe(1);
    });

    it('余额不足时，创建请假申请仍被拒绝', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          days: 30,
          reason: '长假',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe(2202);
    });

    it('非申请人不能提交审批', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-08-25',
          endDate: '2026-08-25',
          days: 1,
          reason: '有事',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const leaveId = createBody.data.id;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/submit`,
        headers: { cookie: managerCookie },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
