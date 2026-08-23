// S18 · 考勤申诉审批通过 → 修正考勤日报（TDD）
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { ApprovalService } from '../src/approval/approval.service';
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

describe('S18 · 考勤申诉审批 → 自动修正考勤', () => {
  let app: NestFastifyApplication;
  let hrCookie: string;
  let employeeId: number;
  let workflowId: number;

  beforeAll(async () => {
    await prisma.$transaction([
      prisma.attendanceAppeal.deleteMany(),
      prisma.approvalInstance.deleteMany(),
      prisma.approvalWorkflow.deleteMany(),
      prisma.attendanceDaily.deleteMany(),
      prisma.employee.deleteMany(),
      prisma.department.deleteMany(),
      prisma.userRole.deleteMany(),
      prisma.rolePermission.deleteMany(),
      prisma.permission.deleteMany(),
      prisma.role.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    const hrUser = await prisma.user.create({
      data: { username: 'hr_appeal', passwordHash: await bcrypt.hash('123456', 10), realName: 'HR' },
    });
    const emp = await prisma.employee.create({
      data: {
        name: '张三', employeeNo: 'AP001', userId: hrUser.id,
        departmentId: dept.id, hireDate: new Date('2024-01-01'), status: 'active',
      },
    });
    employeeId = emp.id;

    // 配置角色权限
    const role = await prisma.role.create({ data: { name: 'HR', code: 'hr' } });
    const perms = ['attendance:appeal:apply', 'attendance:appeal:manage', 'approval:todo:view'];
    for (const code of perms) {
      const p = await prisma.permission.create({ data: { code, name: code, module: 'attendance' } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
    }
    await prisma.userRole.create({ data: { userId: hrUser.id, roleId: role.id } });

    // 创建考勤日报：迟到状态
    await prisma.attendanceDaily.create({
      data: {
        employeeId: emp.id,
        workDate: new Date('2026-08-10'),
        status: 'late',
        lateMinutes: 15,
        punchCount: 2,
      },
    });

    // 创建审批工作流
    const wf = await prisma.approvalWorkflow.create({
      data: {
        code: 'attendance_appeal', name: '考勤申诉审批', module: 'attendance', status: 'active',
        nodes: {
          create: [
            { nodeKey: 'start', name: '开始', type: 'start', order: 0 },
            { nodeKey: 'approve1', name: '审批', type: 'role', roleCode: 'hr', order: 1 },
            { nodeKey: 'end', name: '结束', type: 'end', order: 2 },
          ],
        },
      },
      include: { nodes: true },
    });
    workflowId = wf.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();

    // 清 Redis 缓存，避免旧 workflow 干扰
    const redis = app.get(RedisService);
    if (redis.isEnabled) {
      await redis.del('approval:workflow:code:attendance_appeal');
    }

    hrCookie = await login(app, 'hr_appeal');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('申诉审批通过后，考勤日报状态自动修正为 normal，迟到清零', async () => {
    // 1. 创建申诉
    const createRes = await inject(app, {
      method: 'POST', url: '/api/v1/employees/appeals',
      headers: { cookie: hrCookie },
      payload: {
        employeeId,
        appealDate: '2026-08-10',
        appealType: 'late',
        originalStatus: 'late',
        reason: '地铁故障导致迟到',
      },
    });
    const appeal = JSON.parse(createRes.payload).data;
    expect(appeal.id).toBeDefined();

    // 2. 提交审批
    const submitRes = await inject(app, {
      method: 'POST', url: `/api/v1/employees/appeals/${appeal.id}/submit`,
      headers: { cookie: hrCookie },
      payload: { workflowCode: 'attendance_appeal' },
    });
    const submitted = JSON.parse(submitRes.payload).data;
    expect(submitted.approvalInstanceId).toBeDefined();

    // 3. 审批通过
    const approveRes = await inject(app, {
      method: 'POST',
      url: `/api/v1/approval/instances/${submitted.approvalInstanceId}/approve`,
      headers: { cookie: hrCookie },
      payload: { comment: '情况属实，予以修正' },
    });
    expect(approveRes.statusCode).toBe(200);

    // 等事件处理
    await new Promise((r) => setTimeout(r, 200));

    // 4. 验证考勤日报已修正
    const daily = await prisma.attendanceDaily.findFirst({
      where: { employeeId, workDate: new Date('2026-08-10') },
    });
    expect(daily).not.toBeNull();
    expect(daily!.status).toBe('normal');
    expect(daily!.lateMinutes).toBe(0);
  });
});
