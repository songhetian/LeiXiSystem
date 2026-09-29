import { AttendanceLocationsService } from './attendance-locations.service';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    attendanceLocation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

// 捕获异常 payload：全局过滤器会用 ERROR_MESSAGES[code] 覆盖抛出 message
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

describe('AttendanceLocationsService - 错误码语义（不得复用考勤域 2001）', () => {
  let service: AttendanceLocationsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AttendanceLocationsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('打卡定位不存在：中央文案为「打卡定位不存在」', async () => {
    prisma.attendanceLocation.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.update(999, { name: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('打卡定位不存在');
  });

  it('删除时打卡定位不存在：中央文案为「打卡定位不存在」', async () => {
    prisma.attendanceLocation.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.remove(999));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('打卡定位不存在');
  });
});
