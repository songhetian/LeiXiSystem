// S03 · 员工档案 e2e（TDD RED 先行，对齐 spec 3.2 / CONTEXT 业务规则 / ADR-0010 数据隔离）
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

describe('S03 · 员工档案（/api/v1/employees）', () => {
  let app: NestFastifyApplication;
  let techDeptId: number;
  let csDeptId: number;

  beforeAll(async () => {
    // 清库并 seed 组织与账号
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const perm = await prisma.permission.create({
      data: { code: 'employee:list', name: '查看员工', module: 'employee', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const managerRole = await prisma.role.create({ data: { code: 'manager', name: '部门经理' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: perm.id },
        { roleId: managerRole.id, permissionId: perm.id },
      ],
    });

    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const manager = await prisma.user.create({
      data: { username: 'manager', passwordHash: await bcrypt.hash('123456', 10), name: '经理' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: manager.id, roleId: managerRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });

    // 部门树：技术部 / 客服部 → 客服一部
    const tech = await prisma.department.create({ data: { name: '技术部' } });
    const cs = await prisma.department.create({ data: { name: '客服部' } });
    const cs1 = await prisma.department.create({ data: { name: '客服一部', parentId: cs.id } });
    techDeptId = tech.id;
    csDeptId = cs.id;
    const pos = await prisma.position.create({ data: { name: '客服专员' } });

    await prisma.employee.createMany({
      data: [
        { employeeNo: 'E001', name: '张三', departmentId: tech.id, hireDate: new Date('2026-01-01'), salary: 5000 },
        { employeeNo: 'E002', name: '李四', departmentId: cs.id, positionId: pos.id, hireDate: new Date('2026-02-01'), salary: 6000 },
        { employeeNo: 'E003', name: '王五', departmentId: cs1.id, hireDate: new Date('2026-03-01'), salary: 4000 },
      ],
    });
    await prisma.userDepartment.createMany({
      data: [
        { userId: manager.id, departmentId: cs.id },
        { userId: staff.id, departmentId: cs.id },
      ],
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ---- 创建（正常/边界/异常） ----
  it('创建员工成功 → 200 + 员工数据', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/employees',
      headers: { cookie: adminCookie },
      payload: {
        employeeNo: 'E004',
        name: '赵六',
        departmentId: techDeptId,
        phone: '13800138000',
        hireDate: '2026-04-01',
        salary: 4500,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).code).toBe(0);
    expect(JSON.parse(res.body).data.employeeNo).toBe('E004');
  });

  it('工号重复 → 409 + 1001', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/employees',
      headers: { cookie: adminCookie },
      payload: { employeeNo: 'E001', name: '重复工号', departmentId: 1, hireDate: '2026-01-01' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(1001);
  });

  it('手机号格式错误 → 422 + 1003', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/employees',
      headers: { cookie: adminCookie },
      payload: { employeeNo: 'E005', name: '手机错', departmentId: 1, phone: '12345', hireDate: '2026-01-01' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe(1003);
  });

  // ---- 查询 ----
  it('员工列表分页 → total=4（含新建 E004）', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees?page=1&pageSize=10',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(4);
  });

  it('按工号搜索 → 命中 E002', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees?keyword=E002',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.data.total).toBe(1);
    expect(body.data.list[0].name).toBe('李四');
  });

  it('员工不存在 → 404 + 1002', async () => {
    const adminCookie = await login(app, 'admin');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/employees/99999',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe(1002);
  });

  // ---- 修改与离职（状态机） ----
  it('修改员工 → 200', async () => {
    const adminCookie = await login(app, 'admin');
    const e = await prisma.employee.findUnique({ where: { employeeNo: 'E001' } });
    const res = await inject(app, {
      method: 'PATCH',
      url: `/api/v1/employees/${e!.id}`,
      headers: { cookie: adminCookie },
      payload: { name: '张三丰', salary: 5500 },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.name).toBe('张三丰');
  });

  it('离职 → status=resigned', async () => {
    const adminCookie = await login(app, 'admin');
    const e = await prisma.employee.findUnique({ where: { employeeNo: 'E002' } });
    const res = await inject(app, {
      method: 'POST',
      url: `/api/v1/employees/${e!.id}/resign`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('resigned');
  });

  it('已离职员工禁止修改 → 409 + 1004', async () => {
    const adminCookie = await login(app, 'admin');
    const e = await prisma.employee.findUnique({ where: { employeeNo: 'E002' } });
    const res = await inject(app, {
      method: 'PATCH',
      url: `/api/v1/employees/${e!.id}`,
      headers: { cookie: adminCookie },
      payload: { name: '想改' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(1004);
  });

  // ---- 部门数据隔离（ADR-0010） ----
  it('admin 可见全部员工', async () => {
    const c = await login(app, 'admin');
    const res = await inject(app, { method: 'GET', url: '/api/v1/employees', headers: { cookie: c } });
    expect(JSON.parse(res.body).data.total).toBe(4);
  });

  it('部门经理仅见本部门（含子部门）→ 客服部=2 人', async () => {
    const c = await login(app, 'manager');
    const res = await inject(app, { method: 'GET', url: '/api/v1/employees', headers: { cookie: c } });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(2); // 客服部李四 + 客服一部王五
    const names = body.data.list.map((i: any) => i.name);
    expect(names).toContain('李四');
    expect(names).toContain('王五');
    expect(names).not.toContain('张三');
  });

  it('普通员工（无权限）访问员工列表 → 403 + 5003', async () => {
    const c = await login(app, 'staff');
    const res = await inject(app, { method: 'GET', url: '/api/v1/employees', headers: { cookie: c } });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });

  // ADR-0010 行级越权：有 employee:list 权限但数据范围不含目标 → 应 5003，而非 1002
  it('部门经理访问非管辖员工详情 → 403 + 5003（ADR-0010 行级越权）', async () => {
    const adminCookie = await login(app, 'admin');
    const listRes = await inject(app, { method: 'GET', url: '/api/v1/employees', headers: { cookie: adminCookie } });
    const target = JSON.parse(listRes.body).data.list.find((e: any) => e.employeeNo === 'E001'); // 张三，技术部，不在经理(客服部)范围内
    const managerCookie = await login(app, 'manager');
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/employees/${target.id}`,
      headers: { cookie: managerCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });
});
