// L0 · 基础底座 e2e 测试：认证 + 细粒度权限 + 角色管理 + 数据隔离
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

describe('L0 · 基础底座（认证 + 细粒度权限 + 角色管理 + 数据隔离）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let roleId: number;

  beforeAll(async () => {
    // 清表
    await prisma.operationLog.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();

    // 创建权限点（操作级）
    const perms = await Promise.all([
      prisma.permission.create({ data: { code: 'system:user:view', name: '用户查看', module: 'system', type: 'api' } }),
      prisma.permission.create({ data: { code: 'system:user:manage', name: '用户管理', module: 'system', type: 'api' } }),
      prisma.permission.create({ data: { code: 'system:role:view', name: '角色查看', module: 'system', type: 'menu' } }),
      prisma.permission.create({ data: { code: 'system:role:manage', name: '角色管理', module: 'system', type: 'api' } }),
      prisma.permission.create({ data: { code: 'employee:view', name: '员工查看', module: 'employee', type: 'menu' } }),
      prisma.permission.create({ data: { code: 'employee:create', name: '员工新增', module: 'employee', type: 'api' } }),
      prisma.permission.create({ data: { code: 'personal:leave:apply', name: '我的请假申请', module: 'personal', type: 'api' } }),
    ]);
    const permMap: Record<string, number> = {};
    perms.forEach((p) => (permMap[p.code] = p.id));

    // 角色：admin（全部权限）、staff（仅查看+个人申请）、hr（人事管理）
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    const hrRole = await prisma.role.create({ data: { code: 'hr', name: '人事专员' } });

    await prisma.rolePermission.createMany({
      data: [
        // admin: 全部
        ...perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
        // staff: 员工查看 + 个人申请
        { roleId: staffRole.id, permissionId: permMap['employee:view'] },
        { roleId: staffRole.id, permissionId: permMap['personal:leave:apply'] },
        // hr: 用户查看 + 员工查看 + 员工新增 + 角色查看
        { roleId: hrRole.id, permissionId: permMap['system:user:view'] },
        { roleId: hrRole.id, permissionId: permMap['employee:view'] },
        { roleId: hrRole.id, permissionId: permMap['employee:create'] },
        { roleId: hrRole.id, permissionId: permMap['system:role:view'] },
      ],
    });

    // 部门
    const dep1 = await prisma.department.create({ data: { name: '技术部' } });
    const dep2 = await prisma.department.create({ data: { name: '客服部' } });

    // 用户
    const hash = await bcrypt.hash('123456', 10);
    const adminUser = await prisma.user.create({
      data: { username: 'admin', passwordHash: hash, realName: '系统管理员', status: 'active' },
    });
    const staffUser = await prisma.user.create({
      data: { username: 'staff', passwordHash: hash, realName: '王小明', status: 'active', departmentId: dep1.id },
    });
    const hrUser = await prisma.user.create({
      data: { username: 'hr', passwordHash: hash, realName: '李人事', status: 'active', departmentId: dep2.id },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: adminUser.id, roleId: adminRole.id },
        { userId: staffUser.id, roleId: staffRole.id },
        { userId: hrUser.id, roleId: hrRole.id },
      ],
    });

    // 员工（hr 所属部门的员工，用于测试数据隔离）
    const emp1 = await prisma.employee.create({
      data: { employeeNo: 'E001', name: '员工一', departmentId: dep1.id, hireDate: new Date('2023-01-15'), userId: staffUser.id },
    });
    await prisma.employee.create({
      data: { employeeNo: 'E002', name: '员工二', departmentId: dep1.id, hireDate: new Date('2023-03-20') },
    });
    await prisma.employee.create({
      data: { employeeNo: 'E003', name: '员工三', departmentId: dep2.id, hireDate: new Date('2023-05-10') },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    adminCookie = await login(app, 'admin');
    staffCookie = await login(app, 'staff');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ===== 认证 =====
  describe('认证 /auth', () => {
    it('正确凭据登录 → 200 + token + 用户信息（含 permissions）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'admin', password: '123456' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.user.username).toBe('admin');
      expect(body.data.user.name).toBe('系统管理员');
      expect(Array.isArray(body.data.user.permissions)).toBe(true);
      expect(body.data.user.permissions.length).toBeGreaterThan(0);
    });

    it('未登录访问 /auth/me → 401', async () => {
      const res = await inject(app, { method: 'GET', url: '/api/v1/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('携带 cookie 访问 /auth/me → 200 返回当前用户及权限', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.user.username).toBe('admin');
      expect(body.data.user.permissions).toContain('system:role:manage');
    });
  });

  // ===== 细粒度权限 =====
  describe('细粒度权限守卫', () => {
    it('admin 有 system:role:view → 可以访问 /system/roles', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });

    it('staff 没有 system:role:view → 访问 /system/roles 返回 403', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: staffCookie },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(5003);
    });

    it('admin 有 system:user:manage → 可以创建用户', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/users',
        headers: { cookie: adminCookie },
        payload: { username: 'testuser', password: '123456', name: '测试用户' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('staff 没有 system:user:manage → 创建用户返回 403', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/users',
        headers: { cookie: staffCookie },
        payload: { username: 'hacker', password: '123456', name: '黑客' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ===== 角色管理 CRUD =====
  describe('角色管理 CRUD', () => {
    it('创建角色 → 200', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
        payload: { code: 'test_role', name: '测试角色', description: '用于测试的角色' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      roleId = body.data.id;
      expect(body.data.code).toBe('test_role');
    });

    it('角色列表 → 返回含权限的角色列表', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      const adminRole = body.data.find((r: any) => r.code === 'admin');
      expect(adminRole).toBeDefined();
      expect(adminRole.permissions.length).toBeGreaterThan(0);
    });

    it('权限列表 → 按 module 排序，操作级粒度', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/permissions',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      // 应包含细粒度权限
      const codes = body.data.map((p: any) => p.code);
      expect(codes).toContain('system:user:view');
      expect(codes).toContain('system:user:manage');
      expect(codes).toContain('system:role:view');
      expect(codes).toContain('employee:view');
      expect(codes).toContain('employee:create');
    });

    it('为角色分配权限 → 200', async () => {
      const permsRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/permissions',
        headers: { cookie: adminCookie },
      });
      const allPerms = JSON.parse(permsRes.payload).data;
      const permIds = allPerms.slice(0, 3).map((p: any) => p.id);

      const res = await inject(app, {
        method: 'POST',
        url: `/api/v1/system/roles/${roleId}/permissions`,
        headers: { cookie: adminCookie },
        payload: { permissionIds: permIds },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.success).toBe(true);
    });

    it('更新角色 → 200', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/roles/${roleId}`,
        headers: { cookie: adminCookie },
        payload: { name: '测试角色-修改', description: '更新后的描述' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('删除角色 → 200', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/system/roles/${roleId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });

    it('不能删除 admin 角色 → 409', async () => {
      const rolesRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/roles',
        headers: { cookie: adminCookie },
      });
      const adminRole = JSON.parse(rolesRes.payload).data.find((r: any) => r.code === 'admin');
      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/system/roles/${adminRole.id}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(409);
    });
  });
});
