// S04 · 班次与排班 e2e（TDD RED 先行，对齐 spec 2.2 / CONTEXT C1 跨天 / 错误码 2001/2002）
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

describe('S04 · 班次与排班（/api/v1/shifts、/api/v1/schedules）', () => {
  let app: NestFastifyApplication;
  let empA: number;
  let empB: number;
  let empC: number;
  let adminCookie: string;
  let manager2Cookie: string;

  beforeAll(async () => {
    // seed：admin/manager/staff + 权限 + 部门 + 2 员工
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
    const managerRole = await prisma.role.create({ data: { code: 'manager', name: '部门经理' } });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '普通员工' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: adminRole.id, permissionId: permManage.id },
        { roleId: adminRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permManage.id },
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
    const dept = await prisma.department.create({ data: { name: '客服部' } });
    const e1 = await prisma.employee.create({
      data: { employeeNo: 'E101', name: '张三', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    const e2 = await prisma.employee.create({
      data: { employeeNo: 'E102', name: '李四', departmentId: dept.id, hireDate: new Date('2026-01-01') },
    });
    empA = e1.id;
    empB = e2.id;

    // 第二个部门 + 受限经理（仅技术部），用于行级越权 5003 测试
    const dept2 = await prisma.department.create({ data: { name: '技术部' } });
    const e3 = await prisma.employee.create({
      data: { employeeNo: 'E201', name: '王五', departmentId: dept2.id, hireDate: new Date('2026-01-01') },
    });
    const manager2 = await prisma.user.create({
      data: { username: 'manager2', passwordHash: await bcrypt.hash('123456', 10), name: '经理二' },
    });
    await prisma.userRole.create({ data: { userId: manager2.id, roleId: managerRole.id } });
    await prisma.userDepartment.create({ data: { userId: manager2.id, departmentId: dept2.id } });
    empC = e3.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin');
    manager2Cookie = await login(app, 'manager2');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ===== 班次 =====
  it('创建班次正常 → 200', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/shifts',
      headers: { cookie: adminCookie },
      payload: { name: '早班', startTime: '08:00', endTime: '17:00', isNextDay: false },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).code).toBe(0);
  });

  it('创建跨天班次（22:00-06:00, isNextDay）→ 200（C1）', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/shifts',
      headers: { cookie: adminCookie },
      payload: { name: '夜班', startTime: '22:00', endTime: '06:00', isNextDay: true },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.isNextDay).toBe(true);
  });

  it('班次时间无效（end<=start 且非跨天）→ 422 + 2001', async () => {
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/shifts',
      headers: { cookie: adminCookie },
      payload: { name: '错误班次', startTime: '17:00', endTime: '08:00', isNextDay: false },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe(2001);
  });

  it('班次列表 → 至少 2 条', async () => {
    const res = await inject(app, { method: 'GET', url: '/api/v1/shifts', headers: { cookie: adminCookie } });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.list.length).toBeGreaterThanOrEqual(2);
  });

  it('无权限用户访问班次 → 403 + 5003', async () => {
    const staffCookie = await login(app, 'staff');
    const res = await inject(app, { method: 'GET', url: '/api/v1/shifts', headers: { cookie: staffCookie } });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });

  // ===== 排班 =====
  it('创建排班正常 → 200', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: adminCookie },
      payload: { employeeId: empA, shiftId: shift!.id, workDate: '2026-08-10' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).code).toBe(0);
  });

  it('同员工同日期重复排班 → 409 + 2002', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: adminCookie },
      payload: { employeeId: empA, shiftId: shift!.id, workDate: '2026-08-10' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(2002);
  });

  it('批量排班成功（2 员工 × 2 天）→ 200 + 4 条', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const items = [
      { employeeId: empA, shiftId: shift!.id, workDate: '2026-08-11' },
      { employeeId: empA, shiftId: shift!.id, workDate: '2026-08-12' },
      { employeeId: empB, shiftId: shift!.id, workDate: '2026-08-11' },
      { employeeId: empB, shiftId: shift!.id, workDate: '2026-08-12' },
    ];
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules/batch',
      headers: { cookie: adminCookie },
      payload: { items },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.count).toBe(4);
  });

  it('批量排班含重复 → 409 + 2002 且原子回滚（无部分插入）', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const items = [
      { employeeId: empB, shiftId: shift!.id, workDate: '2026-08-13' },
      { employeeId: empB, shiftId: shift!.id, workDate: '2026-08-11' }, // 已存在
    ];
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules/batch',
      headers: { cookie: adminCookie },
      payload: { items },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe(2002);
    const dup = await prisma.schedule.findFirst({
      where: { employeeId: empB, workDate: new Date('2026-08-13') },
    });
    expect(dup).toBeNull(); // 原子回滚验证
  });

  it('排班列表按员工+日期筛选 → 命中', async () => {
    const res = await inject(app, {
      method: 'GET',
      url: `/api/v1/schedules?employeeId=${empA}&startDate=2026-08-10&endDate=2026-08-12`,
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.data.total).toBe(3); // 08-10 + 08-11 + 08-12
  });

  it('排班引用不存在员工 → 422', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: adminCookie },
      payload: { employeeId: 999999, shiftId: shift!.id, workDate: '2026-08-20' },
    });
    expect(res.statusCode).toBe(422);
  });

  // RED：契约 core-contracts §2 规定 422 是 HTTP 传输层状态，绝非业务码；
  // 「员工或班次不存在」应返回有效 4 位业务码 1002（员工不存在）
  it('排班引用不存在员工 → 422 + 业务码 1002（而非无效的 422）', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: adminCookie },
      payload: { employeeId: 999999, shiftId: shift!.id, workDate: '2026-08-20' },
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(1002); // 有效业务码，不得为 422
    expect(body.code).not.toBe(422);
  });

  // RED：DTO 校验失败属「校验失败」→ HTTP 422 + 考勤域有效业务码 2001（非 422）
  it('排班创建参数缺失（无 workDate）→ 422 + 业务码 2001', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: adminCookie },
      payload: { employeeId: 1, shiftId: shift!.id }, // 缺 workDate
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(2001);
    expect(body.code).not.toBe(422);
  });

  // RED：行级越权（ADR-0010）→ 受限经理给非管辖部门员工排班应 403 + 5003（非 400）
  it('受限经理给非管辖员工排班 → 403 + 5003', async () => {
    const shift = await prisma.shift.findFirst({ where: { name: '早班' } });
    const res = await inject(app, {
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { cookie: manager2Cookie }, // 经理二仅技术部
      payload: { employeeId: empA, shiftId: shift!.id, workDate: '2026-08-20' }, // empA 属客服部
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe(5003);
  });
});
