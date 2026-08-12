// S01 · 后端 TDD（RED 先行）— 健康检查端到端（对齐 spec 第 4 章统一响应格式）
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

describe('GET /health（S01 骨架验收）', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('返回 200 且响应体为统一格式 { code: 0, message, data }', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/health',
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
