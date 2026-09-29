/**
 * 指标拦截器的路由标签来源
 *
 * 这里钉的是 Fastify 弃用告警 FSTDEP017：取「匹配到的路由模板」曾用 `req.routerPath`，
 * 该属性自 Fastify 4.28 起已弃用（声明于 fastify@5 移除），每次首访都会额外打印一条
 * DeprecationWarning。定案改用 `req.routeOptions.url`（详见
 * docs/adr/0017-migration-baseline-and-boot-chain.md 增补第 8 项）。
 *
 * 关键断言是「读取 `routerPath` 即抛错」：这样任何回退到旧写法的改动都会直接红，
 * 而不是等到容器日志里冒告警才发现。
 */

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';

function makeContext(req: unknown, res: unknown = { statusCode: 200 }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

const nextOk: CallHandler = { handle: () => of('ok') };

function makeInterceptor() {
  const recordHttpRequest = jest.fn();
  const interceptor = new MetricsInterceptor({ recordHttpRequest } as never);
  return { interceptor, recordHttpRequest };
}

describe('MetricsInterceptor 路由标签', () => {
  it('用 routeOptions.url（路由模板）作标签，不用原始 URL，避免指标基数被 id 打散', async () => {
    const { interceptor, recordHttpRequest } = makeInterceptor();
    const req = {
      method: 'GET',
      routeOptions: { url: '/api/v1/employees/:id' },
      url: '/api/v1/employees/42',
    };

    await lastValueFrom(interceptor.intercept(makeContext(req), nextOk));

    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(recordHttpRequest.mock.calls[0][0]).toBe('GET');
    expect(recordHttpRequest.mock.calls[0][1]).toBe('/api/v1/employees/:id');
  });

  it('不读取已弃用的 req.routerPath', async () => {
    const { interceptor, recordHttpRequest } = makeInterceptor();
    const req: Record<string, unknown> = {
      method: 'GET',
      routeOptions: { url: '/api/v1/health' },
      url: '/api/v1/health',
    };
    Object.defineProperty(req, 'routerPath', {
      get() {
        throw new Error('读取了已弃用的 req.routerPath（FSTDEP017）');
      },
    });

    await expect(
      lastValueFrom(interceptor.intercept(makeContext(req), nextOk)),
    ).resolves.toBe('ok');
    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
  });

  it('routeOptions 缺失时回落到 req.url，不留 unknown', async () => {
    const { interceptor, recordHttpRequest } = makeInterceptor();
    const req = { method: 'GET', url: '/some/raw/path' };

    await lastValueFrom(interceptor.intercept(makeContext(req), nextOk));

    expect(recordHttpRequest.mock.calls[0][1]).toBe('/some/raw/path');
  });

  it('两者都缺失时记 unknown，而不是抛错', async () => {
    const { interceptor, recordHttpRequest } = makeInterceptor();

    await lastValueFrom(interceptor.intercept(makeContext({ method: 'GET' }), nextOk));

    expect(recordHttpRequest.mock.calls[0][1]).toBe('unknown');
  });

  it('异常路径同样记录指标，状态码取响应上的 statusCode', async () => {
    const { interceptor, recordHttpRequest } = makeInterceptor();
    const req = { method: 'POST', routeOptions: { url: '/api/v1/auth/login' }, url: '/api/v1/auth/login' };
    const nextError: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      lastValueFrom(interceptor.intercept(makeContext(req, { statusCode: 500 }), nextError)),
    ).rejects.toThrow('boom');

    expect(recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(recordHttpRequest.mock.calls[0][2]).toBe(500);
  });
});