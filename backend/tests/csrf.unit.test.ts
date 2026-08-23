import { CsrfService } from '../src/common/csrf.service';

function makeRedisMock() {
  const store: Record<string, string[]> = {};
  const client = {
    lpush: jest.fn((key: string, value: string) => {
      if (!store[key]) store[key] = [];
      store[key].unshift(value);
      return Promise.resolve(store[key].length);
    }),
    ltrim: jest.fn((key: string, start: number, stop: number) => {
      if (store[key]) {
        store[key] = store[key].slice(start, stop + 1);
      }
      return Promise.resolve('OK');
    }),
    expire: jest.fn((_k: string, _t: number) => Promise.resolve(1)),
    lrange: jest.fn((key: string, start: number, stop: number) => {
      const list = store[key] || [];
      const end = stop === -1 ? list.length : stop + 1;
      return Promise.resolve(list.slice(start, end));
    }),
    del: jest.fn((key: string) => {
      const existed = key in store;
      delete store[key];
      return Promise.resolve(existed ? 1 : 0);
    }),
    multi: jest.fn(() => {
      const pipeline: any[] = [];
      const multi = {
        lpush: (k: string, v: string) => {
          pipeline.push({ cmd: 'lpush', args: [k, v] });
          return multi;
        },
        ltrim: (k: string, s: number, e: number) => {
          pipeline.push({ cmd: 'ltrim', args: [k, s, e] });
          return multi;
        },
        expire: (k: string, t: number) => {
          pipeline.push({ cmd: 'expire', args: [k, t] });
          return multi;
        },
        exec: async () => {
          for (const op of pipeline) {
            if (op.cmd === 'lpush') await client.lpush(op.args[0], op.args[1]);
            if (op.cmd === 'ltrim') await client.ltrim(op.args[0], op.args[1], op.args[2]);
            if (op.cmd === 'expire') await client.expire(op.args[0], op.args[1]);
          }
          return pipeline.map(() => ['OK']);
        },
      };
      return multi;
    }),
  };
  const redis = {
    isEnabled: true,
    getClient: jest.fn(() => client),
    get: jest.fn((k: string) => Promise.resolve(store[k]?.[0] || null)),
    set: jest.fn(),
    del: jest.fn((k: string) => client.del(k)),
  };
  return { redis, client, store };
}

describe('CsrfService', () => {
  describe('generateToken', () => {
    it('生成 token 并以 list 存储到 Redis，返回 64 位 hex 字符串', async () => {
      const { redis, client } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      const token = await svc.generateToken(1);
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
      expect(client.multi).toHaveBeenCalled();
    });

    it('多次生成保留最近 N 个 token（支持多设备）', async () => {
      const { redis, client, store } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      const tokens: string[] = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(await svc.generateToken(1));
      }
      const stored = await client.lrange('csrf:1', 0, -1);
      expect(stored.length).toBe(5);
      expect(stored).toContain(tokens[9]);
      expect(stored).toContain(tokens[8]);
      expect(stored).not.toContain(tokens[0]);
    });

    it('Redis 未启用时，仍返回 token 字符串（降级）', async () => {
      const { redis, client } = makeRedisMock();
      redis.isEnabled = false;
      const svc = new CsrfService(redis as any);
      const token = await svc.generateToken(1);
      expect(typeof token).toBe('string');
      expect(client.multi).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('正确的 token 返回 true', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      const token = await svc.generateToken(1);
      const valid = await svc.validateToken(1, token);
      expect(valid).toBe(true);
    });

    it('多 token 中任意一个都能通过校验', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      const token1 = await svc.generateToken(1);
      const token2 = await svc.generateToken(1);
      const token3 = await svc.generateToken(1);
      expect(await svc.validateToken(1, token1)).toBe(true);
      expect(await svc.validateToken(1, token2)).toBe(true);
      expect(await svc.validateToken(1, token3)).toBe(true);
    });

    it('错误的 token 返回 false', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      await svc.generateToken(1);
      const valid = await svc.validateToken(1, 'a'.repeat(64));
      expect(valid).toBe(false);
    });

    it('长度不符的 token 直接拒绝', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      await svc.generateToken(1);
      expect(await svc.validateToken(1, '')).toBe(false);
      expect(await svc.validateToken(1, 'short')).toBe(false);
    });

    it('非 hex 字符的 token 返回 false', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      await svc.generateToken(1);
      expect(await svc.validateToken(1, 'g'.repeat(64))).toBe(false);
    });

    it('Redis 未启用时，返回 true（降级直通）', async () => {
      const { redis } = makeRedisMock();
      redis.isEnabled = false;
      const svc = new CsrfService(redis as any);
      const valid = await svc.validateToken(1, 'any-token');
      expect(valid).toBe(true);
    });

    it('不同用户的 token 不能交叉使用', async () => {
      const { redis } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      const user1Token = await svc.generateToken(1);
      const valid = await svc.validateToken(2, user1Token);
      expect(valid).toBe(false);
    });
  });

  describe('invalidateToken', () => {
    it('清除用户的所有 CSRF token', async () => {
      const { redis, client } = makeRedisMock();
      const svc = new CsrfService(redis as any);
      await svc.generateToken(1);
      await svc.generateToken(1);
      await svc.invalidateToken(1);
      const tokens = await client.lrange('csrf:1', 0, -1);
      expect(tokens.length).toBe(0);
    });
  });
});
