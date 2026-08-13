// S05 · 打卡采集 e2e（TDD RED 先行，对齐 spec 2.1 / 错误码 2003）
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

describe('S05 · 打卡采集（/api/v1/attendance/punch）', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let empId: number;

  beforeAll(async () => {
    await prisma.punchLog.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userDepartment.deleteMany();
    await prisma.department.deleteMany();
    await prisma.position.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const permManage = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });
    const permView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
      ],
    });
    const admin = await prisma.user.create({
      data: { username: 'admin', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    const staff = await prisma.user.create({
      data: { username: 'staff', passwordHash: await bcrypt.hash('123456', 10), name: '员工' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: staff.id, roleId: staffRole.id },
      ],
    });
    const dept = await prisma.department.create({ data: { name: '客服部' } });
    const emp = await prisma.employee.create({
      data: { employeeNo: 'E101', name: '张三', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empId = emp.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ===== CSV 导入 =====
  it('CSV导入成功 → 200 + 返回条数', async () => {
    const csvContent = [
      '工号,打卡时间,设备号',
      'E101,2026-08-10 08:00:00,DEV001',
      'E101,2026-08-10 17:30:00,DEV001',
    ].join('\n');

    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/punch/import',
      headers: { cookie: adminCookie },
      payload: { csv: csvContent },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.count).toBe(2);
  });

  it('重复导入相同数据 → 409 + 2003（去重）', async () => {
    const csvContent = [
      '工号,打卡时间,设备号',
      'E101,2026-08-10 08:00:00,DEV001',
    ].join('\n');

    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/punch/import',
      headers: { cookie: adminCookie },
      payload: { csv: csvContent },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(2003);
  });

  it('CSV导入含无效工号格式 → 422', async () => {
    const csvContent = [
      '工号,打卡时间,设备号',
      'E!,2026-08-10 09:00:00,DEV001',
    ].join('\n');

    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/attendance/punch/import',
      headers: { cookie: adminCookie },
      payload: { csv: csvContent },
    });
    expect(res.statusCode).toBe(422);
  });

  // ===== 流水查询 =====
  it('打卡流水列表 → 分页 + 筛选', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/punch?employeeNo=E101&startDate=2026-08-10&endDate=2026-08-10&page=1&pageSize=10',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(2);
    expect(body.data.list.length).toBe(2);
    expect(body.data.list[0].employeeNo).toBe('E101');
    expect(body.data.list[0].source).toBe('import');
    expect(body.data.list[0].status).toBe('pending');
  });

  it('无权限用户访问流水 → 403 + 5003', async () => {
    const staffCookie = await login(app, 'staff');
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/punch',
      headers: { cookie: staffCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });

  it('流水按状态筛选 → abnormal/pending', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: '/api/v1/attendance/punch?status=pending',
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.list.every((item: any) => item.status === 'pending')).toBe(true);
  });
});
