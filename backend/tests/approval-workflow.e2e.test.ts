// S09 · 审批工作流 e2e（TDD RED 先行）
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

describe('S09 · 审批工作流', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let managerCookie: string;
  let hrCookie: string;
  let staffCookie: string;
  let workflowId: number;

  beforeAll(async () => {
    // 清理
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

    // 权限
    const permUse = await prisma.permission.create({
      data: { code: 'approval:use', name: '审批使用', module: 'approval', type: 'menu' },
    });
    const permManage = await prisma.permission.create({
      data: { code: 'approval:manage', name: '审批配置', module: 'approval', type: 'menu' },
    });

    // 角色
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const deptMgrRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permUse.id },
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: deptMgrRole.id, permissionId: permUse.id },
        { roleId: hrRole.id, permissionId: permUse.id },
        { roleId: staffRole.id, permissionId: permUse.id },
      ],
    });

    // 用户
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager', passwordHash: await bcrypt.hash('123456', 10), name: '张主管' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr', passwordHash: await bcrypt.hash('123456', 10), name: '李HR' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '王员工' },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: manager.id, roleId: deptMgrRole.id },
        { userId: hr.id, roleId: hrRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    // 部门 + 员工
    const dept = await prisma.department.create({ data: { name: '研发部' } });
    await prisma.employee.create({
      data: {
        employeeNo: 'E001',
        name: '王员工',
        departmentId: dept.id,
        userId: staff.id,
        salary: 8000,
        hireDate: new Date('2024-01-01'),
      },
    });

    // 审批流配置：请假审批（主管 → HR）
    const wf = await prisma.approvalWorkflow.create({
      data: {
        code: 'leave_request',
        name: '请假审批',
        module: 'attendance',
        status: 'active',
        nodes: {
          create: [
            { nodeKey: 'n1', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'n2', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
          ],
        },
      },
    });
    workflowId = wf.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin');
    managerCookie = await login(app, 'manager');
    hrCookie = await login(app, 'hr');
    staffCookie = await login(app, 'staff');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('审批流配置', () => {
    it('应该获取审批流列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/workflows',
        headers: { cookie: adminCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('应该创建审批流配置', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/workflows',
        headers: { cookie: adminCookie },
        payload: {
          code: 'reimbursement',
          name: '报销审批',
          module: 'finance',
          nodes: [
            { nodeKey: 'n1', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
            { nodeKey: 'n2', name: '财务审批', type: 'role', roleCode: 'finance', order: 2 },
          ],
        },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
    });
  });

  describe('发起审批', () => {
    it('应该成功发起请假审批', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/instances',
        headers: { cookie: staffCookie },
        payload: {
          workflowCode: 'leave_request',
          title: '请假申请-王员工',
          formData: { days: 1, type: 'annual' },
        },
      });
      const body = JSON.parse(res.body);
      if (res.statusCode !== 200) {
        console.log('状态码:', res.statusCode);
        console.log('响应:', JSON.stringify(body, null, 2));
      }
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('pending');
      expect(body.data.currentNodeName).toBe('部门主管审批');
    });

    it('应该生成待办给主管', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/todos',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('审批处理', () => {
    let instanceId: number;

    beforeAll(async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/instances',
        headers: { cookie: staffCookie },
        payload: {
          workflowCode: 'leave_request',
          title: '审批测试-王员工',
          formData: { days: 2, type: 'sick' },
        },
      });
      instanceId = JSON.parse(res.body).data.id;
    });

    it('主管同意后，应流转到HR节点', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${instanceId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意，请HR复核' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.currentNodeName).toBe('HR审批');
    });

    it('HR应该看到待办', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/todos',
        headers: { cookie: hrCookie },
      });
      const body = JSON.parse(res.body);
      expect(body.data.list.some((t: any) => t.instanceId === instanceId)).toBe(true);
    });

    it('HR同意后，审批完成', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${instanceId}/approve`,
        headers: { cookie: hrCookie },
        payload: { comment: '批准' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approved');
    });
  });

  describe('驳回场景', () => {
    let instanceId: number;

    beforeAll(async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/instances',
        headers: { cookie: staffCookie },
        payload: {
          workflowCode: 'leave_request',
          title: '驳回测试-王员工',
          formData: { days: 10, type: 'annual' },
        },
      });
      instanceId = JSON.parse(res.body).data.id;
    });

    it('主管驳回后，审批结束状态为 rejected', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${instanceId}/reject`,
        headers: { cookie: managerCookie },
        payload: { comment: '请假时间过长，请重新申请' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('rejected');
    });
  });

  describe('我的申请', () => {
    it('应该能看到我发起的审批', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/my-submissions?page=1&pageSize=20',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });
  });
});
