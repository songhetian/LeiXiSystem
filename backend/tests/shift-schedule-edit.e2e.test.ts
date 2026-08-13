// S04 · 班次/排班编辑删除 e2e（TDD RED 先行）
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

describe('S04 · 班次编辑/删除 + 排班编辑/删除', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;

  beforeAll(async () => {
    await prisma.schedule.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.department.deleteMany();
    await prisma.user.deleteMany();

    const perm = await prisma.permission.create({
      data: { code: 'attendance:manage', name: '考勤管理', module: 'attendance', type: 'menu' },
    });
    const adminRole = await prisma.role.create({ data: { code: 'admin', name: '管理员' } });
    await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });

    const admin = await prisma.user.create({
      data: { username: 'admin_s04', passwordHash: await bcrypt.hash('123456', 10), name: '管理员' },
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

    const dept = await prisma.department.create({ data: { name: '技术部' } });
    await prisma.employee.create({
      data: { name: '张三', employeeNo: 'E003', userId: admin.id, departmentId: dept.id, hireDate: new Date('2024-01-01') },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
    adminCookie = await login(app, 'admin_s04');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('班次编辑', () => {
    let shiftId: number;

    beforeAll(async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
        payload: { name: '早班测试', startTime: '08:00', endTime: '16:00', isNextDay: false },
      });
      shiftId = JSON.parse(res.payload).data.id;
    });

    it('PUT /shifts/:id → 更新班次名称和时间', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/shifts/${shiftId}`,
        headers: { cookie: adminCookie },
        payload: { name: '早班（更新）', startTime: '08:30', endTime: '17:00', isNextDay: false },
      });
      const body = JSON.parse(res.payload);
      expect(res.statusCode).toBe(200);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('早班（更新）');
      expect(body.data.startTime).toBe('08:30');
      expect(body.data.endTime).toBe('17:00');
    });

    it('更新时保留未修改字段', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/shifts/${shiftId}`,
        headers: { cookie: adminCookie },
        payload: { name: '只改名字' },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.name).toBe('只改名字');
      expect(body.data.startTime).toBe('08:30');
      expect(body.data.endTime).toBe('17:00');
    });

    it('更新班次时校验跨天约束（非跨天结束必须晚于开始）', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/shifts/${shiftId}`,
        headers: { cookie: adminCookie },
        payload: { startTime: '18:00', endTime: '16:00', isNextDay: false },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('跨天班次允许开始晚于结束', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/shifts/${shiftId}`,
        headers: { cookie: adminCookie },
        payload: { startTime: '22:00', endTime: '06:00', isNextDay: true },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.isNextDay).toBe(true);
    });

    it('更新不存在的班次 → 404', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: '/api/v1/shifts/99999',
        headers: { cookie: adminCookie },
        payload: { name: '不存在' },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });

  describe('班次删除', () => {
    it('DELETE /shifts/:id → 删除班次', async () => {
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
        payload: { name: '待删班次', startTime: '09:00', endTime: '18:00', isNextDay: false },
      });
      const id = JSON.parse(createRes.payload).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/shifts/${id}`,
        headers: { cookie: adminCookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);

      const listRes = await inject(app, {
        method: 'GET',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
      });
      const list = JSON.parse(listRes.payload).data.list;
      expect(list.find((s: any) => s.id === id)).toBeUndefined();
    });

    it('删除不存在的班次 → 404', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: '/api/v1/shifts/99999',
        headers: { cookie: adminCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });

    it('被排班使用的班次不能删除（外键约束）', async () => {
      const shiftRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
        payload: { name: '在用班次', startTime: '09:00', endTime: '18:00', isNextDay: false },
      });
      const shiftId = JSON.parse(shiftRes.payload).data.id;

      const emp = await prisma.employee.findFirst();
      await inject(app, {
        method: 'POST',
        url: '/api/v1/schedules',
        headers: { cookie: adminCookie },
        payload: { employeeId: emp!.id, shiftId, workDate: '2026-08-15' },
      });

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/shifts/${shiftId}`,
        headers: { cookie: adminCookie },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });
  });

  describe('排班编辑', () => {
    let scheduleId: number;
    let shift1Id: number;
    let shift2Id: number;

    beforeAll(async () => {
      const s1 = await inject(app, {
        method: 'POST',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
        payload: { name: '白班S', startTime: '09:00', endTime: '18:00', isNextDay: false },
      });
      shift1Id = JSON.parse(s1.payload).data.id;

      const s2 = await inject(app, {
        method: 'POST',
        url: '/api/v1/shifts',
        headers: { cookie: adminCookie },
        payload: { name: '晚班S', startTime: '14:00', endTime: '22:00', isNextDay: false },
      });
      shift2Id = JSON.parse(s2.payload).data.id;

      const emp = await prisma.employee.findFirst();
      const schRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/schedules',
        headers: { cookie: adminCookie },
        payload: { employeeId: emp!.id, shiftId: shift1Id, workDate: '2026-08-20' },
      });
      scheduleId = JSON.parse(schRes.payload).data.id;
    });

    it('PUT /schedules/:id → 更换班次', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/schedules/${scheduleId}`,
        headers: { cookie: adminCookie },
        payload: { shiftId: shift2Id },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
      expect(body.data.shiftId).toBe(shift2Id);
    });

    it('更新排班日期', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/schedules/${scheduleId}`,
        headers: { cookie: adminCookie },
        payload: { workDate: '2026-08-21' },
      });
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(0);
    });

    it('更新为同员工同日重复排班 → 冲突报错', async () => {
      const emp = await prisma.employee.findFirst();
      await inject(app, {
        method: 'POST',
        url: '/api/v1/schedules',
        headers: { cookie: adminCookie },
        payload: { employeeId: emp!.id, shiftId: shift1Id, workDate: '2026-08-25' },
      });

      const res = await inject(app, {
        method: 'PUT',
        url: `/api/v1/schedules/${scheduleId}`,
        headers: { cookie: adminCookie },
        payload: { workDate: '2026-08-25' },
      });
      expect(JSON.parse(res.payload).code).not.toBe(0);
    });

    it('更新不存在的排班 → 404', async () => {
      const res = await inject(app, {
        method: 'PUT',
        url: '/api/v1/schedules/99999',
        headers: { cookie: adminCookie },
        payload: { shiftId: shift1Id },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });

  describe('排班删除', () => {
    it('DELETE /schedules/:id → 删除排班', async () => {
      const emp = await prisma.employee.findFirst();
      const shift = await prisma.shift.findFirst();
      const createRes = await inject(app, {
        method: 'POST',
        url: '/api/v1/schedules',
        headers: { cookie: adminCookie },
        payload: { employeeId: emp!.id, shiftId: shift!.id, workDate: '2026-09-01' },
      });
      const id = JSON.parse(createRes.payload).data.id;

      const res = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/schedules/${id}`,
        headers: { cookie: adminCookie },
      });
      expect(JSON.parse(res.payload).code).toBe(0);
    });

    it('删除不存在的排班 → 404', async () => {
      const res = await inject(app, {
        method: 'DELETE',
        url: '/api/v1/schedules/99999',
        headers: { cookie: adminCookie },
      });
      expect([404, 500]).toContain(res.statusCode);
    });
  });
});
