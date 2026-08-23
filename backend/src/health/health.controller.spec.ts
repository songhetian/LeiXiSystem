import { HealthController } from './health.controller';

function createMockRedis(enabled: boolean, pongResult?: string | null) {
  return {
    isEnabled: enabled,
    ping: jest.fn().mockResolvedValue(pongResult !== undefined ? pongResult : 'PONG'),
  } as any;
}

function createMockPrisma(queryRawResult?: 'ok' | 'error') {
  const $queryRaw = jest.fn();
  if (queryRawResult === 'error') {
    $queryRaw.mockRejectedValue(new Error('Connection lost'));
  } else {
    $queryRaw.mockResolvedValue([{ '1': 1 }]);
  }
  return { $queryRaw } as any;
}

function createMockReply() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as any;
}

describe('HealthController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('数据库连通时 database=up 且 overall status=up', async () => {
    const redis = createMockRedis(false);
    const prisma = createMockPrisma('ok');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.data.checks.database.status).toBe('up');
    expect(result.data.status).toBe('up');
    expect(result.data.version).toBeDefined();
    expect(typeof result.data.uptime).toBe('number');
    expect(result.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('数据库断连时 database=down 且 overall status=down', async () => {
    const redis = createMockRedis(false);
    const prisma = createMockPrisma('error');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.data.checks.database.status).toBe('down');
    expect(result.data.status).toBe('down');
  });

  it('数据库 up 且 Redis up 时 overall status=up', async () => {
    const redis = createMockRedis(true, 'PONG');
    const prisma = createMockPrisma('ok');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(result.data.checks.database.status).toBe('up');
    expect(result.data.checks.redis.status).toBe('up');
    expect(result.data.status).toBe('up');
  });

  it('数据库 down 但 Redis up 时 overall status=down', async () => {
    const redis = createMockRedis(true, 'PONG');
    const prisma = createMockPrisma('error');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(result.data.checks.database.status).toBe('down');
    expect(result.data.checks.redis.status).toBe('up');
    expect(result.data.status).toBe('down');
  });

  it('数据库 up 但 Redis down 时 overall status=down', async () => {
    const redis = createMockRedis(true, null);
    const prisma = createMockPrisma('ok');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(result.data.checks.database.status).toBe('up');
    expect(result.data.checks.redis.status).toBe('down');
    expect(result.data.status).toBe('down');
  });

  it('Redis 未启用时 redis=disabled，不影响 DB 检测', async () => {
    const redis = createMockRedis(false);
    const prisma = createMockPrisma('ok');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(result.data.checks.redis.status).toBe('disabled');
    expect(result.data.checks.database.status).toBe('up');
    expect(result.data.status).toBe('up');
  });

  it('响应时间字段存在且为数字', async () => {
    const redis = createMockRedis(true, 'PONG');
    const prisma = createMockPrisma('ok');
    const controller = new HealthController(redis, prisma);
    const reply = createMockReply();

    const result = await controller.health(reply);

    expect(typeof result.data.checks.database.responseTimeMs).toBe('number');
    expect(typeof result.data.checks.redis.responseTimeMs).toBe('number');
  });

  it('/live 端点返回 version 和 uptime，不检查依赖', async () => {
    const redis = createMockRedis(false);
    const prisma = createMockPrisma('error');
    const controller = new HealthController(redis, prisma);

    const result = controller.live();

    expect(result.data.status).toBe('up');
    expect(result.data.version).toBeDefined();
    expect(typeof result.data.uptime).toBe('number');
    expect((result.data as any).checks).toBeUndefined();
  });
});
