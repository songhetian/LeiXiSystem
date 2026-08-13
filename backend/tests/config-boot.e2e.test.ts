import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from '../src/common/config/config.options';

describe('ConfigModule 启动期校验 (T19.2)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('合法 env：应用可正常启动（configModuleOptions 已接入）', async () => {
    process.env.DATABASE_URL = 'mysql://root:root@127.0.0.1:3306/leixin_v2';
    process.env.JWT_SECRET = 'dev-secret-please-change';

    @Module({
      imports: [ConfigModule.forRoot({ ...configModuleOptions, ignoreEnvFile: true })],
    })
    class ValidEnvModule {}

    const app = await NestFactory.create<NestFastifyApplication>(ValidEnvModule, new FastifyAdapter());
    expect(app).toBeDefined();
    await app.close();
  });

  it('非法 env（缺 JWT_SECRET）：validate 函数拒绝（fail-fast）', () => {
    // forRoot 为 async，校验在微任务中 reject 无法被 toThrow 捕获；
    // 直接调用已接入 app.module 的同一 validate 函数做同步断言
    expect(() =>
      configModuleOptions.validate!({
        DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      }),
    ).toThrow();
  });

  it('合法 env：validate 函数返回解析值', () => {
    const result = configModuleOptions.validate!({
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change',
    });
    expect(result).toMatchObject({
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change',
    });
  });
});
