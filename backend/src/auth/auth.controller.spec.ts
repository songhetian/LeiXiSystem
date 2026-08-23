import { AuthController } from './auth.controller';

describe('AuthController (login throttle)', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController({} as any, {} as any);
  });

  it('登录接口应有限流装饰器（防暴力破解）', () => {
    const keys = Reflect.getMetadataKeys(controller.login);
    const hasThrottle = keys.some((k) => String(k).includes('throttler') || String(k).includes('THROTTLER'));

    expect(hasThrottle).toBe(true);
  });

  it('改密接口应有限流装饰器（防密码爆破）', () => {
    const keys = Reflect.getMetadataKeys(controller.changePassword);
    const hasThrottle = keys.some((k) => String(k).includes('throttler') || String(k).includes('THROTTLER'));

    expect(hasThrottle).toBe(true);
  });
});
