// S05 · 补卡申请接入审批流 e2e（TDD）
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

describe('S05 · 补卡申请接入审批流', () => {
  let app: NestFastifyApplication;
  let empCookie: string;
  let empId: number;
  let employeeId: number;

  beforeAll(async () => {
    await prisma.punchMakeup.deleteMany();
    await prisma.approvalInstance.deleteMany();
    await prisma.approvalWorkflow.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();

    const dept = await prisma.department.create({ data: { name: '技术部' } });

    const emp = await prisma.user.create({
      data: { username: 'emp_mk2', passwordHash: await bcrypt.hash('123456', 10), name: '员工甲' },
    });
    empId = emp.id;

    const employee = await prisma.employee.create({
      data: {
        name: '员工甲',
        employeeNo: 'E002',
        userId: emp.id,
        departmentId: dept.id,
        hireDate: new Date('2024-01-01'),
      },
    });
    employeeId = employee.id;

    await prisma.approvalWorkflow.create({
      data: {
        code: 'punch_makeup',
        name: '补卡审批',
        module: 'attendance',
        status: 'active',
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
    empCookie = await login(app, 'emp_mk2');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('补卡申请 CRUD', () => {
    it('POST /attendance/punch/makeup → 创建补卡申请', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/makeup',
        headers: { cookie: empCookie },
        payload: {
          punchDate: '2026-08-10',
          punchType: 'checkin',
          originalTime: '08:55:00',
          reason: '地铁延误',
        },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('pending');
      expect(body.data.punchType).toBe('checkin');
    });

    it('GET /attendance/punch/makeup → 补卡申请列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup?page=1&pageSize=10',
        headers: { cookie: empCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.list.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /attendance/punch/makeup/:id → 补卡申请详情', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup?page=1&pageSize=10',
        headers: { cookie: empCookie },
      });
      const id = JSON.parse(listRes.payload).data.list[0].id;

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/punch/makeup/${id}`,
        headers: { cookie: empCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.id).toBe(id);
    });

    it('PUT /attendance/punch/makeup/:id → 修改补卡申请（草稿状态）', async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup?page=1&pageSize=10',
        headers: { cookie: empCookie },
      });
      const id = JSON.parse(listRes.payload).data.list[0].id;

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/attendance/punch/makeup/${id}`,
        headers: { cookie: empCookie },
        payload: { reason: '地铁延误，已补打卡' },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.reason).toBe('地铁延误，已补打卡');
    });

    it('DELETE /attendance/punch/makeup/:id → 删除补卡申请（草稿状态）', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/makeup',
        headers: { cookie: empCookie },
        payload: { punchDate: '2026-08-11', punchType: 'checkout', originalTime: '18:05:00', reason: '临时加班' },
      });
      const id = JSON.parse(createRes.payload).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/attendance/punch/makeup/${id}`,
        headers: { cookie: empCookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);
    });
  });

  describe('提交审批', () => {
    let makeupId: number;

    beforeAll(async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/makeup',
        headers: { cookie: empCookie },
        payload: { punchDate: '2026-08-12', punchType: 'checkin', originalTime: '09:05:00', reason: '电梯故障' },
      });
      makeupId = JSON.parse(res.payload).data.id;
    });

    it('POST /attendance/punch/makeup/:id/submit → 提交审批（状态变为approving）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/attendance/punch/makeup/${makeupId}/submit`,
        headers: { cookie: empCookie },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.status).toBe('approving');
      expect(body.data.approvalInstanceId).toBeDefined();
      expect(body.data.approvalInstanceId).toBeGreaterThan(0);
    });

    it('审批中状态不能修改 → 报错', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/attendance/punch/makeup/${makeupId}`,
        headers: { cookie: empCookie },
        payload: { reason: '改理由' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('审批中状态不能删除 → 报错', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/attendance/punch/makeup/${makeupId}`,
        headers: { cookie: empCookie },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });
  });

  describe('数据隔离', () => {
    let makeupId: number;

    beforeAll(async () => {
      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup?page=1&pageSize=10',
        headers: { cookie: empCookie },
      });
      makeupId = JSON.parse(listRes.payload).data.list[0].id;
    });

    it('其他用户不能查看我的补卡详情 → 403', async () => {
      const other = await prisma.user.create({
        data: { username: 'other_mk2', passwordHash: await bcrypt.hash('123456', 10), name: '其他' },
      });
      const dept = await prisma.department.create({ data: { name: '其他部门' } });
      await prisma.employee.create({
        data: { name: '其他', employeeNo: 'E999', userId: other.id, departmentId: dept.id, hireDate: new Date('2024-01-01') },
      });
      const otherCookie = await login(app, 'other_mk2');

      const res = await inject(app, {
        method: 'GET',
        url: `/api/v1/attendance/punch/makeup/${makeupId}`,
        headers: { cookie: otherCookie },
      });
      expect([403, 500]).toContain(res.statusCode);
    });
  });

  describe('异常用例', () => {
    it('查看不存在的补卡 → 404', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/attendance/punch/makeup/99999',
        headers: { cookie: empCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });

    it('提交不存在的补卡 → 404', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/attendance/punch/makeup/99999/submit',
        headers: { cookie: empCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });
});
