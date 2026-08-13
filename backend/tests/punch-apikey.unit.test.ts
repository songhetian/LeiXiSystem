import { PunchSyncService } from '../src/attendance/punch-sync.service';

describe('T20 打卡机 apiKey 接入', () => {
  let fetchSpy: jest.SpyInstance;
  let service: PunchSyncService;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ ret: 0, rows: [] }) } as any);
    service = new PunchSyncService({} as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('T20.1 fetchFromDevice 携带 apiKey', () => {
    it('给定 apiKey：请求 URL 带 key=<apiKey> query 参数', async () => {
      await service.fetchFromDevice('192.168.1.100', 80, null, 'device-secret-key');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('key=device-secret-key');
    });

    it('无 apiKey：请求 URL 不含 key 参数（向后兼容旧设备）', async () => {
      await service.fetchFromDevice('192.168.1.100', 80, null, undefined);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('key=');
    });
  });

  describe('T20.2 syncNow 把 device.apiKey 透传给 fetchFromDevice', () => {
    it('设备含 apiKey：fetchFromDevice 以第 4 参数收到该 key', async () => {
      const prisma = {
        punchDevice: {
          findMany: jest.fn().mockResolvedValue([
            {
              deviceNo: 'DEV001',
              ipAddress: '192.168.1.100',
              port: 80,
              apiKey: 'dev-key-123',
              enabled: true,
              status: 'online',
            },
          ]),
        },
        punchSyncState: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({}),
        },
        employee: { findMany: jest.fn().mockResolvedValue([]) },
        punchLog: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn({ punchLog: { create: jest.fn() } })),
      } as any;

      const svc = new PunchSyncService(prisma);
      const fetchSpy2 = jest
        .spyOn(svc, 'fetchFromDevice')
        .mockResolvedValue({ ret: 0, rows: [] });

      await svc.syncNow();

      expect(fetchSpy2).toHaveBeenCalledTimes(1);
      const apiKeyArg = fetchSpy2.mock.calls[0][3];
      expect(apiKeyArg).toBe('dev-key-123');
    });
  });
});
