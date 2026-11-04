// S09 · 审批工作流 e2e（TDD RED 先行）
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
    const permTodoView = await prisma.permission.create({
      data: { code: 'approval:todo:view', name: '我的待办查看', module: 'approval', type: 'menu' },
    });
    const permSubmittedView = await prisma.permission.create({
      data: { code: 'approval:submitted:view', name: '我的申请查看', module: 'approval', type: 'menu' },
    });
    const permWorkflowManage = await prisma.permission.create({
      data: { code: 'approval:workflow:manage', name: '审批流程管理', module: 'approval', type: 'menu' },
    });
    // ADR-0019：发起/重提审批走 approval:apply，审批处理走 approval:process
    const permApply = await prisma.permission.create({
      data: { code: 'approval:apply', name: '发起审批', module: 'approval', type: 'api' },
    });
    const permProcess = await prisma.permission.create({
      data: { code: 'approval:process', name: '审批处理', module: 'approval', type: 'api' },
    });

    // 角色
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const deptMgrRole = await prisma.role.create({ data: { code: 'dept_manager', name: '部门主管' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: 'HR' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permTodoView.id },
        { roleId: adminRole.id, permissionId: permSubmittedView.id },
        { roleId: adminRole.id, permissionId: permWorkflowManage.id },
        { roleId: deptMgrRole.id, permissionId: permTodoView.id },
        { roleId: deptMgrRole.id, permissionId: permSubmittedView.id },
        { roleId: deptMgrRole.id, permissionId: permProcess.id },
        { roleId: hrRole.id, permissionId: permTodoView.id },
        { roleId: hrRole.id, permissionId: permSubmittedView.id },
        { roleId: hrRole.id, permissionId: permProcess.id },
        { roleId: staffRole.id, permissionId: permTodoView.id },
        { roleId: staffRole.id, permissionId: permSubmittedView.id },
        { roleId: staffRole.id, permissionId: permApply.id },
      ],
    });

    // 用户（users.status 列默认 pending，登录要求 active，需显式传入）
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员', status: 'active' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager', passwordHash: await bcrypt.hash('123456', 10), realName: '张主管', status: 'active' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr', passwordHash: await bcrypt.hash('123456', 10), realName: '李HR', status: 'active' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工', status: 'active' },
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

  describe('重新提交（resubmit）', () => {
    describe('rejected 状态可以重新提交', () => {
      let instanceId: number;

      beforeAll(async () => {
        const res = await inject(app, {
          method: 'POST',
          url: '/api/v1/approval/instances',
          headers: { cookie: staffCookie },
          payload: {
            workflowCode: 'leave_request',
            title: '驳回重提测试-王员工',
            formData: { days: 5, type: 'annual' },
          },
        });
        instanceId = JSON.parse(res.body).data.id;

        await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/reject`,
          headers: { cookie: managerCookie },
          payload: { comment: '驳回' },
        });
      });

      it('rejected 状态可以重新提交', async () => {
        const res = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/resubmit`,
          headers: { cookie: staffCookie },
          payload: { formData: { days: 3, type: 'annual' } },
        });
        const body = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(body.code).toBe(0);
        expect(body.data.status).toBe('pending');
        expect(body.data.currentNodeName).toBe('部门主管审批');
      });

      it('重新提交后审批节点从第一个开始', async () => {
        const res = await inject(app, {
          method: 'GET',
          url: '/api/v1/approval/todos',
          headers: { cookie: managerCookie },
        });
        const body = JSON.parse(res.body);
        const hasTodo = body.data.list.some((t: any) => t.instanceId === instanceId);
        expect(hasTodo).toBe(true);
      });
    });

    describe('cancelled（撤回）状态可以重新提交', () => {
      let instanceId: number;

      beforeAll(async () => {
        const res = await inject(app, {
          method: 'POST',
          url: '/api/v1/approval/instances',
          headers: { cookie: staffCookie },
          payload: {
            workflowCode: 'leave_request',
            title: '撤回重提测试-王员工',
            formData: { days: 2, type: 'sick' },
          },
        });
        instanceId = JSON.parse(res.body).data.id;

        await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/withdraw`,
          headers: { cookie: staffCookie },
          payload: { reason: '信息有误，撤回修改' },
        });
      });

      it('cancelled 状态可以重新提交', async () => {
        const res = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/resubmit`,
          headers: { cookie: staffCookie },
          payload: { formData: { days: 1, type: 'sick' } },
        });
        const body = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(body.code).toBe(0);
        expect(body.data.status).toBe('pending');
        expect(body.data.currentNodeName).toBe('部门主管审批');
      });

      it('撤回后重新提交，审批节点从第一个开始', async () => {
        const res = await inject(app, {
          method: 'GET',
          url: '/api/v1/approval/todos',
          headers: { cookie: managerCookie },
        });
        const body = JSON.parse(res.body);
        const hasTodo = body.data.list.some((t: any) => t.instanceId === instanceId);
        expect(hasTodo).toBe(true);
      });
    });

    describe('其他状态不能重新提交', () => {
      it('pending 状态不能重新提交', async () => {
        const createRes = await inject(app, {
          method: 'POST',
          url: '/api/v1/approval/instances',
          headers: { cookie: staffCookie },
          payload: {
            workflowCode: 'leave_request',
            title: 'pending重提测试-王员工',
            formData: { days: 1, type: 'annual' },
          },
        });
        const instanceId = JSON.parse(createRes.body).data.id;

        const res = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/resubmit`,
          headers: { cookie: staffCookie },
          payload: {},
        });
        const body = JSON.parse(res.body);
        // 服务层对非 rejected/cancelled 状态抛 BadRequestException（HTTP 400 + 业务错误码）
        expect(res.statusCode).toBe(400);
        expect(body.code).not.toBe(0);
      });

      it('approved 状态不能重新提交', async () => {
        const createRes = await inject(app, {
          method: 'POST',
          url: '/api/v1/approval/instances',
          headers: { cookie: staffCookie },
          payload: {
            workflowCode: 'leave_request',
            title: 'approved重提测试-王员工',
            formData: { days: 1, type: 'annual' },
          },
        });
        const instanceId = JSON.parse(createRes.body).data.id;

        await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/approve`,
          headers: { cookie: managerCookie },
          payload: { comment: '同意' },
        });
        await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/approve`,
          headers: { cookie: hrCookie },
          payload: { comment: '同意' },
        });

        const res = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instanceId}/resubmit`,
          headers: { cookie: staffCookie },
          payload: {},
        });
        const body = JSON.parse(res.body);
        // 服务层对非 rejected/cancelled 状态抛 BadRequestException（HTTP 400 + 业务错误码）
        expect(res.statusCode).toBe(400);
        expect(body.code).not.toBe(0);
      });
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
