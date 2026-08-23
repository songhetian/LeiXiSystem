// S17 · 审批撤回 e2e（TDD）
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

describe('S17 · 审批撤回', () => {
  let app: NestFastifyApplication;
  let empCookie: string;
  let otherCookie: string;
  let employeeId: number;

  beforeAll(async () => {
    await prisma.punchMakeup.deleteMany();
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

    const empUser = await prisma.user.create({
      data: { username: 'wd_emp', passwordHash: await bcrypt.hash('123456', 10), realName: '员工甲' },
    });
    const otherUser = await prisma.user.create({
      data: { username: 'wd_other', passwordHash: await bcrypt.hash('123456', 10), realName: '其他员工' },
    });

    const employee = await prisma.employee.create({
      data: {
        name: '员工甲', employeeNo: 'WD001', userId: empUser.id,
        departmentId: dept.id, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    employeeId = employee.id;

    await prisma.approvalWorkflow.create({
      data: {
        code: 'punch_makeup', name: '补卡审批', module: 'attendance', status: 'active',
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
    empCookie = await login(app, 'wd_emp');
    otherCookie = await login(app, 'wd_other');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function createAndSubmitMakeup(cookie: string) {
    const createRes = await inject(app, {
      method: 'POST', url: '/api/v1/attendance/punch/makeup',
      headers: { cookie },
      payload: { punchDate: '2026-08-10', punchType: 'checkin', originalTime: '08:55:00', reason: '地铁延误' },
    });
    const makeup = JSON.parse(createRes.payload).data;
    const submitRes = await inject(app, {
      method: 'POST', url: `/api/v1/attendance/punch/makeup/${makeup.id}/submit`,
      headers: { cookie },
    });
    return JSON.parse(submitRes.payload).data;
  }

  it('申请人可以撤回待审批的申请', async () => {
    const instance = await createAndSubmitMakeup(empCookie);

    const withdrawRes = await inject(app, {
      method: 'POST',
      url: `/api/v1/approval/instances/${instance.approvalInstanceId}/withdraw`,
      headers: { cookie: empCookie },
      payload: { reason: '信息填错了' },
    });
    expect(withdrawRes.statusCode).toBe(200);
    const body = JSON.parse(withdrawRes.payload);
    expect(body.code).toBe(0);
    expect(body.data.status).toBe('cancelled');
  });

  it('非申请人不能撤回', async () => {
    const instance = await createAndSubmitMakeup(empCookie);

    const withdrawRes = await inject(app, {
      method: 'POST',
      url: `/api/v1/approval/instances/${instance.approvalInstanceId}/withdraw`,
      headers: { cookie: otherCookie },
      payload: { reason: '我想撤' },
    });
    expect(withdrawRes.statusCode).toBe(403);
  });

  it('已通过的审批不能撤回', async () => {
    // 先创建一个并标记通过（直接改数据库模拟）
    const instance = await createAndSubmitMakeup(empCookie);
    await prisma.approvalInstance.update({
      where: { id: instance.approvalInstanceId },
      data: { status: 'approved' },
    });

    const withdrawRes = await inject(app, {
      method: 'POST',
      url: `/api/v1/approval/instances/${instance.approvalInstanceId}/withdraw`,
      headers: { cookie: empCookie },
      payload: { reason: '反悔了' },
    });
    expect(withdrawRes.statusCode).toBe(400);
  });
});
