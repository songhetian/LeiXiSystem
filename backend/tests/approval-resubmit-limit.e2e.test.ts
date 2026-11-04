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
    method: 'POST', url: '/api/v1/auth/login', payload: { username, password },
  });
  const sc = res.headers['set-cookie'] as string | string[];
  return (Array.isArray(sc) ? sc[0] : sc).split(';')[0];
}

describe('审批重新提交次数限制', () => {
  let app: NestFastifyApplication;
  let empCookie: string;
  let approverCookie: string;

  beforeAll(async () => {
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
      data: { username: 'rs_emp', passwordHash: await bcrypt.hash('123456', 10), realName: '员工甲', status: 'active' },
    });
    const approverUser = await prisma.user.create({
      data: { username: 'rs_approver', passwordHash: await bcrypt.hash('123456', 10), realName: '审批人', status: 'active' },
    });

    const approverRole = await prisma.role.create({
      data: { code: 'approver', name: '审批员' },
    });
    const empRole = await prisma.role.create({
      data: { code: 'staff', name: '普通员工' },
    });
    // ADR-0019：发起/重提审批需 approval:apply，驳回处理需 approval:process
    const permApply = await prisma.permission.create({
      data: { code: 'approval:apply', name: '发起审批', module: 'approval', type: 'api' },
    });
    const permProcess = await prisma.permission.create({
      data: { code: 'approval:process', name: '审批处理', module: 'approval', type: 'api' },
    });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: approverRole.id, permissionId: permProcess.id },
        { roleId: empRole.id, permissionId: permApply.id },
      ],
    });
    await prisma.userRole.createMany({
      data: [
        { userId: approverUser.id, roleId: approverRole.id },
        { userId: empUser.id, roleId: empRole.id },
      ],
    });

    await prisma.employee.create({
      data: {
        name: '员工甲', employeeNo: 'RS001', userId: empUser.id,
        departmentId: dept.id, hireDate: new Date('2024-01-01'), status: 'active',
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

    empCookie = await login(app, 'rs_emp');
    approverCookie = await login(app, 'rs_approver');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function createWorkflow(maxResubmits?: number) {
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        code: `test_resubmit_${Date.now()}`, name: '测试审批流', module: 'test', status: 'active',
        maxResubmits: maxResubmits ?? 3,
        nodes: {
          create: [
            { nodeKey: 'start', name: '开始', type: 'start', order: 0 },
            { nodeKey: 'approve1', name: '审批', type: 'role', roleCode: 'approver', order: 1 },
            { nodeKey: 'end', name: '结束', type: 'end', order: 2 },
          ],
        },
      },
    });
    return workflow;
  }

  async function startInstance(cookie: string, workflowCode: string) {
    const res = await inject(app, {
      method: 'POST', url: '/api/v1/approval/instances',
      headers: { cookie },
      payload: { workflowCode, title: '测试申请', formData: { reason: '测试' } },
    });
    return JSON.parse(res.payload).data;
  }

  async function rejectInstance(cookie: string, instanceId: number) {
    const res = await inject(app, {
      method: 'POST', url: `/api/v1/approval/instances/${instanceId}/reject`,
      headers: { cookie },
      payload: { comment: '驳回测试' },
    });
    return JSON.parse(res.payload);
  }

  async function resubmitInstance(cookie: string, instanceId: number, formData?: any) {
    const res = await inject(app, {
      method: 'POST', url: `/api/v1/approval/instances/${instanceId}/resubmit`,
      headers: { cookie },
      payload: { formData: formData || { reason: '重新提交' } },
    });
    return { statusCode: res.statusCode, body: JSON.parse(res.payload) };
  }

  it('在次数限制内可以重新提交', async () => {
    const workflow = await createWorkflow(3);
    const instance = await startInstance(empCookie, workflow.code);

    await rejectInstance(approverCookie, instance.id);

    const result = await resubmitInstance(empCookie, instance.id);
    expect(result.statusCode).toBe(200);
    expect(result.body.code).toBe(0);
    expect(result.body.data.status).toBe('pending');
  });

  it('resubmitCount 正确累加', async () => {
    const workflow = await createWorkflow(5);
    const instance = await startInstance(empCookie, workflow.code);

    await rejectInstance(approverCookie, instance.id);
    await resubmitInstance(empCookie, instance.id);

    const instanceAfter1 = await prisma.approvalInstance.findUnique({ where: { id: instance.id } });
    expect(instanceAfter1?.resubmitCount).toBe(1);

    await rejectInstance(approverCookie, instance.id);
    await resubmitInstance(empCookie, instance.id);

    const instanceAfter2 = await prisma.approvalInstance.findUnique({ where: { id: instance.id } });
    expect(instanceAfter2?.resubmitCount).toBe(2);
  });

  it('超过次数限制不能重新提交', async () => {
    const workflow = await createWorkflow(2);
    const instance = await startInstance(empCookie, workflow.code);

    await rejectInstance(approverCookie, instance.id);
    await resubmitInstance(empCookie, instance.id);

    await rejectInstance(approverCookie, instance.id);
    await resubmitInstance(empCookie, instance.id);

    await rejectInstance(approverCookie, instance.id);
    const result = await resubmitInstance(empCookie, instance.id);

    expect(result.statusCode).toBe(400);
    // ERROR_CODES.APPROVAL_RESUBMIT_LIMIT = 6305（重新提交次数已达上限）
    expect(result.body.code).toBe(6305);
  });

  it('不同工作流可有不同的 maxResubmits', async () => {
    const workflow2 = await createWorkflow(2);
    const workflow5 = await createWorkflow(5);

    const instance2 = await startInstance(empCookie, workflow2.code);
    const instance5 = await startInstance(empCookie, workflow5.code);

    await rejectInstance(approverCookie, instance2.id);
    await resubmitInstance(empCookie, instance2.id);
    await rejectInstance(approverCookie, instance2.id);
    await resubmitInstance(empCookie, instance2.id);
    await rejectInstance(approverCookie, instance2.id);
    const result2 = await resubmitInstance(empCookie, instance2.id);
    expect(result2.statusCode).toBe(400);

    for (let i = 0; i < 5; i++) {
      await rejectInstance(approverCookie, instance5.id);
      const res = await resubmitInstance(empCookie, instance5.id);
      if (i < 4) {
        expect(res.statusCode).toBe(200);
      }
    }
    await rejectInstance(approverCookie, instance5.id);
    const result5 = await resubmitInstance(empCookie, instance5.id);
    expect(result5.statusCode).toBe(400);
  });

  it('默认 maxResubmits 为 3', async () => {
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        code: `test_default_${Date.now()}`, name: '默认次数测试', module: 'test', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'start', name: '开始', type: 'start', order: 0 },
            { nodeKey: 'approve1', name: '审批', type: 'role', roleCode: 'approver', order: 1 },
            { nodeKey: 'end', name: '结束', type: 'end', order: 2 },
          ],
        },
      },
    });

    const fetched = await prisma.approvalWorkflow.findUnique({ where: { id: workflow.id } });
    expect(fetched?.maxResubmits).toBe(3);
  });
});
