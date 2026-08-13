// S06 · 调休兑换员工端自助申请 e2e（TDD RED 先行）
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

describe('S06 · 调休兑换员工端自助申请', () => {
  let app: NestFastifyApplication;
  let staffCookie: string;
  let otherStaffCookie: string;
  let managerCookie: string;
  let employeeId: number;
  let otherEmployeeId: number;
  let compensatoryTypeId: number;

  beforeAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vacationType.deleteMany();

    const permView = await prisma.permission.create({
      data: { code: 'attendance:view', name: '考勤查看', module: 'attendance', type: 'menu' },
    });
    const permManage = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });
    const staffRole = await prisma.role.create({ data: { code: 'staff', name: '员工' } });
    const managerRole = await prisma.role.create({ data: { code: 'manager', name: '主管' } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: staffRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permView.id },
        { roleId: managerRole.id, permissionId: permManage.id },
      ],
    });

    const user1 = await prisma.user.create({
      data: { username: 'staff_c', passwordHash: await bcrypt.hash('123456', 10), name: '员工C' },
    });
    const user2 = await prisma.user.create({
      data: { username: 'staff_d', passwordHash: await bcrypt.hash('123456', 10), name: '员工D' },
    });
    const mgr = await prisma.user.create({
      data: { username: 'mgr_c', passwordHash: await bcrypt.hash('123456', 10), name: '主管' },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: user1.id, roleId: staffRole.id },
        { userId: user2.id, roleId: staffRole.id },
        { userId: mgr.id, roleId: managerRole.id },
      ],
    });

    const dept = await prisma.department.create({ data: { name: '运营部' } });
    const emp1 = await prisma.employee.create({
      data: { name: '员工C', employeeNo: 'EC01', userId: user1.id, departmentId: dept.id, hireDate: new Date('2024-01-01') },
    });
    const emp2 = await prisma.employee.create({
      data: { name: '员工D', employeeNo: 'ED01', userId: user2.id, departmentId: dept.id, hireDate: new Date('2024-01-01') },
    });
    employeeId = emp1.id;
    otherEmployeeId = emp2.id;

    const vt = await prisma.vacationType.create({
      data: { name: '调休', code: 'compensatory', baseDays: 0, enabled: true, sortOrder: 1 },
    });
    compensatoryTypeId = vt.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();
    staffCookie = await login(app, 'staff_c');
    otherStaffCookie = await login(app, 'staff_d');
    managerCookie = await login(app, 'mgr_c');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('员工自助兑换调休', () => {
    let overtimeId: number;

    beforeAll(async () => {
      const ot = await prisma.overtimeRecord.create({
        data: {
          employeeId,
          overtimeDate: new Date('2026-08-10'),
          startTime: new Date('2026-08-10T18:00:00'),
          endTime: new Date('2026-08-11T02:00:00'),
          hours: 16,
          reason: '项目上线加班',
          status: 'approved',
          isCompensated: false,
        },
      });
      overtimeId = ot.id;
    });

    it('POST /vacation/convert/mine → 员工自助兑换成功', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: staffCookie },
        payload: { overtimeId, vacationTypeId: compensatoryTypeId, hours: 8 },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.days).toBe('1');
    });

    it('兑换后我的额度增加', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      const compensatory = body.data.find((b: any) => b.vacationTypeId === compensatoryTypeId);
      expect(compensatory).toBeDefined();
      expect(parseFloat(compensatory.totalDays)).toBeGreaterThanOrEqual(1);
    });

    it('兑换后变动记录可查', async () => {
      const res = await inject(app, {
        method: 'GET',
        url: '/api/v1/vacation/balances/changes/mine',
        headers: { cookie: staffCookie },
      });
      const body = JSON.parse(res.payload);
      const convertRecord = body.data.find((c: any) => c.changeType === 'conversion');
      expect(convertRecord).toBeDefined();
    });

    it('不能兑换别人的加班记录', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: otherStaffCookie },
        payload: { overtimeId, vacationTypeId: compensatoryTypeId, hours: 4 },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('未审批通过的加班不能兑换', async () => {
      const pendingOt = await prisma.overtimeRecord.create({
        data: {
          employeeId,
          overtimeDate: new Date('2026-08-12'),
          startTime: new Date('2026-08-12T18:00:00'),
          endTime: new Date('2026-08-12T22:00:00'),
          hours: 4,
          reason: '待审批',
          status: 'pending',
          isCompensated: false,
        },
      });
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: staffCookie },
        payload: { overtimeId: pendingOt.id, vacationTypeId: compensatoryTypeId, hours: 4 },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('兑换小时数不能超出加班时长', async () => {
      const smallOt = await prisma.overtimeRecord.create({
        data: {
          employeeId,
          overtimeDate: new Date('2026-08-13'),
          startTime: new Date('2026-08-13T18:00:00'),
          endTime: new Date('2026-08-13T22:00:00'),
          hours: 4,
          reason: '短加班',
          status: 'approved',
          isCompensated: false,
        },
      });
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: staffCookie },
        payload: { overtimeId: smallOt.id, vacationTypeId: compensatoryTypeId, hours: 8 },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('已兑换的加班不能重复兑换', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: staffCookie },
        payload: { overtimeId, vacationTypeId: compensatoryTypeId, hours: 8 },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('加班记录不存在时报错', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        headers: { cookie: staffCookie },
        payload: { overtimeId: 99999, vacationTypeId: compensatoryTypeId, hours: 4 },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('普通员工有权限（attendance:view 即可）', async () => {
      // 上面的测试已经用 staffCookie（只有 view 权限）通过了，这里额外验证无权限会失败
      // 这里再确认：没有登录的情况下会 401
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/vacation/convert/mine',
        payload: { overtimeId, vacationTypeId: compensatoryTypeId, hours: 4 },
      });
      expect(res.statusCode).not.toBe(200);
    });
  });
});
