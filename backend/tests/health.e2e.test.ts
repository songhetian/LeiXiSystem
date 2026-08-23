// S01 · 后端 TDD（RED 先行）— 健康检查端到端（对齐 spec 第 4 章统一响应格式）
// S01 · 健康检查 e2e
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';

describe('GET /api/v1/health（S01 骨架验收）', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(cookie as any);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('返回 200 且响应体为统一格式 { code: 0, message, data }', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.message).toBe('ok');
    expect(body.data).toHaveProperty('status', 'up');
  });

  it('未知路由返回 404', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/not-exist',
    });
    expect(res.statusCode).toBe(404);
  });
});
