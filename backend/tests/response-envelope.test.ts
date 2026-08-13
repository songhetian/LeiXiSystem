// T16 · 统一响应信封 + 全局异常过滤器（隔离测试，不依赖 DB）
// 对齐 docs/api/core-contracts.md §1 统一响应 / §2 错误码体系
// 行为：成功 → {code:0,message:'ok',data}；异常 → {code,message,data:null} + 正确 HTTP 状态
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Controller, Get, Post, HttpCode, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { BizException } from '../src/common/biz-exception';
import { ERROR_CODES } from '../src/common/error-codes';

@Controller('env')
class EnvelopeTestController {
  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION }); // 5003
  }

  @Get('notfound')
  notfound() {
    throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND }); // 1002
  }

  @Post('validation')
  @HttpCode(200)
  validation() {
    throw new UnprocessableEntityException({ code: ERROR_CODES.PARAM_INVALID }); // 4000
  }

  @Post('biz')
  @HttpCode(200)
  biz() {
    throw new BizException(ERROR_CODES.EMPLOYEE_PHONE_INVALID, 422); // 1003
  }

  @Get('ok')
  ok() {
    return { code: 0, data: { x: 1 } };
  }

  @Get('boom')
  boom() {
    throw new Error('kaboom — 不应泄露到客户端');
  }
}

@Module({ controllers: [EnvelopeTestController] })
class EnvelopeTestModule {}

describe('T16 · 统一响应信封 + 全局异常过滤器', () => {
  let app: NestFastifyApplication;
  const inject = (opts: any) => app.getHttpAdapter().getInstance().inject(opts);

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(EnvelopeTestModule, new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('行级越权 5003 → 403 + {code:5003,message,data:null}', async () => {
    const res = await inject({ method: 'GET', url: '/env/forbidden' });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(5003);
    expect(body.message).toBe('无权限访问该数据');
    expect(body.data).toBeNull();
  });

  it('资源不存在 1002 → 404 + {code:1002,message,data:null}', async () => {
    const res = await inject({ method: 'GET', url: '/env/notfound' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(1002);
    expect(body.message).toBe('员工不存在');
    expect(body.data).toBeNull();
  });

  it('参数校验 4000 → 422 + {code:4000,message,data:null}', async () => {
    const res = await inject({ method: 'POST', url: '/env/validation' });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(4000);
    expect(body.message).toBe('参数校验失败');
    expect(body.data).toBeNull();
  });

  it('BizException 自动取中央 message → 1003', async () => {
    const res = await inject({ method: 'POST', url: '/env/biz' });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(1003);
    expect(body.message).toBe('手机号格式错误');
    expect(body.data).toBeNull();
  });

  it('成功响应 → 200 + {code:0,message:"ok",data}', async () => {
    const res = await inject({ method: 'GET', url: '/env/ok' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
    expect(body.message).toBe('ok');
    expect(body.data).toEqual({ x: 1 });
  });

  it('未捕获异常 → 500 + {code:5000,message:"服务器内部错误",data:null}（不泄露内部信息）', async () => {
    const res = await inject({ method: 'GET', url: '/env/boom' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(5000);
    expect(body.message).toBe('服务器内部错误');
    expect(body.data).toBeNull();
    expect(JSON.stringify(body)).not.toContain('kaboom');
  });
});
