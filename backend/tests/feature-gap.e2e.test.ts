import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

describe('功能缺失全景 · TDD 综合测试', () => {
  let app: NestFastifyApplication;
  let eventEmitter: EventEmitter2;
  let adminCookie: string;
  let hrCookie: string;
  let managerCookie: string;
  let staffCookie: string;
  let staff2Cookie: string;
  let dept1Id: number;
  let dept2Id: number;
  let emp1Id: number;
  let emp2Id: number;
  let annualLeaveTypeId: number;

  beforeAll(async () => {
    await prisma.payrollAdjustment.deleteMany();
    await prisma.payrollDetail.deleteMany();
    await prisma.payslip.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.attendanceAppeal.deleteMany();
    await prisma.employeeTransfer.deleteMany();
    await prisma.trainingRecord.deleteMany();
    await prisma.employeeReward.deleteMany();
    await prisma.employeeCertificate.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.probation.deleteMany();
    await prisma.resignation.deleteMany();
    await prisma.onboarding.deleteMany();
    await prisma.reimbursementItem.deleteMany();
    await prisma.reimbursement.deleteMany();
    await prisma.reimbursementType.deleteMany();
    await prisma.attendanceMonthly.deleteMany();
    await prisma.attendanceDaily.deleteMany();
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.punchMakeup.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.approvalCommentTemplate.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalGroupMember.deleteMany();
    await prisma.approvalGroup.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();

    const permissions = await prisma.permission.createMany({
      data: [
        { code: 'employee:view', name: '员工查看', module: 'employee', type: 'menu' },
        { code: 'employee:manage', name: '员工管理', module: 'employee', type: 'menu' },
        { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
        { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
        { code: 'attendance:appeal:view', name: '考勤申诉查看', module: 'attendance', type: 'menu' },
        { code: 'attendance:appeal:apply', name: '考勤申诉申请', module: 'attendance', type: 'menu' },
        { code: 'resignation:view', name: '离职申请查看', module: 'employees', type: 'menu' },
        { code: 'resignation:apply', name: '离职申请', module: 'employees', type: 'menu' },
        { code: 'approval:workflow:manage', name: '审批流管理', module: 'approval', type: 'menu' },
        { code: 'approval:todo:view', name: '待办查看', module: 'approval', type: 'menu' },
        { code: 'approval:submitted:view', name: '我的申请', module: 'approval', type: 'menu' },
        { code: 'reports:view', name: '报表查看', module: 'reports', type: 'menu' },
        { code: 'reimbursement:view', name: '报销查看', module: 'reimbursement', type: 'menu' },
        { code: 'payroll:view', name: '薪资查看', module: 'payroll', type: 'menu' },
      ],
    });

    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const managerRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });

    const allPerms = await prisma.permission.findMany();
    const permMap = new Map(allPerms.map(p => [p.code, p.id]));

    await prisma.rolePermission.createMany({
      data: [
        ...allPerms.map(p => ({ roleId: adminRole.id, permissionId: p.id })),
        ...allPerms.map(p => ({ roleId: hrRole.id, permissionId: p.id })),
        ...allPerms.filter(p => ['employee:view', 'attendance:view', 'approval:todo:view', 'approval:submitted:view', 'reports:view', 'reimbursement:view'].includes(p.code)).map(p => ({ roleId: managerRole.id, permissionId: p.id })),
        ...allPerms.filter(p => ['attendance:view', 'attendance:appeal:view', 'attendance:appeal:apply', 'resignation:view', 'resignation:apply', 'approval:submitted:view', 'reimbursement:view'].includes(p.code)).map(p => ({ roleId: staffRole.id, permissionId: p.id })),
      ],
    });

    const admin = await prisma.user.create({ data: { username: 'fg_admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' } });
    const hr = await prisma.user.create({ data: { username: 'fg_hr', passwordHash: await bcrypt.hash('123456', 10), realName: '李HR' } });
    const manager = await prisma.user.create({ data: { username: 'fg_mgr', passwordHash: await bcrypt.hash('123456', 10), realName: '张主管' } });
    const staff = await prisma.user.create({ data: { username: 'fg_staff', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工' } });
    const staff2 = await prisma.user.create({ data: { username: 'fg_staff2', passwordHash: await bcrypt.hash('123456', 10), realName: '赵员工' } });

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: hr.id, roleId: hrRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: staff.id, roleId: staffRole.id },
        { userId: staff2.id, roleId: staffRole.id },
      ],
    });

    const dept1 = await prisma.department.create({ data: { name: '技术部' } });
    const dept2 = await prisma.department.create({ data: { name: '市场部' } });
    dept1Id = dept1.id;
    dept2Id = dept2.id;

    await prisma.userDepartment.createMany({
      data: [
        { userId: manager.id, departmentId: dept1.id },
        { userId: staff.id, departmentId: dept1.id },
        { userId: staff2.id, departmentId: dept2.id },
      ],
    });

    const emp1 = await prisma.employee.create({
      data: {
        employeeNo: 'FG001', name: '王员工', departmentId: dept1.id,
        userId: staff.id, salary: 8000, hireDate: new Date('2024-01-15'), status: 'active',
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        employeeNo: 'FG002', name: '赵员工', departmentId: dept2.id,
        userId: staff2.id, salary: 7000, hireDate: new Date('2024-06-20'), status: 'active',
      },
    });
    emp1Id = emp1.id;
    emp2Id = emp2.id;

    const leaveType = await prisma.vacationType.create({ data: { code: 'annual', name: '年假', sortOrder: 1 } });
    annualLeaveTypeId = leaveType.id;
    await prisma.vacationBalance.create({ data: { employeeId: emp1.id, vacationTypeId: leaveType.id, year: 2026, totalDays: 10, usedDays: 0 } });

    await prisma.reimbursementType.create({ data: { code: 'travel', name: '差旅费' } });

    await prisma.approvalWorkflow.create({
      data: {
        code: 'leave', name: '请假审批', module: 'attendance', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'mgr', name: '主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'hr', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
          ],
        },
      },
    });
    await prisma.approvalWorkflow.create({
      data: {
        code: 'reimbursement', name: '报销审批', module: 'reimbursement', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'mgr', name: '主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'hr', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
          ],
        },
      },
    });
    await prisma.approvalWorkflow.create({
      data: {
        code: 'resignation', name: '离职审批', module: 'employees', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'mgr', name: '主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'hr', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
          ],
        },
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();
    eventEmitter = app.get(EventEmitter2);

    // 清空 Redis 中可能残留的审批流缓存（上一次测试的旧 id 会导致外键错误）
    try {
      const { RedisService } = require('../src/common/redis/redis.service');
      const redis = app.get(RedisService);
      if (redis.isEnabled) {
        const client = redis.getClient();
        const keys = await client.keys('approval:workflow:*');
        if (keys.length > 0) await client.del(...keys);
        const permKeys = await client.keys('user:perm:*');
        if (permKeys.length > 0) await client.del(...permKeys);
        const deptKeys = await client.keys('system:depts:*');
        if (deptKeys.length > 0) await client.del(...deptKeys);
      }
    } catch {
      // ignore
    }

    adminCookie = await login(app, 'fg_admin');
    hrCookie = await login(app, 'fg_hr');
    managerCookie = await login(app, 'fg_mgr');
    staffCookie = await login(app, 'fg_staff');
    staff2Cookie = await login(app, 'fg_staff2');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // =========================================================================
  // P0-1: 报销审批通过 → 事件驱动更新业务数据
  // =========================================================================
  describe('P0-1 · 报销审批事件驱动', () => {
    it('审批通过后通过事件自动更新报销状态为 approved', async () => {
      const events: any[] = [];
      const handler = (p: any) => events.push(p);
      eventEmitter.on('approval.approved', handler);

      try {
        const createRes = await inject(app, {
          method: 'POST', url: '/api/v1/reimbursements',
          headers: { cookie: staffCookie },
          payload: {
            typeCode: 'travel', title: '北京出差', totalAmount: 1000,
            items: [{ name: '高铁票', amount: 1000 }],
          },
        });
        const reim = JSON.parse(createRes.payload).data;
        expect(reim.status).toBe('pending');

        const submitRes = await inject(app, {
          method: 'POST', url: `/api/v1/reimbursements/${reim.id}/submit`,
          headers: { cookie: staffCookie },
        });
        const submitted = JSON.parse(submitRes.payload).data;
        expect(submitted.status).toBe('approving');

        const approveRes1 = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
          headers: { cookie: managerCookie },
          payload: { comment: '同意' },
        });
        expect(approveRes1.statusCode).toBe(200);

        const approveRes2 = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
          headers: { cookie: hrCookie },
          payload: { comment: '同意' },
        });
        expect(approveRes2.statusCode).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(events.length).toBeGreaterThanOrEqual(1);
        const evt = events.find(e => e.workflowCode === 'reimbursement');
        expect(evt).toBeDefined();
        expect(evt.status).toBe('approved');

        const reimAfter = await prisma.reimbursement.findUnique({ where: { id: reim.id } });
        expect(reimAfter?.status).toBe('approved');
      } finally {
        eventEmitter.off('approval.approved', handler);
      }
    });

    it('审批驳回后通过事件自动更新报销状态为 rejected', async () => {
      const events: any[] = [];
      const handler = (p: any) => events.push(p);
      eventEmitter.on('approval.rejected', handler);

      try {
        const createRes = await inject(app, {
          method: 'POST', url: '/api/v1/reimbursements',
          headers: { cookie: staffCookie },
          payload: {
            typeCode: 'travel', title: '上海出差-驳回', totalAmount: 500,
            items: [{ name: '打车费', amount: 500 }],
          },
        });
        const reim = JSON.parse(createRes.payload).data;

        const submitRes = await inject(app, {
          method: 'POST', url: `/api/v1/reimbursements/${reim.id}/submit`,
          headers: { cookie: staffCookie },
        });
        const submitted = JSON.parse(submitRes.payload).data;

        const rejectRes = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/reject`,
          headers: { cookie: managerCookie },
          payload: { comment: '发票不合规' },
        });
        expect(rejectRes.statusCode).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(events.length).toBeGreaterThanOrEqual(1);
        const evt = events.find(e => e.workflowCode === 'reimbursement');
        expect(evt).toBeDefined();
        expect(evt.status).toBe('rejected');

        const reimAfter = await prisma.reimbursement.findUnique({ where: { id: reim.id } });
        expect(reimAfter?.status).toBe('rejected');
      } finally {
        eventEmitter.off('approval.rejected', handler);
      }
    });
  });

  // =========================================================================
  // P0-2: 数据权限隔离 - 报销模块
  // =========================================================================
  describe('P0-2 · 数据权限隔离 - 报销', () => {
    it('普通员工只能看到自己的报销', async () => {
      const res = await inject(app, {
        method: 'GET', url: '/api/v1/reimbursements/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      const allMine = body.data.items;
      expect(allMine.every((item: any) => item.applicantName === '王员工')).toBe(true);
    });

    it('部门经理只能看到本部门的报销（通过数据范围）', async () => {
      const createRes = await inject(app, {
        method: 'POST', url: '/api/v1/reimbursements',
        headers: { cookie: staff2Cookie },
        payload: {
          typeCode: 'travel', title: '市场部报销', totalAmount: 300,
          items: [{ name: '办公用品', amount: 300 }],
        },
      });
      const reim2 = JSON.parse(createRes.payload).data;
      await inject(app, {
        method: 'POST', url: `/api/v1/reimbursements/${reim2.id}/submit`,
        headers: { cookie: staff2Cookie },
      });

      const pendingRes = await inject(app, {
        method: 'GET', url: '/api/v1/reimbursements/pending',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(pendingRes.payload);
      const applicantNames = body.data.items.map((item: any) => item.applicantName);
      expect(applicantNames).not.toContain('赵员工');
    });
  });

  // =========================================================================
  // P1-1: 员工自助 - 个人信息修改
  // =========================================================================
  describe('P1-1 · 员工自助 - 个人信息', () => {
    it('获取我的信息（员工档案）', async () => {
      const res = await inject(app, {
        method: 'GET', url: '/api/v1/employees/me',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.name).toBe('王员工');
      expect(body.data.employeeNo).toBe('FG001');
    });

    it('修改我的个人信息（手机号等）', async () => {
      const res = await inject(app, {
        method: 'PATCH', url: '/api/v1/employees/me/profile',
        headers: { cookie: staffCookie },
        payload: { phone: '13800138000', address: '北京市朝阳区' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.phone).toBe('13800138000');

      const emp = await prisma.employee.findUnique({ where: { id: emp1Id } });
      expect(emp?.phone).toBe('13800138000');
      expect(emp?.address).toBe('北京市朝阳区');
    });

    it('不能修改敏感字段（工资、部门、职位、状态）', async () => {
      const res = await inject(app, {
        method: 'PATCH', url: '/api/v1/employees/me/profile',
        headers: { cookie: staffCookie },
        payload: { salary: 99999, status: 'resigned', departmentId: 99999 },
      });
      expect(res.statusCode).toBe(200);

      const emp = await prisma.employee.findUnique({ where: { id: emp1Id } });
      expect(Number(emp?.salary)).toBe(8000);
      expect(emp?.status).toBe('active');
      expect(emp?.departmentId).toBe(dept1Id);
    });
  });

  // =========================================================================
  // P1-2: 入职/离职趋势报表
  // =========================================================================
  describe('P1-2 · 入职/离职趋势报表', () => {
    beforeAll(async () => {
      await prisma.employee.createMany({
        data: [
          { employeeNo: 'TREND01', name: '入职1', departmentId: dept1Id, salary: 5000, hireDate: new Date('2026-01-10'), status: 'active' },
          { employeeNo: 'TREND02', name: '入职2', departmentId: dept1Id, salary: 5000, hireDate: new Date('2026-01-20'), status: 'active' },
          { employeeNo: 'TREND03', name: '入职3', departmentId: dept2Id, salary: 5000, hireDate: new Date('2026-02-05'), status: 'active' },
          { employeeNo: 'TREND04', name: '离职1', departmentId: dept1Id, salary: 5000, hireDate: new Date('2025-01-01'), status: 'resigned', resignDate: new Date('2026-01-15') },
          { employeeNo: 'TREND05', name: '离职2', departmentId: dept2Id, salary: 5000, hireDate: new Date('2025-06-01'), status: 'resigned', resignDate: new Date('2026-02-20') },
        ],
      });
    });

    it('按月统计入职人数趋势', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/hiring-trend?startDate=2026-01-01&endDate=2026-06-30',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.monthly).toBeDefined();
      expect(Array.isArray(body.data.monthly)).toBe(true);
      const janData = body.data.monthly.find((m: any) => m.month === '2026-01');
      expect(janData).toBeDefined();
      expect(janData.hired).toBe(2);
    });

    it('按月统计离职人数趋势', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/hiring-trend?startDate=2026-01-01&endDate=2026-06-30',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      const janData = body.data.monthly.find((m: any) => m.month === '2026-01');
      expect(janData.resigned).toBe(1);
      const febData = body.data.monthly.find((m: any) => m.month === '2026-02');
      expect(febData.resigned).toBe(1);
    });

    it('按部门维度统计入职/离职', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/hiring-trend?startDate=2026-01-01&endDate=2026-06-30&groupBy=department',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byDepartment).toBeDefined();
      expect(Array.isArray(body.data.byDepartment)).toBe(true);
    });

    it('部门经理只能看到本部门的趋势数据', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/hiring-trend?startDate=2026-01-01&endDate=2026-06-30',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      const deptNames = body.data.byDepartment?.map((d: any) => d.name) || [];
      expect(deptNames).not.toContain('市场部');
    });
  });

  // =========================================================================
  // P1-3: 报表多维度筛选
  // =========================================================================
  describe('P1-3 · 报表多维度筛选', () => {
    it('考勤月报支持按部门筛选', async () => {
      const monthly = await prisma.attendanceMonthly.create({
        data: { employeeId: emp1Id, month: '2026-08', workDays: 22, lateCount: 1, earlyCount: 0, absentDays: 0, overtimeHours: 10, status: 'confirmed' },
      });

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/reports/attendance-monthly?month=2026-08&departmentId=${dept1Id}`,
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      const deptNames = body.data.departments.map((d: any) => d.name);
      expect(deptNames).toContain('技术部');
    });

    it('人力成本报表支持按部门筛选', async () => {
      const run = await prisma.payrollRun.create({ data: { month: '2026-08', status: 'draft' } });
      await prisma.payrollDetail.create({
        data: { runId: run.id, employeeId: emp1Id, itemCode: 'base_salary', itemName: '基本工资', amount: 8000 },
      });
      await prisma.payrollDetail.create({
        data: { runId: run.id, employeeId: emp1Id, itemCode: 'overtime_pay', itemName: '加班费', amount: 500 },
      });

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/reports/labor-cost?month=2026-08&departmentId=${dept1Id}`,
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      const deptNames = body.data.departments.map((d: any) => d.name);
      expect(deptNames).toContain('技术部');
    });
  });

  // =========================================================================
  // P2-1: 试用期通过率报表
  // =========================================================================
  describe('P2-1 · 试用期通过率报表', () => {
    beforeAll(async () => {
      const probEmp1 = await prisma.employee.create({
        data: { employeeNo: 'PROB01', name: '试用期1', departmentId: dept1Id, salary: 6000, hireDate: new Date('2026-03-01'), status: 'probation' },
      });
      const probEmp2 = await prisma.employee.create({
        data: { employeeNo: 'PROB02', name: '试用期2', departmentId: dept1Id, salary: 6000, hireDate: new Date('2026-04-01'), status: 'active' },
      });
      const probEmp3 = await prisma.employee.create({
        data: { employeeNo: 'PROB03', name: '试用期3', departmentId: dept2Id, salary: 6000, hireDate: new Date('2026-03-15'), status: 'resigned', resignDate: new Date('2026-05-20') },
      });

      await prisma.probation.createMany({
        data: [
          { employeeId: probEmp1.id, probationStartDate: new Date('2026-03-01'), probationEndDate: new Date('2026-05-31'), status: 'pending' },
          { employeeId: probEmp2.id, probationStartDate: new Date('2026-04-01'), probationEndDate: new Date('2026-06-30'), status: 'approved' },
          { employeeId: probEmp3.id, probationStartDate: new Date('2026-03-15'), probationEndDate: new Date('2026-06-14'), status: 'rejected' },
        ],
      });
    });

    it('试用期通过率统计', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/probation-pass-rate?startDate=2026-01-01&endDate=2026-12-31',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeDefined();
      expect(body.data.approved).toBeDefined();
      expect(body.data.rejected).toBeDefined();
      expect(body.data.passRate).toBeDefined();
      expect(Number(body.data.passRate)).toBeGreaterThan(0);
    });

    it('按部门维度统计试用期通过率', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/probation-pass-rate?startDate=2026-01-01&endDate=2026-12-31&groupBy=department',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byDepartment).toBeDefined();
      expect(Array.isArray(body.data.byDepartment)).toBe(true);
    });
  });

  // =========================================================================
  // P2-2: 考勤异常报表
  // =========================================================================
  describe('P2-2 · 考勤异常报表', () => {
    beforeAll(async () => {
      const shift = await prisma.shift.create({
        data: { name: '早班', startTime: '09:00', endTime: '18:00', lateThreshold: 5, earlyThreshold: 5 },
      });

      await prisma.attendanceDaily.createMany({
        data: [
          { employeeId: emp1Id, workDate: new Date('2026-08-01'), shiftId: shift.id, status: 'normal', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0 },
          { employeeId: emp1Id, workDate: new Date('2026-08-02'), shiftId: shift.id, status: 'late', lateMinutes: 15, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0 },
          { employeeId: emp1Id, workDate: new Date('2026-08-03'), shiftId: shift.id, status: 'absent', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0 },
          { employeeId: emp2Id, workDate: new Date('2026-08-01'), shiftId: shift.id, status: 'early', lateMinutes: 0, earlyMinutes: 20, overtimeMinutes: 0, leaveDays: 0 },
        ],
      });
    });

    it('考勤异常统计（迟到/早退/旷工）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-abnormal?startDate=2026-08-01&endDate=2026-08-31',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.summary).toBeDefined();
      expect(body.data.summary.lateCount).toBeGreaterThanOrEqual(1);
      expect(body.data.summary.earlyCount).toBeGreaterThanOrEqual(1);
      expect(body.data.summary.absentCount).toBeGreaterThanOrEqual(1);
    });

    it('按部门统计考勤异常', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-abnormal?startDate=2026-08-01&endDate=2026-08-31&groupBy=department',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byDepartment).toBeDefined();
      expect(Array.isArray(body.data.byDepartment)).toBe(true);
    });

    it('按员工统计考勤异常排行', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/attendance-abnormal?startDate=2026-08-01&endDate=2026-08-31&groupBy=employee',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byEmployee).toBeDefined();
      expect(Array.isArray(body.data.byEmployee)).toBe(true);
    });
  });

  // =========================================================================
  // P2-3: 审批效率报表
  // =========================================================================
  describe('P2-3 · 审批效率报表', () => {
    it('审批效率统计（平均审批时长、通过率等）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/approval-efficiency?startDate=2026-01-01&endDate=2026-12-31',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.summary).toBeDefined();
      expect(body.data.summary.totalInstances).toBeDefined();
      expect(body.data.summary.approvedCount).toBeDefined();
      expect(body.data.summary.rejectedCount).toBeDefined();
    });

    it('按审批流类型统计效率', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/approval-efficiency?startDate=2026-01-01&endDate=2026-12-31&groupBy=workflow',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byWorkflow).toBeDefined();
      expect(Array.isArray(body.data.byWorkflow)).toBe(true);
    });

    it('按部门统计审批效率', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reports/approval-efficiency?startDate=2026-01-01&endDate=2026-12-31&groupBy=department',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.data.byDepartment).toBeDefined();
    });
  });

  // =========================================================================
  // P2-4: 员工自助 - 考勤申诉接入审批
  // =========================================================================
  describe('P2-4 · 员工自助 - 考勤申诉接入审批', () => {
    beforeAll(async () => {
      await prisma.approvalWorkflow.create({
        data: {
          code: 'attendance_appeal', name: '考勤申诉审批', module: 'attendance', status: 'active',
          nodes: {
            create: [
              { nodeKey: 'mgr', name: '主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
              { nodeKey: 'hr', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
            ],
          },
        },
      });
    });

    it('员工创建考勤申诉并提交审批', async () => {
      const createRes = await inject(app, {
        method: 'POST', url: '/api/v1/employees/appeals',
        headers: { cookie: staffCookie },
        payload: {
          employeeId: emp1Id,
          appealDate: '2026-08-02',
          appealType: 'late',
          originalStatus: 'late',
          reason: '地铁延误，有截图为证',
        },
      });
      expect(createRes.statusCode).toBe(200);
      const appeal = JSON.parse(createRes.payload).data;
      expect(appeal.status).toBe('draft');

      const submitRes = await inject(app, {
        method: 'POST', url: `/api/v1/employees/appeals/${appeal.id}/submit`,
        headers: { cookie: staffCookie },
        payload: { workflowCode: 'attendance_appeal' },
      });
      expect(submitRes.statusCode).toBe(200);
      const submitted = JSON.parse(submitRes.payload).data;
      expect(submitted.status).toBe('pending');
      expect(submitted.approvalInstanceId).toBeDefined();
    });

    it('考勤申诉审批通过后状态更新为 approved', async () => {
      const events: any[] = [];
      const handler = (p: any) => events.push(p);
      eventEmitter.on('approval.approved', handler);

      try {
        const createRes = await inject(app, {
          method: 'POST', url: '/api/v1/employees/appeals',
          headers: { cookie: staffCookie },
          payload: {
            employeeId: emp1Id,
            appealDate: '2026-08-03',
            appealType: 'absent',
            originalStatus: 'absent',
            reason: '去医院了，有病历',
          },
        });
        const appeal = JSON.parse(createRes.payload).data;

        const submitRes = await inject(app, {
          method: 'POST', url: `/api/v1/employees/appeals/${appeal.id}/submit`,
          headers: { cookie: staffCookie },
          payload: { workflowCode: 'attendance_appeal' },
        });
        const submitted = JSON.parse(submitRes.payload).data;

        const approveRes1 = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
          headers: { cookie: managerCookie },
          payload: { comment: '情况属实' },
        });
        expect(approveRes1.statusCode).toBe(200);

        const approveRes2 = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
          headers: { cookie: hrCookie },
          payload: { comment: '同意' },
        });
        expect(approveRes2.statusCode).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 100));

        const appealAfter = await prisma.attendanceAppeal.findUnique({ where: { id: appeal.id } });
        expect(appealAfter?.status).toBe('approved');
      } finally {
        eventEmitter.off('approval.approved', handler);
      }
    });

    it('考勤申诉审批驳回后状态更新为 rejected', async () => {
      const events: any[] = [];
      const handler = (p: any) => events.push(p);
      eventEmitter.on('approval.rejected', handler);

      try {
        const createRes = await inject(app, {
          method: 'POST', url: '/api/v1/employees/appeals',
          headers: { cookie: staffCookie },
          payload: {
            employeeId: emp1Id,
            appealDate: '2026-08-04',
            appealType: 'early',
            originalStatus: 'early',
            reason: '家里有事早退',
          },
        });
        const appeal = JSON.parse(createRes.payload).data;

        const submitRes = await inject(app, {
          method: 'POST', url: `/api/v1/employees/appeals/${appeal.id}/submit`,
          headers: { cookie: staffCookie },
          payload: { workflowCode: 'attendance_appeal' },
        });
        const submitted = JSON.parse(submitRes.payload).data;

        const rejectRes = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/reject`,
          headers: { cookie: managerCookie },
          payload: { comment: '没有提前请假' },
        });
        expect(rejectRes.statusCode).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 100));

        const appealAfter = await prisma.attendanceAppeal.findUnique({ where: { id: appeal.id } });
        expect(appealAfter?.status).toBe('rejected');
      } finally {
        eventEmitter.off('approval.rejected', handler);
      }
    });
  });
});
