// T24 · 权限点落库 + 角色隔离 e2e
// 背景：修复"代码里 @RequirePermission 引用的权限点在 DB 中不存在"问题。
// 验收：seedPermissions 幂等落库后，admin 全权限、staff 仅 3 个查看权限，
//       staff 访问薪资接口被隔离（403），薪资域权限点已从 attendance:* 独立（C8）。
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { seedPermissions, PERMISSIONS, STAFF_PERMISSIONS } from '../prisma/seed';

const prisma = new PrismaClient();
const inject = (app: NestFastifyApplication, opts: any) =>
  app.getHttpAdapter().getInstance().inject(opts);

async function login(app: NestFastifyApplication, username: string) {
  const res = await inject(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password: '123456' },
  });
  const sc = res.headers['set-cookie'] as string | string[];
  return (Array.isArray(sc) ? sc[0] : sc).split(';')[0];
}

describe('T24 · 权限点落库 + 角色隔离', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    // 幂等自愈：先落库权限点与角色绑定（真库当前可能只有 2 个权限点）
    await seedPermissions(prisma);
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('RED→GREEN: permissions 表包含全部权限点（数量与 code 一致）', async () => {
    const rows = await prisma.permission.findMany();
    const codes = rows.map((r) => r.code);
    expect(rows.length).toBe(PERMISSIONS.length);
    for (const p of PERMISSIONS) expect(codes).toContain(p.code);
  });

  it('RED→GREEN: admin 登录返回全部权限点', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const perms: string[] = JSON.parse(res.payload).data.user.permissions;
    for (const p of PERMISSIONS) expect(perms).toContain(p.code);
  });

  it('RED→GREEN: staff 仅拥有 员工/考勤/知识库 查看权限，且无薪资/报表/审批', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(200);
    const perms: string[] = JSON.parse(res.payload).data.user.permissions;
    for (const p of STAFF_PERMISSIONS) expect(perms).toContain(p);
    expect(perms).not.toContain('payroll:view');
    expect(perms).not.toContain('payroll:manage');
    expect(perms).not.toContain('reports:view');
    expect(perms).not.toContain('approval:use');
    expect(perms).not.toContain('system:setting:update');
  });

  it('RED→GREEN: staff 访问薪资接口被隔离（403，C8 权限独立生效）', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/payroll/runs',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('RED→GREEN: staff 可访问员工列表（employee:list 生效）', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it('RED→GREEN: admin 可访问报表（reports:view 生效）', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/reports/attendance-monthly?month=2026-07',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
  });
});
