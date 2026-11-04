// S15 · 审批事件驱动 e2e（TDD）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/redis/redis.service';
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

describe('S15 · 审批事件驱动', () => {
  let app: NestFastifyApplication;
  let eventEmitter: EventEmitter2;
  let empCookie: string;
  let approverCookie: string;
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

    const approverRole = await prisma.role.create({
      data: { name: '审批员', code: 'approver' },
    });
    const permApprovalTodo = await prisma.permission.create({
      data: { code: 'approval:todo:view', name: '待办审批查看', module: 'approval', type: 'menu' },
    });
    // ADR-0019：审批处理端点（approve/reject）需 approval:process
    const permApprovalProcess = await prisma.permission.create({
      data: { code: 'approval:process', name: '审批处理', module: 'approval', type: 'api' },
    });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: approverRole.id, permissionId: permApprovalTodo.id },
        { roleId: approverRole.id, permissionId: permApprovalProcess.id },
      ],
    });

    const empUser = await prisma.user.create({
      data: { username: 'evt_emp', passwordHash: await bcrypt.hash('123456', 10), realName: '员工甲', status: 'active' },
    });

    const approverUser = await prisma.user.create({
      data: { username: 'evt_approver', passwordHash: await bcrypt.hash('123456', 10), realName: '审批员乙', status: 'active' },
    });
    await prisma.userRole.create({
      data: { userId: approverUser.id, roleId: approverRole.id },
    });

    const employee = await prisma.employee.create({
      data: {
        name: '员工甲', employeeNo: 'EVT001', userId: empUser.id,
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

    eventEmitter = app.get(EventEmitter2);
    empCookie = await login(app, 'evt_emp');
    approverCookie = await login(app, 'evt_approver');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.punchMakeup.deleteMany();
    await prisma.approvalInstance.deleteMany();
  });

  async function createAndSubmitMakeup() {
    // 补卡日期动态取 2 天前：写死日期会随时间推移超出「最近 30 天」补卡窗口而 400
    const punchDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const createRes = await inject(app, {
      method: 'POST', url: '/api/v1/attendance/punch/makeup',
      headers: { cookie: empCookie },
      payload: { punchDate, punchType: 'check_in', originalTime: '08:55:00', reason: '地铁延误' },
    });
    const makeup = JSON.parse(createRes.payload).data;
    const submitRes = await inject(app, {
      method: 'POST', url: `/api/v1/attendance/punch/makeup/${makeup.id}/submit`,
      headers: { cookie: empCookie },
    });
    return JSON.parse(submitRes.payload).data;
  }

  describe('approval.approved 事件', () => {
    it('审批全通过后发布 approval.approved 事件，包含 instanceId 和 workflowCode', async () => {
      const events: any[] = [];
      const handler = (payload: any) => events.push(payload);
      eventEmitter.on('approval.approved', handler);

      try {
        const instance = await createAndSubmitMakeup();

        const approveRes = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instance.approvalInstanceId}/approve`,
          headers: { cookie: approverCookie },
          payload: { comment: '同意' },
        });
        expect(approveRes.statusCode).toBe(200);

        expect(events.length).toBeGreaterThanOrEqual(1);
        const evt = events[events.length - 1];
        expect(evt.instanceId).toBe(instance.approvalInstanceId);
        expect(evt.workflowCode).toBe('punch_makeup');
        expect(evt.status).toBe('approved');
      } finally {
        eventEmitter.off('approval.approved', handler);
      }
    });
  });

  describe('approval.rejected 事件', () => {
    it('审批拒绝后发布 approval.rejected 事件', async () => {
      const events: any[] = [];
      const handler = (payload: any) => events.push(payload);
      eventEmitter.on('approval.rejected', handler);

      try {
        const instance = await createAndSubmitMakeup();

        const rejectRes = await inject(app, {
          method: 'POST',
          url: `/api/v1/approval/instances/${instance.approvalInstanceId}/reject`,
          headers: { cookie: approverCookie },
          payload: { comment: '不同意' },
        });
        expect(rejectRes.statusCode).toBe(200);

        expect(events.length).toBeGreaterThanOrEqual(1);
        const evt = events[events.length - 1];
        expect(evt.instanceId).toBe(instance.approvalInstanceId);
        expect(evt.workflowCode).toBe('punch_makeup');
        expect(evt.status).toBe('rejected');
      } finally {
        eventEmitter.off('approval.rejected', handler);
      }
    });
  });
});
