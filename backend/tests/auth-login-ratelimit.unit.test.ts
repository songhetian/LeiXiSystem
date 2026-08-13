import { UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { LoginRateLimitService } from '../src/auth/login-rate-limit.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

function build(rateLimitMock: any, user: any = null) {
  const prismaMock: any = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  };
  const jwtMock: any = { signAsync: jest.fn().mockResolvedValue('tok') };
  const svc = new AuthService(prismaMock, jwtMock, rateLimitMock);
  return { svc, prismaMock, jwtMock };
}

describe('T22.4 AuthService.login 接入登录限流', () => {
  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('已被限流(assertNotBlocked 抛 429)：登录直接抛 429，且不查库', async () => {
    const rateLimitMock: any = {
      assertNotBlocked: jest.fn().mockRejectedValue(
        new HttpException({ code: 5006, message: 'too many' }, HttpStatus.TOO_MANY_REQUESTS),
      ),
      registerFailure: jest.fn(),
      reset: jest.fn(),
    };
    const { svc, prismaMock } = build(rateLimitMock);
    let thrown: HttpException | null = null;
    try {
      await svc.login('alice', 'x');
    } catch (e) {
      thrown = e as HttpException;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('凭据错误：抛 401 且 registerFailure 被调用', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const rateLimitMock: any = {
      assertNotBlocked: jest.fn().mockResolvedValue(undefined),
      registerFailure: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    const { svc } = build(rateLimitMock, { id: 1, username: 'alice', passwordHash: 'h', roles: [] });
    let thrown: UnauthorizedException | null = null;
    try {
      await svc.login('alice', 'wrong');
    } catch (e) {
      thrown = e as UnauthorizedException;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(rateLimitMock.registerFailure).toHaveBeenCalledWith('alice');
  });

  it('凭据正确：返回 token 且 reset 被调用', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const rateLimitMock: any = {
      assertNotBlocked: jest.fn().mockResolvedValue(undefined),
      registerFailure: jest.fn(),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    const { svc } = build(rateLimitMock, {
      id: 1,
      username: 'alice',
      passwordHash: 'h',
      roles: [],
    });
    const res = await svc.login('alice', 'right');
    expect(res.accessToken).toBe('tok');
    expect(rateLimitMock.reset).toHaveBeenCalledWith('alice');
  });
});
