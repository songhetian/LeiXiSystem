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

describe('P0-1 · 部门管理（/api/v1/system/departments）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;

  beforeAll(async () => {
    await prisma.employee.deleteMany();
    await prisma.position.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const perms = await Promise.all([
      prisma.permission.create({ data: { code: 'department:manage', name: '部门管理', module: 'system', type: 'api' } }),
      prisma.permission.create({ data: { code: 'position:manage', name: '职位管理', module: 'system', type: 'api' } }),
    ]);
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    });
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('部门 CRUD', () => {
    it('创建顶级部门 → 200 + 部门数据', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '技术部' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('技术部');
      expect(body.data.id).toBeDefined();
    });

    it('创建子部门 → 200 + 带 parentId', async () => {
      const parentRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '产品部' },
      });
      const parentId = JSON.parse(parentRes.body).data.id;

      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '产品一组', parentId },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).toBe('产品一组');
      expect(body.data.parentId).toBe(parentId);
    });

    it('部门名称重复 → 409', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '技术部' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('部门列表 → 树形结构（父子关系）', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(0);
      expect(Array.isArray(body.data)).toBe(true);
      const tech = body.data.find((d: any) => d.name === '技术部');
      expect(tech).toBeDefined();
    });

    it('更新部门名称 → 200', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '旧名称' },
      });
      const id = JSON.parse(createRes.body).data.id;

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/departments/${id}`,
        headers: { cookie: adminCookie },
        payload: { name: '新名称' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe('新名称');
    });

    it('删除叶子部门 → 200', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '待删除' },
      });
      const id = JSON.parse(createRes.body).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/system/departments/${id}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });

    it('删除有子部门的部门 → 409（不允许）', async () => {
      const parentRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '父部门' },
      });
      const parentId = JSON.parse(parentRes.body).data.id;

      await inject(app, {
        method: 'POST',
        url: '/api/v1/system/departments',
        headers: { cookie: adminCookie },
        payload: { name: '子部门', parentId },
      });

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/system/departments/${parentId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('岗位管理', () => {
    it('创建岗位 → 200', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/positions',
        headers: { cookie: adminCookie },
        payload: { name: '开发工程师' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe('开发工程师');
    });

    it('岗位列表 → 200', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/system/positions',
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body).data)).toBe(true);
    });

    it('更新岗位 → 200', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/positions',
        headers: { cookie: adminCookie },
        payload: { name: '测试岗位' },
      });
      const id = JSON.parse(createRes.body).data.id;

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/system/positions/${id}`,
        headers: { cookie: adminCookie },
        payload: { name: '更新后的岗位' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe('更新后的岗位');
    });

    it('删除岗位 → 200', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/system/positions',
        headers: { cookie: adminCookie },
        payload: { name: '待删岗' },
      });
      const id = JSON.parse(createRes.body).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/system/positions/${id}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
