// S06 · 请假/加班/休假额度 e2e（TDD RED 先行）
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

describe('S06 · 请假/加班/休假额度', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;
  let managerCookie: string;
  let hrCookie: string;
  let adminCookie: string;
  let employeeId: number;
  let annualLeaveTypeId: number;
  let compensatoryLeaveTypeId: number;

  beforeAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
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
    const permApprovalManage = await prisma.permission.create({
      data: { code: 'approval:manage', name: '审批配置管理', module: 'approval', type: 'menu' },
    });
    const permApprovalUse = await prisma.permission.create({
      data: { code: 'approval:use', name: '审批使用', module: 'approval', type: 'menu' },
    });

    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    const managerRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: staffRole.id, permissionId: permView.id },
        { roleId: staffRole.id, permissionId: permApprovalUse.id },
        { roleId: managerRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permManage.id },
        { roleId: managerRole.id, permissionId: permApprovalUse.id },
        { roleId: hrRole.id, permissionId: permView.id },
        { roleId: hrRole.id, permissionId: permManage.id },
        { roleId: hrRole.id, permissionId: permApprovalUse.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permApprovalManage.id },
        { roleId: adminRole.id, permissionId: permApprovalUse.id },
      ],
    });

    const staff = await prisma.user.create({
      data: { username: 'staff_leave', passwordHash: await bcrypt.hash('123456', 10), name: '王员工' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager_leave', passwordHash: await bcrypt.hash('123456', 10), name: '张主管' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr_leave', passwordHash: await bcrypt.hash('123456', 10), name: '李HR' },
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_leave', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: staff.id, roleId: staffRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: hr.id, roleId: hrRole.id },
        { userId: admin.id, roleId: adminRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    const emp = await prisma.employee.create({
      data: {
        employeeNo: 'E006',
        name: '王员工',
        departmentId: dept.id,
        userId: staff.id,
        salary: 8000,
        hireDate: new Date('2024-01-01'),
        status: 'active',
      },
    });
    employeeId = emp.id;

    const annualType = await prisma.vacationType.create({
      data: { code: 'annual', name: '年假', baseDays: 5, sortOrder: 1 },
    });
    annualLeaveTypeId = annualType.id;

    const compensatoryType = await prisma.vacationType.create({
      data: { code: 'compensatory', name: '调休', baseDays: 0, sortOrder: 2 },
    });
    compensatoryLeaveTypeId = compensatoryType.id;

    await prisma.vacationBalance.create({
      data: {
        employeeId: emp.id,
        vacationTypeId: annualType.id,
        year: 2026,
        totalDays: 5,
        usedDays: 0,
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    staffCookie = await login(app, 'staff_leave');
    managerCookie = await login(app, 'manager_leave');
    hrCookie = await login(app, 'hr_leave');
    adminCookie = await login(app, 'admin_leave');

    const wfRes = await inject(app, {
      method: 'POST',
      url: '/api/v1/approval/workflows',
      headers: { cookie: adminCookie },
      payload: {
        code: 'leave',
        name: '请假审批',
        module: 'attendance',
        status: 'active',
        nodes: [
          { nodeKey: 'n1', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
          { nodeKey: 'n2', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
        ],
      },
    });
    expect(wfRes.statusCode).toBe(200);

    const otWfRes = await inject(app, {
      method: 'POST',
      url: '/api/v1/approval/workflows',
      headers: { cookie: adminCookie },
      payload: {
        code: 'overtime',
        name: '加班审批',
        module: 'attendance',
        status: 'active',
        nodes: [
          { nodeKey: 'n1', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
        ],
      },
    });
    expect(otWfRes.statusCode).toBe(200);
  });

  afterAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
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

  describe('休假额度', () => {
    it('应该能看到我的休假额度列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const annual = body.data.find((b: any) => b.vacationType.code === 'annual');
      expect(Number(annual.totalDays)).toBe(5);
      expect(Number(annual.usedDays)).toBe(0);
    });

    it('加班审批后可兑换调休（按8小时=1天换算）', async () => {
      const otRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/overtime-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          overtimeDate: '2026-08-10',
          startTime: '2026-08-10T18:00:00.000Z',
          endTime: '2026-08-10T21:00:00.000Z',
          hours: 8,
          reason: '项目上线加班',
        },
      });
      const otBody = JSON.parse(otRes.payload);
      expect(otRes.statusCode).toBe(200);
      expect(otBody.code).toBe(0);
      const overtimeId = otBody.data.id;
      expect(otBody.data.status).toBe('pending');

      await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${overtimeId}/submit`,
        headers: { cookie: staffCookie },
      });

      const approveRes = await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${overtimeId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意' },
      });
      const approveBody = JSON.parse(approveRes.payload);
      expect(approveBody.data.status).toBe('approved');

      const convertRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert',
        headers: { cookie: adminCookie },
        payload: {
          employeeId,
          overtimeId,
          vacationTypeId: compensatoryLeaveTypeId,
          hours: 8,
        },
      });
      const convertBody = JSON.parse(convertRes.payload);
      expect(convertRes.statusCode).toBe(200);
      expect(convertBody.code).toBe(0);

      const balRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/mine',
        headers: { cookie: staffCookie },
      });
      const balBody = JSON.parse(balRes.payload);
      const compensatory = balBody.data.find((b: any) => b.vacationType.code === 'compensatory');
      expect(compensatory).toBeDefined();
      expect(Number(compensatory.totalDays)).toBe(1);
    });

    it('额度变动记录可查询', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/changes/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('请假申请', () => {
    let leaveId: number;

    it('创建请假申请，状态为 pending，额度未扣减', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-08-15',
          endDate: '2026-08-16',
          days: 2,
          reason: '家里有事',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('pending');
      expect(Number(body.data.days)).toBe(2);
      leaveId = body.data.id;

      const balRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/mine',
        headers: { cookie: staffCookie },
      });
      const balBody = JSON.parse(balRes.payload);
      const annual = balBody.data.find((b: any) => b.vacationType.code === 'annual');
      expect(Number(annual.usedDays)).toBe(0);
    });

    it('提交审批，状态变为 approving', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/submit`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approving');
      expect(body.data.approvalInstanceId).toBeDefined();
    });

    it('主管审批通过，流转到HR节点', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approving');
    });

    it('HR审批通过，状态变为 approved，额度扣减', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${leaveId}/approve`,
        headers: { cookie: hrCookie },
        payload: { comment: 'HR同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approved');

      const balRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/mine',
        headers: { cookie: staffCookie },
      });
      const balBody = JSON.parse(balRes.payload);
      const annual = balBody.data.find((b: any) => b.vacationType.code === 'annual');
      expect(Number(annual.usedDays)).toBe(2);
    });

    it('余额不足时拒绝请假创建', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          days: 10,
          reason: '长途旅行',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(422);
      expect(body.code).toBeDefined();
    });

    it('驳回请假申请', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/leave-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          startDate: '2026-08-20',
          endDate: '2026-08-21',
          days: 1,
          reason: '有事',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const newLeaveId = createBody.data.id;

      await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${newLeaveId}/submit`,
        headers: { cookie: staffCookie },
      });

      const rejectRes = await inject(app, {
        method: 'POST',
        url: `/api/v1/leave-records/${newLeaveId}/reject`,
        headers: { cookie: managerCookie },
        payload: { comment: '理由不充分' },
      });
      const rejectBody = JSON.parse(rejectRes.payload);
      expect(rejectRes.statusCode).toBe(200);
      expect(rejectBody.code).toBe(0);
      expect(rejectBody.data.status).toBe('rejected');
    });

    it('我的请假列表可查询', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/leave-records/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('加班申请', () => {
    let overtimeId: number;

    it('创建加班申请，状态为 pending', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/overtime-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          overtimeDate: '2026-08-12',
          startTime: '2026-08-12T18:00:00.000Z',
          endTime: '2026-08-12T20:00:00.000Z',
          hours: 2,
          reason: '版本发布',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('pending');
      expect(Number(body.data.hours)).toBe(2);
      overtimeId = body.data.id;
    });

    it('提交审批，状态变为 approving', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${overtimeId}/submit`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approving');
      expect(body.data.approvalInstanceId).toBeDefined();
    });

    it('主管审批通过，状态变为 approved', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${overtimeId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意加班' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approved');
    });

    it('驳回加班申请', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/overtime-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          overtimeDate: '2026-08-13',
          startTime: '2026-08-13T18:00:00.000Z',
          endTime: '2026-08-13T21:00:00.000Z',
          hours: 3,
          reason: '测试驳回',
        },
      });
      const createBody = JSON.parse(createRes.payload);
      const newOtId = createBody.data.id;

      await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${newOtId}/submit`,
        headers: { cookie: staffCookie },
      });

      const rejectRes = await inject(app, {
        method: 'POST',
        url: `/api/v1/overtime-records/${newOtId}/reject`,
        headers: { cookie: managerCookie },
        payload: { comment: '不需要加班' },
      });
      const rejectBody = JSON.parse(rejectRes.payload);
      expect(rejectRes.statusCode).toBe(200);
      expect(rejectBody.code).toBe(0);
      expect(rejectBody.data.status).toBe('rejected');
    });

    it('我的加班列表可查询', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/overtime-records/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(2);
    });
  });
});
