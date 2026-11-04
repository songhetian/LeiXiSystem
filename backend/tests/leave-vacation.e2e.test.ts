// S06 · 请假/加班/休假额度 e2e（TDD RED 先行）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/redis/redis.service';

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
    // 员工自助发起请假/加班挂个人自助权限点（不是 attendance:manage）：
    // 这里刻意不给 staff 绑 manage，用来证明普通员工在没有管理权时也能提交申请。
    const permLeaveApply = await prisma.permission.create({
      data: { code: 'personal:leave:apply', name: '请假申请', module: 'personal', type: 'menu' },
    });
    const permOvertimeApply = await prisma.permission.create({
      data: { code: 'personal:overtime:apply', name: '加班申请', module: 'personal', type: 'menu' },
    });
    const permApprovalWorkflowManage = await prisma.permission.create({
      data: { code: 'approval:workflow:manage', name: '审批流程管理', module: 'approval', type: 'menu' },
    });
    const permApprovalTodoView = await prisma.permission.create({
      data: { code: 'approval:todo:view', name: '我的待办查看', module: 'approval', type: 'menu' },
    });
    const permApprovalSubmittedView = await prisma.permission.create({
      data: { code: 'approval:submitted:view', name: '我的申请查看', module: 'approval', type: 'menu' },
    });

    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    const managerRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: staffRole.id, permissionId: permView.id },
        { roleId: staffRole.id, permissionId: permLeaveApply.id },
        { roleId: staffRole.id, permissionId: permOvertimeApply.id },
        { roleId: staffRole.id, permissionId: permApprovalTodoView.id },
        { roleId: staffRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: managerRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permManage.id },
        { roleId: managerRole.id, permissionId: permApprovalTodoView.id },
        { roleId: managerRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: hrRole.id, permissionId: permView.id },
        { roleId: hrRole.id, permissionId: permManage.id },
        { roleId: hrRole.id, permissionId: permApprovalTodoView.id },
        { roleId: hrRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permApprovalWorkflowManage.id },
        { roleId: adminRole.id, permissionId: permApprovalTodoView.id },
        { roleId: adminRole.id, permissionId: permApprovalSubmittedView.id },
      ],
    });

    const staff = await prisma.user.create({
      data: { username: 'staff_leave', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工', status: 'active' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager_leave', passwordHash: await bcrypt.hash('123456', 10), realName: '张主管', status: 'active' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr_leave', passwordHash: await bcrypt.hash('123456', 10), realName: '李HR', status: 'active' },
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_leave', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员', status: 'active' },
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

    // 月假类型：monthlyDays 为 12 元素数组（依次对应 1~12 月），前端据此判断
    // 申请请假时是否需要展示「抵扣月份」下拉
    const monthlyType = await prisma.vacationType.create({
      data: {
        code: 'monthly',
        name: '月假',
        baseDays: 0,
        sortOrder: 3,
        monthlyDays: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      },
    });

    await prisma.vacationBalance.create({
      data: {
        employeeId: emp.id,
        vacationTypeId: annualType.id,
        year: 2026,
        totalDays: 5,
        usedDays: 0,
      },
    });

    await prisma.vacationBalance.create({
      data: {
        employeeId: emp.id,
        vacationTypeId: monthlyType.id,
        year: 2026,
        month: 1,
        totalDays: 1,
        usedDays: 0,
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    // 清 Redis 中上轮测试遗留的审批流/权限/部门缓存（按 code 命中旧 id 会污染本轮数据）
    const redis = app.get(RedisService);
    if (redis.isEnabled) {
      const client = redis.getClient();
      for (const pattern of ['approval:workflow:*', 'user:perm:*', 'system:depts:*']) {
        // ioredis 的 keyPrefix 只作用于 get/set/del 等，keys() 需手动拼前缀；返回值再剥前缀给 del
        const keys = await client.keys(redis.keyPrefix + pattern);
        // keys() 返回的实际 key 已带 keyPrefix，del 会再加一层导致删不掉，先剥掉前缀
        const logical = keys.map((k) => (k.startsWith(redis.keyPrefix) ? k.slice(redis.keyPrefix.length) : k));
        if (logical.length > 0) await client.del(...logical);
      }
    }

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

      // 月假类型必须返回 monthlyDays（12 元素），否则前端无法判断是否需要选「抵扣月份」
      const monthly = body.data.find((b: any) => b.vacationType.code === 'monthly');
      expect(monthly).toBeDefined();
      expect(monthly.vacationType.monthlyDays).toHaveLength(12);
    });

    it('加班审批后自动转调休（按8小时=1天换算），同一笔重复兑换被拒', async () => {
      const otRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/overtime-records',
        headers: { cookie: staffCookie },
        payload: {
          employeeId,
          overtimeDate: '2026-08-10',
          // 服务端以起止时间推算时长（忽略客户端 hours），8 小时跨度才折算 1 天调休
          startTime: '2026-08-10T00:00:00.000Z',
          endTime: '2026-08-10T08:00:00.000Z',
          hours: 8,
          reason: '项目上线加班',
        },
      });
      const otBody = JSON.parse(otRes.payload);
      expect(otRes.statusCode).toBe(200);
      expect(otBody.code).toBe(0);
      const overtimeId = otBody.data.id;
      expect(otBody.data.status).toBe('pending');
      expect(Number(otBody.data.hours)).toBe(8);

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

      // 审批通过后由 approval.approved 监听器自动转调休（fire-and-forget），
      // 轮询等待 compensatory 额度入账（8 小时按 8 小时/天 = 1 天）
      let compensatory: any;
      for (let i = 0; i < 30; i++) {
        const balRes = await inject(app, {
          method: 'GET',
          url: '/api/v1/vacation/balances/mine',
          headers: { cookie: staffCookie },
        });
        const balBody = JSON.parse(balRes.payload);
        compensatory = balBody.data.find((b: any) => b.vacationType.code === 'compensatory');
        if (compensatory && Number(compensatory.totalDays) === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(compensatory).toBeDefined();
      expect(Number(compensatory.totalDays)).toBe(1);

      // 手动兑换是独立路径，与监听共用一次性令牌：同一笔加班已被自动兑换，再兑应 422
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
      expect(convertRes.statusCode).toBe(422);
      // ERROR_CODES.OVERTIME_ALREADY_COMPENSATED = 2212（加班已兑换调休）
      expect(JSON.parse(convertRes.payload).code).toBe(2212);
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
