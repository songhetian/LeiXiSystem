import { DataCleanupService } from './data-cleanup.service';

function generateMockIds(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
}

const mockPrisma: any = {
  operationLog: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  exportTask: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockSettingsService: any = {
  get: jest.fn(),
};

const mockOperationLogService: any = {
  createLog: jest.fn(),
};

describe('DataCleanupService', () => {
  let service: DataCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.operationLog.findMany.mockReset();
    mockPrisma.operationLog.deleteMany.mockReset();
    mockPrisma.notification.findMany.mockReset();
    mockPrisma.notification.deleteMany.mockReset();
    mockPrisma.exportTask.findMany.mockReset();
    mockPrisma.exportTask.deleteMany.mockReset();
    mockSettingsService.get.mockReset();
    mockOperationLogService.createLog.mockReset();
    service = new DataCleanupService(
      mockPrisma,
      mockSettingsService,
      mockOperationLogService,
    );
  });

  describe('cleanOperationLogs', () => {
    it('应删除保留期之前的操作日志', async () => {
      mockPrisma.operationLog.findMany.mockResolvedValue(generateMockIds(5));
      mockPrisma.operationLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanOperationLogs(180);

      expect(result).toBe(5);
      expect(mockPrisma.operationLog.findMany).toHaveBeenCalled();
      const findArgs = mockPrisma.operationLog.findMany.mock.calls[0][0];
      expect(findArgs.where.createdAt.lt).toBeInstanceOf(Date);
      expect(mockPrisma.operationLog.deleteMany).toHaveBeenCalled();
    });

    it('应分批删除大量数据', async () => {
      const batchSize = 1000;
      mockPrisma.operationLog.findMany
        .mockResolvedValueOnce(generateMockIds(batchSize))
        .mockResolvedValueOnce(generateMockIds(batchSize))
        .mockResolvedValueOnce(generateMockIds(500))
        .mockResolvedValueOnce([]);
      mockPrisma.operationLog.deleteMany
        .mockResolvedValueOnce({ count: batchSize })
        .mockResolvedValueOnce({ count: batchSize })
        .mockResolvedValueOnce({ count: 500 });

      const result = await service.cleanOperationLogs(180);

      expect(result).toBe(2500);
      expect(mockPrisma.operationLog.findMany).toHaveBeenCalledTimes(3);
      expect(mockPrisma.operationLog.deleteMany).toHaveBeenCalledTimes(3);
    });

    it('没有数据可删除时返回 0', async () => {
      mockPrisma.operationLog.findMany.mockResolvedValue([]);

      const result = await service.cleanOperationLogs(180);

      expect(result).toBe(0);
      expect(mockPrisma.operationLog.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('cleanNotifications', () => {
    it('应只删除已读的通知', async () => {
      mockPrisma.notification.findMany.mockResolvedValue(generateMockIds(10));
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.cleanNotifications(90);

      expect(result).toBe(10);
      const findArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(findArgs.where.read).toBe(true);
      expect(findArgs.where.createdAt.lt).toBeInstanceOf(Date);
    });

    it('未读通知不应被删除', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const result = await service.cleanNotifications(90);

      expect(result).toBe(0);
      const findArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(findArgs.where.read).toBe(true);
    });

    it('应分批删除大量通知', async () => {
      const batchSize = 1000;
      mockPrisma.notification.findMany
        .mockResolvedValueOnce(generateMockIds(batchSize))
        .mockResolvedValueOnce(generateMockIds(300))
        .mockResolvedValueOnce([]);
      mockPrisma.notification.deleteMany
        .mockResolvedValueOnce({ count: batchSize })
        .mockResolvedValueOnce({ count: 300 });

      const result = await service.cleanNotifications(90);

      expect(result).toBe(1300);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanExportTasks', () => {
    it('应删除保留期之前的导出任务', async () => {
      mockPrisma.exportTask.findMany.mockResolvedValue(generateMockIds(8));
      mockPrisma.exportTask.deleteMany.mockResolvedValue({ count: 8 });

      const result = await service.cleanExportTasks(30);

      expect(result).toBe(8);
      const findArgs = mockPrisma.exportTask.findMany.mock.calls[0][0];
      expect(findArgs.where.createdAt.lt).toBeInstanceOf(Date);
    });

    it('应分批删除大量导出任务', async () => {
      const batchSize = 1000;
      mockPrisma.exportTask.findMany
        .mockResolvedValueOnce(generateMockIds(batchSize))
        .mockResolvedValueOnce(generateMockIds(batchSize))
        .mockResolvedValueOnce([]);
      mockPrisma.exportTask.deleteMany
        .mockResolvedValueOnce({ count: batchSize })
        .mockResolvedValueOnce({ count: batchSize });

      const result = await service.cleanExportTasks(30);

      expect(result).toBe(2000);
      expect(mockPrisma.exportTask.findMany).toHaveBeenCalledTimes(3);
      expect(mockPrisma.exportTask.deleteMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanAll', () => {
    it('应执行全部清理并记录操作日志', async () => {
      mockSettingsService.get.mockRejectedValue(new Error('not found'));

      let opLogCallCount = 0;
      mockPrisma.operationLog.findMany.mockImplementation(() => {
        opLogCallCount++;
        if (opLogCallCount === 1) return Promise.resolve(generateMockIds(100));
        return Promise.resolve([]);
      });
      mockPrisma.operationLog.deleteMany.mockResolvedValue({ count: 100 });

      let notifCallCount = 0;
      mockPrisma.notification.findMany.mockImplementation(() => {
        notifCallCount++;
        if (notifCallCount === 1) return Promise.resolve(generateMockIds(50));
        return Promise.resolve([]);
      });
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 50 });

      let exportCallCount = 0;
      mockPrisma.exportTask.findMany.mockImplementation(() => {
        exportCallCount++;
        if (exportCallCount === 1) return Promise.resolve(generateMockIds(20));
        return Promise.resolve([]);
      });
      mockPrisma.exportTask.deleteMany.mockResolvedValue({ count: 20 });

      const result = await service.cleanAll();

      expect(result.operationLogs).toBe(100);
      expect(result.notifications).toBe(50);
      expect(result.exportTasks).toBe(20);
      expect(mockOperationLogService.createLog).toHaveBeenCalled();
      const logArgs = mockOperationLogService.createLog.mock.calls[0][0];
      expect(logArgs.module).toBe('system');
      expect(logArgs.action).toBe('data_cleanup');
      expect(logArgs.status).toBe('success');
    });

    it('没有数据被清理时不记录操作日志', async () => {
      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.operationLog.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.exportTask.findMany.mockResolvedValue([]);

      const result = await service.cleanAll();

      expect(result.operationLogs).toBe(0);
      expect(result.notifications).toBe(0);
      expect(result.exportTasks).toBe(0);
      expect(mockOperationLogService.createLog).not.toHaveBeenCalled();
    });

    it('应从系统设置读取各类型保留天数', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'retention.operation_log_days') {
          return Promise.resolve({ value: '365' });
        }
        if (key === 'retention.notification_days') {
          return Promise.resolve({ value: '60' });
        }
        if (key === 'retention.export_task_days') {
          return Promise.resolve({ value: '15' });
        }
        return Promise.reject(new Error('not found'));
      });
      mockPrisma.operationLog.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.exportTask.findMany.mockResolvedValue([]);

      await service.cleanAll();

      expect(mockSettingsService.get).toHaveBeenCalledWith('retention.operation_log_days');
      expect(mockSettingsService.get).toHaveBeenCalledWith('retention.notification_days');
      expect(mockSettingsService.get).toHaveBeenCalledWith('retention.export_task_days');
    });

    it('配置项无效时使用默认值', async () => {
      mockSettingsService.get.mockResolvedValue({ value: 'invalid' });
      mockPrisma.operationLog.findMany.mockResolvedValue([]);
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.exportTask.findMany.mockResolvedValue([]);

      await service.cleanAll();

      const opLogCall = mockPrisma.operationLog.findMany.mock.calls[0][0];
      const notifCall = mockPrisma.notification.findMany.mock.calls[0][0];
      const exportCall = mockPrisma.exportTask.findMany.mock.calls[0][0];

      const now = Date.now();
      const opLogExpected = now - 180 * 24 * 60 * 60 * 1000;
      const notifExpected = now - 90 * 24 * 60 * 60 * 1000;
      const exportExpected = now - 30 * 24 * 60 * 60 * 1000;

      expect(opLogCall.where.createdAt.lt.getTime()).toBeCloseTo(opLogExpected, -2);
      expect(notifCall.where.createdAt.lt.getTime()).toBeCloseTo(notifExpected, -2);
      expect(exportCall.where.createdAt.lt.getTime()).toBeCloseTo(exportExpected, -2);
    });
  });

  describe('幂等性', () => {
    it('重复执行不会出错', async () => {
      mockSettingsService.get.mockRejectedValue(new Error('not found'));

      let opLogCallCount = 0;
      mockPrisma.operationLog.findMany.mockImplementation(() => {
        opLogCallCount++;
        if (opLogCallCount === 1) return Promise.resolve(generateMockIds(100));
        return Promise.resolve([]);
      });
      mockPrisma.operationLog.deleteMany.mockResolvedValue({ count: 100 });

      let notifCallCount = 0;
      mockPrisma.notification.findMany.mockImplementation(() => {
        notifCallCount++;
        if (notifCallCount === 1) return Promise.resolve(generateMockIds(50));
        return Promise.resolve([]);
      });
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 50 });

      let exportCallCount = 0;
      mockPrisma.exportTask.findMany.mockImplementation(() => {
        exportCallCount++;
        if (exportCallCount === 1) return Promise.resolve(generateMockIds(20));
        return Promise.resolve([]);
      });
      mockPrisma.exportTask.deleteMany.mockResolvedValue({ count: 20 });

      const result1 = await service.cleanAll();
      const result2 = await service.cleanAll();

      expect(result1.operationLogs).toBe(100);
      expect(result2.operationLogs).toBe(0);
      expect(result1.notifications).toBe(50);
      expect(result2.notifications).toBe(0);
      expect(result1.exportTasks).toBe(20);
      expect(result2.exportTasks).toBe(0);
    });
  });
});
