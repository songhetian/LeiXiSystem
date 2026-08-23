// S13 · 报销 e2e（TDD RED 先行）
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

describe('S13 · 报销', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let managerCookie: string;
  let hrCookie: string;
  let typeId: number;
  let reimbursementId: number;

  beforeAll(async () => {
    await prisma.reimbursementItem.deleteMany();
    await prisma.reimbursement.deleteMany();
    await prisma.reimbursementType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();

    const permReim = await prisma.permission.create({
      data: { code: 'reimbursement:view', name: '报销使用', module: 'reimbursement', type: 'menu' },
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
        { roleId: staffRole.id, permissionId: permReim.id },
        { roleId: staffRole.id, permissionId: permApprovalTodoView.id },
        { roleId: staffRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: managerRole.id, permissionId: permReim.id },
        { roleId: managerRole.id, permissionId: permApprovalTodoView.id },
        { roleId: managerRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: hrRole.id, permissionId: permReim.id },
        { roleId: hrRole.id, permissionId: permApprovalTodoView.id },
        { roleId: hrRole.id, permissionId: permApprovalSubmittedView.id },
        { roleId: adminRole.id, permissionId: permReim.id },
        { roleId: adminRole.id, permissionId: permApprovalWorkflowManage.id },
        { roleId: adminRole.id, permissionId: permApprovalTodoView.id },
        { roleId: adminRole.id, permissionId: permApprovalSubmittedView.id },
      ],
    });

    const staff = await prisma.user.create({
      data: { username: 'staff_reim', passwordHash: await bcrypt.hash('123456', 10), realName: '王员工' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager_reim', passwordHash: await bcrypt.hash('123456', 10), realName: '李主管' },
    });
    const hr = await prisma.user.create({
      data: { username: 'hr_reim', passwordHash: await bcrypt.hash('123456', 10), realName: '张HR' },
    });
    const admin = await prisma.user.create({
      data: { username: 'admin_reim', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: staff.id, roleId: staffRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: hr.id, roleId: hrRole.id },
        { userId: admin.id, roleId: adminRole.id },
      ],
    });

    await prisma.reimbursementType.create({
      data: { code: 'travel', name: '差旅费', description: '出差相关费用' },
    });
    await prisma.reimbursementType.create({
      data: { code: 'meal', name: '餐饮费', description: '工作餐费' },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    staffCookie = await login(app, 'staff_reim');
    managerCookie = await login(app, 'manager_reim');
    hrCookie = await login(app, 'hr_reim');
    adminCookie = await login(app, 'admin_reim');

    const wfRes = await inject(app, {
      method: 'POST',
      url: '/api/v1/approval/workflows',
      headers: { cookie: adminCookie },
      payload: {
        code: 'reimbursement',
        name: '报销审批',
        module: 'reimbursement',
        status: 'active',
        nodes: [
          { nodeKey: 'n1', name: '部门主管审批', type: 'role', roleCode: 'dept_manager', order: 1 },
          { nodeKey: 'n2', name: 'HR审批', type: 'role', roleCode: 'hr', order: 2 },
        ],
      },
    });
    const wfBody = JSON.parse(wfRes.payload);
    expect(wfBody.code).toBe(0);
  });

  afterAll(async () => {
    await prisma.reimbursementItem.deleteMany();
    await prisma.reimbursement.deleteMany();
    await prisma.reimbursementType.deleteMany();
    await prisma.approvalRecord.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflowNode.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await app.close();
  });

  describe('报销类型', () => {
    it('应该获取报销类型列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reimbursements/types',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('报销申请', () => {
    it('应该成功创建报销申请（含明细）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reimbursements',
        headers: { cookie: staffCookie },
        payload: {
          typeCode: 'travel',
          title: '北京出差报销',
          description: '2026年8月北京出差费用',
          totalAmount: 1500,
          items: [
            { name: '交通费', amount: 800, description: '高铁票' },
            { name: '住宿费', amount: 500, description: '酒店2晚' },
            { name: '餐饮费', amount: 200, description: '工作餐' },
          ],
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.title).toBe('北京出差报销');
      expect(Number(body.data.totalAmount)).toBe(1500);
      expect(body.data.status).toBe('pending');
      expect(body.data.items.length).toBe(3);
      expect(body.data.id).toBeDefined();
      reimbursementId = body.data.id;
    });

    it('金额校验失败：明细合计与总金额不一致', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reimbursements',
        headers: { cookie: staffCookie },
        payload: {
          typeCode: 'meal',
          title: '餐饮报销',
          totalAmount: 500,
          items: [
            { name: '午餐', amount: 100, description: '' },
            { name: '晚餐', amount: 100, description: '' },
          ],
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(400);
      expect(body.code).toBe(7001);
    });

    it('应该能看到我的报销列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reimbursements/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('应该能查看报销详情', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${reimbursementId}`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.id).toBe(reimbursementId);
      expect(body.data.items.length).toBe(3);
    });

    it('发起审批后，状态变为审批中', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/reimbursements/${reimbursementId}/submit`,
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approving');
      expect(body.data.approvalInstanceId).toBeDefined();
    });
  });

  describe('审批联动', () => {
    it('主管应该看到待审批报销', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/reimbursements/pending',
        headers: { cookie: managerCookie },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('主管同意后，流转到HR审批', async () => {
      const detailRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${reimbursementId}`,
        headers: { cookie: managerCookie },
      });
      const detail = JSON.parse(detailRes.payload);
      const approvalId = detail.data.approvalInstanceId;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${approvalId}/approve`,
        headers: { cookie: managerCookie },
        payload: { comment: '同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);

      const reimRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${reimbursementId}`,
        headers: { cookie: staffCookie },
      });
      const reimBody = JSON.parse(reimRes.payload);
      expect(reimBody.data.status).toBe('approving');
    });

    it('HR同意后，报销完成', async () => {
      const detailRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${reimbursementId}`,
        headers: { cookie: hrCookie },
      });
      const detail = JSON.parse(detailRes.payload);
      const approvalId = detail.data.approvalInstanceId;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${approvalId}/approve`,
        headers: { cookie: hrCookie },
        payload: { comment: '同意' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);

      const reimRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${reimbursementId}`,
        headers: { cookie: staffCookie },
      });
      const reimBody = JSON.parse(reimRes.payload);
      expect(reimBody.data.status).toBe('approved');
    });
  });

  describe('驳回场景', () => {
    let rejectedId: number;

    it('创建新报销并发起审批', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/reimbursements',
        headers: { cookie: staffCookie },
        payload: {
          typeCode: 'meal',
          title: '餐饮报销-驳回测试',
          totalAmount: 200,
          items: [{ name: '聚餐', amount: 200, description: '部门聚餐' }],
        },
      });
      const body = JSON.parse(res.payload);
      rejectedId = body.data.id;

      const submitRes = await inject(app, {
        method: 'POST',
        url: `/api/v1/reimbursements/${rejectedId}/submit`,
        headers: { cookie: staffCookie },
      });
      const submitBody = JSON.parse(submitRes.payload);
      expect(submitBody.data.status).toBe('approving');
    });

    it('主管驳回后，报销状态为 rejected', async () => {
      const detailRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${rejectedId}`,
        headers: { cookie: managerCookie },
      });
      const detail = JSON.parse(detailRes.payload);
      const approvalId = detail.data.approvalInstanceId;

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/approval/instances/${approvalId}/reject`,
        headers: { cookie: managerCookie },
        payload: { comment: '发票不齐全' },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);

      const reimRes = await inject(app, {
        method: 'GET',
        url: `/api/v1/reimbursements/${rejectedId}`,
        headers: { cookie: staffCookie },
      });
      const reimBody = JSON.parse(reimRes.payload);
      expect(reimBody.data.status).toBe('rejected');
    });
  });
});
