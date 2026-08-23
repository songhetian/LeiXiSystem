// S05+ · XFace600 Push 端点 e2e（TDD RED 先行）
// 真机出厂 Push 协议：POST /iclock/cdata?SN=XXXX&table=ATTLOG
// 请求体为纯文本（tab 分隔），每行一条记录。服务端解析后入库 PunchLog。
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();
const inject = (app: NestFastifyApplication, opts: any) =>
  app.getHttpAdapter().getInstance().inject(opts);

describe('XFace600 Push 端点（POST /iclock/cdata）', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prisma.punchLog.deleteMany();
    await prisma.punchSyncState.deleteMany();
    await prisma.punchDevice.deleteMany();

    await prisma.punchDevice.create({
      data: {
        name: 'XFace600-前门',
        deviceNo: 'DEV001',
        ipAddress: '192.168.1.201',
        port: 80,
        apiKey: 'push-secret-001',
        enabled: true,
        status: 'online',
      },
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    // /iclock/cdata 为设备直连端点，需排除全局 api/v1 前缀
    app.setGlobalPrefix('api/v1', { exclude: ['iclock/cdata'] });
    await app.register(cookie as any);
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('合法 ATTLOG 推送', () => {
    it('POST /iclock/cdata?SN=DEV001&table=ATTLOG&key=... → 200 + 纯文本 OK + 入库 PunchLog', async () => {
      const body = [
        '1001\t2026-08-14 09:05:00\t0\t1',
        '1001\t2026-08-14 18:10:00\t1\t1',
        '1002\t2026-08-14 09:00:00\t0\t1',
      ].join('\n');

      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&table=ATTLOG&options=all&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: body,
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('OK');

      const logs = await prisma.punchLog.findMany({
        where: { deviceNo: 'DEV001' },
        orderBy: { punchTime: 'asc' },
      });
      expect(logs.length).toBe(3);
      // 按时间升序：1002@09:00 → 1001@09:05 → 1001@18:10
      expect(logs[0].employeeNo).toBe('1002');
      const log1001 = logs.find(
        (l) =>
          l.employeeNo === '1001' &&
          l.punchTime.toISOString() === new Date('2026-08-14 09:05:00').toISOString(),
      );
      expect(log1001).toBeDefined();
      expect(log1001!.source).toBe('api');
      expect(log1001!.status).toBe('pending');
      expect(log1001!.rawData).toContain('1001');
    });

    it('ATTLOG 行带表名前缀（ATTLOG\\t...）也能正确解析入库', async () => {
      // 清掉上一轮数据，避免干扰
      await prisma.punchLog.deleteMany({ where: { deviceNo: 'DEV001' } });

      const body = 'ATTLOG\t2001\t2026-08-14 08:00:00\t0\t1\nATTLOG\t2001\t2026-08-14 17:30:00\t1\t1';

      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&table=ATTLOG&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: body,
      });

      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('OK');

      const logs = await prisma.punchLog.findMany({
        where: { deviceNo: 'DEV001', employeeNo: '2001' },
        orderBy: { punchTime: 'asc' },
      });
      expect(logs.length).toBe(2);
    });
  });

  describe('设备鉴权', () => {
    it('非法 SN（未注册设备）→ 401', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=HACKER999&table=ATTLOG',
        headers: { 'content-type': 'text/plain' },
        payload: '9999\t2026-08-14 09:00:00\t0\t1',
      });
      expect(res.statusCode).toBe(401);
    });

    it('apiKey 与 SN 不匹配 → 403', async () => {
      // key 命中 DEV001，但 SN 伪造
      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV002&table=ATTLOG&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: '9999\t2026-08-14 09:00:00\t0\t1',
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('设备心跳（空请求体）', () => {
    it('POST /iclock/cdata 空体 → 200 + OK（设备心跳）', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: '',
      });
      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('OK');
    });

    it('POST /iclock/cdata 仅空白字符 → 200 + OK', async () => {
      const res = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: '   \n\t  \n',
      });
      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('OK');
    });
  });

  describe('去重（已存在记录不重复入库）', () => {
    it('重复推送相同 ATTLOG → 第二次不新增', async () => {
      await prisma.punchLog.deleteMany({ where: { deviceNo: 'DEV001' } });

      const body = '3001\t2026-08-15 08:30:00\t0\t1';

      const first = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&table=ATTLOG&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: body,
      });
      expect(first.statusCode).toBe(200);

      const between = await prisma.punchLog.count({ where: { deviceNo: 'DEV001', employeeNo: '3001' } });
      expect(between).toBe(1);

      const second = await inject(app, {
        method: 'POST',
        url: '/iclock/cdata?SN=DEV001&table=ATTLOG&key=push-secret-001',
        headers: { 'content-type': 'text/plain' },
        payload: body,
      });
      expect(second.statusCode).toBe(200);

      const after = await prisma.punchLog.count({ where: { deviceNo: 'DEV001', employeeNo: '3001' } });
      expect(after).toBe(1);
    });
  });
});
