// S16 · 离职审批自动更新员工状态 e2e（TDD）
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
    method: 'POST', url: '/api/v1/auth/login', payload: { username, password },
  });
  const sc = res.headers['set-cookie'] as string | string[];
  return (Array.isArray(sc) ? sc[0] : sc).split(';')[0];
}

describe('S16 · 离职审批 → 自动更新员工状态', () => {
  let app: NestFastifyApplication;
  let empCookie: string;
  let approverCookie: string;
  let employeeId: number;

  beforeAll(async () => {
    await prisma.resignation.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();

    const dept = await prisma.department.create({ data: { name: '研发部' } });

    const approverRole = await prisma.role.create({ data: { name: '审批员', code: 'approver' } });
    const permApprovalTodo = await prisma.permission.create({
      data: { code: 'approval:todo:view', name: '待办审批查看', module: 'approval', type: 'menu' },
    });
    const permResignationApply = await prisma.permission.create({
      data: { code: 'resignation:apply', name: '离职申请', module: 'employee', type: 'menu' },
    });
    await prisma.rolePermission.create({ data: { roleId: approverRole.id, permissionId: permApprovalTodo.id } });

    const staffRole = await prisma.role.create({ data: { name: '员工', code: 'staff' } });
    await prisma.rolePermission.create({ data: { roleId: staffRole.id, permissionId: permResignationApply.id } });

    const empUser = await prisma.user.create({
      data: { username: 'res_emp', passwordHash: await bcrypt.hash('123456', 10), realName: '离职员工' },
    });
    await prisma.userRole.create({ data: { userId: empUser.id, roleId: staffRole.id } });
    const approverUser = await prisma.user.create({
      data: { username: 'res_approver', passwordHash: await bcrypt.hash('123456', 10), realName: '审批员' },
    });
    await prisma.userRole.create({ data: { userId: approverUser.id, roleId: approverRole.id } });

    const employee = await prisma.employee.create({
      data: {
        name: '离职员工', employeeNo: 'RES001', userId: empUser.id,
        departmentId: dept.id, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    employeeId = employee.id;

    await prisma.approvalWorkflow.create({
      data: {
        code: 'resignation', name: '离职审批', module: 'employee', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'start', name: '开始', type: 'start', order: 0 },
            { nodeKey: 'approve1', name: '审批', type: 'role', roleCode: 'approver', order: 1 },
            { nodeKey: 'end', name: '结束', type: 'end', order: 2 },
          ],
        },
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    empCookie = await login(app, 'res_emp');
    approverCookie = await login(app, 'res_approver');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('离职审批通过后，员工状态自动变为 resigned，离职日期同步', async () => {
    // 1. 创建离职申请
    const createRes = await inject(app, {
      method: 'POST', url: '/api/v1/employees/resignations',
      headers: { cookie: empCookie },
      payload: { employeeId, reason: '个人发展', resignDate: '2025-12-31' },
    });
    expect(createRes.statusCode).toBe(200);
    const resignation = JSON.parse(createRes.payload).data;
    expect(resignation.status).toBe('draft');

    // 2. 提交审批
    const submitRes = await inject(app, {
      method: 'POST', url: `/api/v1/employees/resignations/${resignation.id}/submit`,
      headers: { cookie: empCookie },
      payload: { workflowCode: 'resignation' },
    });
    expect(submitRes.statusCode).toBe(200);
    const submitted = JSON.parse(submitRes.payload).data;
    expect(submitted.status).toBe('pending');
    expect(submitted.approvalInstanceId).toBeDefined();

    // 3. 审批通过
    const approveRes = await inject(app, {
      method: 'POST',
      url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
      headers: { cookie: approverCookie },
      payload: { comment: '同意离职' },
    });
    expect(approveRes.statusCode).toBe(200);

    // 等待事件处理完成
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. 验证员工状态自动更新
    const updatedEmp = await prisma.employee.findUnique({ where: { id: employeeId } });
    expect(updatedEmp?.status).toBe('resigned');
    expect(updatedEmp?.resignDate).toBeDefined();

    // 5. 验证离职申请状态
    const updatedResignation = await prisma.resignation.findUnique({ where: { id: resignation.id } });
    expect(updatedResignation?.status).toBe('approved');
  });
});
