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

describe('L1-1 · 审批流程（完整链路）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let hrCookie: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    // 清理测试数据
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();

    // 创建权限
    const p1 = await prisma.permission.create({ data: { code: 'approval:todo:view', name: '待办查看', module: 'approval', type: 'menu' } });
    const p2 = await prisma.permission.create({ data: { code: 'approval:submitted:view', name: '申请查看', module: 'approval', type: 'menu' } });
    const p3 = await prisma.permission.create({ data: { code: 'approval:workflow:manage', name: '流程管理', module: 'approval', type: 'api' } });

    // 创建角色
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: '人事专员' } });

    // 分配权限
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: p1.id },
        { roleId: adminRole.id, permissionId: p2.id },
        { roleId: adminRole.id, permissionId: p3.id },
        { roleId: hrRole.id, permissionId: p1.id },
        { roleId: staffRole.id, permissionId: p2.id },
      ],
    });

    const hash = await bcrypt.hash('123456', 10);

    const dept1 = await prisma.department.create({ data: { name: '技术部' } });

    const adminUser = await prisma.user.create({
      data: { username: 'admin', passwordHash: hash, realName: '管理员', status: 'active' },
    });
    const staffUser = await prisma.user.create({
      data: { username: 'staff', passwordHash: hash, realName: '王小明', status: 'active', departmentId: dept1.id },
    });
    const hrUser = await prisma.user.create({
      data: { username: 'hr', passwordHash: hash, realName: '李人事', status: 'active', departmentId: dept1.id },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: adminUser.id, roleId: adminRole.id },
        { userId: staffUser.id, roleId: staffRole.id },
        { userId: hrUser.id, roleId: hrRole.id },
      ],
    });

    await prisma.employee.create({
      data: { employeeNo: 'E001', name: '王小明', departmentId: dept1.id, hireDate: new Date('2023-01-15'), userId: staffUser.id },
    });
    await prisma.employee.create({
      data: { employeeNo: 'E002', name: '李人事', departmentId: dept1.id, hireDate: new Date('2023-03-20'), userId: hrUser.id },
    });

    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
    hrCookie = await login(app, 'hr');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('审批流管理', () => {
    it('admin 可以创建审批流', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/workflows',
        headers: { cookie: adminCookie },
        payload: {
          code: 'leave_flow',
          name: '请假审批流',
          module: 'leave',
          status: 'active',
          nodes: [
            { nodeKey: 'node_hr', name: '人事审批', type: 'role', roleCode: 'hr', order: 1 },
            { nodeKey: 'node_admin', name: '管理员审批', type: 'role', roleCode: 'admin', order: 2 },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('请假审批流');
      expect(body.data.nodes).toHaveLength(2);
    });

    it('staff 不能创建审批流（403）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/workflows',
        headers: { cookie: staffCookie },
        payload: {
          code: 'test_flow',
          name: '测试流程',
          module: 'general',
          nodes: [],
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('员工可以获取可用审批流列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/workflows/available',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].status).toBe('active');
    });
  });

  describe('发起审批申请', () => {
    it('员工可以发起审批申请', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/approval/instances',
        headers: { cookie: staffCookie },
        payload: {
          workflowCode: 'leave_flow',
          title: '事假申请-测试',
          formData: { 请假类型: '事假', 天数: '3' },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.title).toBe('事假申请-测试');
      expect(body.data.status).toBe('pending');
    });

    it('我的申请列表包含刚提交的申请', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/my-submissions',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeGreaterThan(0);
      expect(body.data.list[0].title).toBe('事假申请-测试');
    });
  });

  describe('待办审批', () => {
    it('人事专员有待办事项', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/todos',
        headers: { cookie: hrCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeGreaterThan(0);
      expect(body.data.list[0].title).toBe('事假申请-测试');
    });

    it('人事专员可以同意审批', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/todos',
        headers: { cookie: hrCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const instanceId = listBody.data.list[0].instanceId;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${instanceId}/approve`,
        headers: { cookie: hrCookie },
        payload: { comment: '同意，人事已审批' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
    });

    it('审批后管理员有待办（进入下一节点）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/todos',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeGreaterThan(0);
    });
  });

  describe('审批详情', () => {
    it('可以查看审批详情和审批记录', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/my-submissions',
        headers: { cookie: staffCookie },
      });
      const listBody = JSON.parse(listRes.body);
      const instanceId = listBody.data.list[0].id;

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/approval/instances/${instanceId}`,
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.title).toBe('事假申请-测试');
      expect(Array.isArray(body.data.records)).toBe(true);
      expect(body.data.records.length).toBe(2);
      expect(body.data.records[0].status).toBe('approved');
      expect(body.data.records[0].approverName).toBe('李人事');
    });
  });

  describe('已办列表', () => {
    it('人事专员的已办列表包含刚审批的记录', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/approval/my-approved',
        headers: { cookie: hrCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.total).toBeGreaterThan(0);
      expect(body.data.list[0].action).toBe('approved');
      expect(body.data.list[0].applicantName).toBe('王小明');
    });
  });
});
