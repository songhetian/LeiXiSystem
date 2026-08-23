import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Minimal Socket shape used by the gateway — only the members we touch in
 * tests are mocked.
 */
function createMockSocket(
  handshake: { auth?: { token?: string }; headers?: { authorization?: string } },
  id = 'test-client-id',
) {
  const join = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn();
  return {
    id,
    handshake,
    data: {} as Record<string, unknown>,
    join,
    disconnect,
  } as any;
}

/** Minimal Server shape: `to(room)` returns a stub with `emit`. */
function createMockServer() {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return { to, emit, _emit: emit } as any;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let redis: { isEnabled: boolean; get: jest.Mock };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    redis = { isEnabled: false, get: jest.fn() };
    gateway = new RealtimeGateway(jwtService as any, redis as any);
    // Inject a mock Socket.IO server so the @WebSocketServer property is set.
    gateway.server = createMockServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // handleConnection — valid JWT via auth.token
  // ------------------------------------------------------------------
  it('joins user:<userId> room on valid JWT from handshake.auth.token', async () => {
    const client = createMockSocket({ auth: { token: 'valid.jwt.token' } });
    jwtService.verifyAsync.mockResolvedValue({ sub: 1, username: 'alice' });

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
    expect(client.join).toHaveBeenCalledWith('user:1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // handleConnection — valid JWT via Authorization header
  // ------------------------------------------------------------------
  it('joins user:<userId> room on valid JWT from Authorization header', async () => {
    const client = createMockSocket({
      headers: { authorization: 'Bearer header.jwt.token' },
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: 42, username: 'bob' });

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('header.jwt.token');
    expect(client.join).toHaveBeenCalledWith('user:42');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // handleConnection — missing token
  // ------------------------------------------------------------------
  it('disconnects when no token is provided', async () => {
    const client = createMockSocket({});

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // handleConnection — invalid / unverifiable JWT
  // ------------------------------------------------------------------
  it('disconnects when JWT verification throws', async () => {
    const client = createMockSocket({ auth: { token: 'bad.token' } });
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('bad.token');
    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // handleConnection — valid token but no `sub` claim
  // ------------------------------------------------------------------
  it('disconnects when the decoded JWT has no sub claim', async () => {
    const client = createMockSocket({ auth: { token: 'token.without.sub' } });
    jwtService.verifyAsync.mockResolvedValue({ username: 'ghost' } as any);

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // @OnEvent('notification.created') handler
  // ------------------------------------------------------------------
  describe('handleNotificationCreated', () => {
    it('emits the notification payload to the user room', () => {
      const payload = {
        id: 99,
        userId: 7,
        title: '工资条已发布',
        content: '您1月的工资条已发布',
        type: 'payslip',
        relatedId: 1,
        relatedType: 'payroll_run',
      };

      gateway.handleNotificationCreated(payload);

      expect(gateway.server.to).toHaveBeenCalledWith('user:7');
      expect(gateway.server.to('user:7').emit).toHaveBeenCalledWith(
        'notification',
        payload,
      );
    });

    it('does not throw when server is not initialised', () => {
      // Simulate the scenario where the WebSocket adapter hasn't attached
      // a server yet (e.g. during unit / e2e tests that call app.init()
      // without listen()).
      const g = new RealtimeGateway(jwtService as any, { isEnabled: false, get: jest.fn() } as any);
      g.server = undefined as any;

      expect(() =>
        g.handleNotificationCreated({ userId: 1, title: 'test' }),
      ).not.toThrow();
    });

    it('skips emission when payload has no userId', () => {
      gateway.handleNotificationCreated({ title: 'no-user' } as any);
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('works for createMany-style payloads (no id field)', () => {
      const payload = {
        userId: 3,
        title: '系统公告',
        content: '全体员工注意',
        type: 'broadcast',
        relatedId: 10,
        relatedType: 'broadcast',
      };

      gateway.handleNotificationCreated(payload);

      expect(gateway.server.to).toHaveBeenCalledWith('user:3');
      expect(gateway.server.to('user:3').emit).toHaveBeenCalledWith(
        'notification',
        payload,
      );
    });
  });

  // ------------------------------------------------------------------
  // @OnEvent('auth.session_replaced') — single device login kicked_out
  // ------------------------------------------------------------------
  describe('handleSessionReplaced', () => {
    it('emits kicked_out event to user room', () => {
      const payload = { userId: 7, message: '您的账号在其他设备登录' };

      gateway.handleSessionReplaced(payload);

      expect(gateway.server.to).toHaveBeenCalledWith('user:7');
      expect(gateway.server.to('user:7').emit).toHaveBeenCalledWith(
        'kicked_out',
        expect.objectContaining({
          userId: 7,
          message: '您的账号在其他设备登录',
        }),
      );
    });

    it('does not throw when server is not initialised', () => {
      const g = new RealtimeGateway(jwtService as any, { isEnabled: false, get: jest.fn() } as any);
      g.server = undefined as any;

      expect(() =>
        g.handleSessionReplaced({ userId: 1, message: 'test' }),
      ).not.toThrow();
    });

    it('skips emission when payload has no userId', () => {
      gateway.handleSessionReplaced({ message: 'no-user' } as any);
      expect(gateway.server.to).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // handleConnection — JWT 黑名单检查
  // ------------------------------------------------------------------
  describe('JWT 黑名单', () => {
    let redis: { isEnabled: boolean; get: jest.Mock };

    beforeEach(() => {
      redis = { isEnabled: true, get: jest.fn() };
      gateway = new RealtimeGateway(jwtService as any, redis as any);
      gateway.server = createMockServer();
    });

    it('token 在黑名单中时断开连接', async () => {
      const client = createMockSocket({ auth: { token: 'blacklisted.jwt' } });
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, username: 'alice', jti: 'jti-123' });
      redis.get.mockResolvedValue('1');

      await gateway.handleConnection(client);

      expect(redis.get).toHaveBeenCalledWith('auth:blacklist:jti-123');
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('token 不在黑名单中时正常加入房间', async () => {
      const client = createMockSocket({ auth: { token: 'valid.jwt' } });
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, username: 'alice', jti: 'jti-456' });
      redis.get.mockResolvedValue(null);

      await gateway.handleConnection(client);

      expect(redis.get).toHaveBeenCalledWith('auth:blacklist:jti-456');
      expect(client.join).toHaveBeenCalledWith('user:1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('Redis 不可用时跳过黑名单检查（降级）', async () => {
      redis.isEnabled = false;
      const client = createMockSocket({ auth: { token: 'valid.jwt' } });
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, username: 'alice', jti: 'jti-789' });

      await gateway.handleConnection(client);

      expect(redis.get).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:1');
    });

    it('token 没有 jti 时跳过黑名单检查', async () => {
      const client = createMockSocket({ auth: { token: 'old.jwt' } });
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, username: 'alice' });

      await gateway.handleConnection(client);

      expect(redis.get).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:1');
    });
  });

  // ------------------------------------------------------------------
  // @OnEvent('auth.logout') handler — 退出时主动断开所有连接
  // ------------------------------------------------------------------
  describe('handleLogout', () => {
    let redis: { isEnabled: boolean; get: jest.Mock };

    beforeEach(() => {
      redis = { isEnabled: true, get: jest.fn() };
      gateway = new RealtimeGateway(jwtService as any, redis as any);
      gateway.server = createMockServer();
    });

    it('收到 auth.logout 事件时断开对应用户的所有连接', () => {
      const disconnectSockets = jest.fn();
      (gateway.server as any).in = jest.fn().mockReturnValue({ disconnectSockets });

      gateway.handleLogout({ userId: 5 });

      expect(gateway.server.in).toHaveBeenCalledWith('user:5');
      expect(disconnectSockets).toHaveBeenCalledWith(true);
    });

    it('server 未初始化时不报错', () => {
      const g = new RealtimeGateway(jwtService as any, redis as any);
      g.server = undefined as any;
      expect(() => g.handleLogout({ userId: 1 })).not.toThrow();
    });
  });

  // ------------------------------------------------------------------
  // handleDisconnect
  // ------------------------------------------------------------------
  it('handleDisconnect does not throw', () => {
    const client = createMockSocket({});
    expect(() => gateway.handleDisconnect(client)).not.toThrow();
  });
});
