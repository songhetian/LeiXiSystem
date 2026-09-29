import { ExceptionRulesService } from './exception-rules.service';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    attendanceExceptionRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    attendanceException: {
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

describe('ExceptionRulesService - 错误码语义（不得复用班次码 2001）', () => {
  let service: ExceptionRulesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ExceptionRulesService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('异常规则不存在：中央文案为「异常规则不存在」', async () => {
    prisma.attendanceExceptionRule.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateRule(999, { name: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('异常规则不存在');
  });

  it('异常规则重名冲突：中央文案为「存在重名或冲突的异常规则」', async () => {
    prisma.attendanceExceptionRule.create.mockRejectedValue({ code: 'P2002' });

    const payload = await catchPayload(() => service.createRule({ name: '规则', type: 'late' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('存在重名或冲突的异常规则');
  });

  it('阈值大于阈值上限：中央文案为「阈值不能大于阈值上限」', async () => {
    const payload = await catchPayload(() =>
      service.createRule({ name: '规则', type: 'late', threshold: 30, thresholdMax: 10 }),
    );

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('阈值不能大于阈值上限');
  });

  it('扣款分钟数为负：中央文案为「扣款分钟数不能为负数」', async () => {
    const payload = await catchPayload(() =>
      service.createRule({ name: '规则', type: 'late', deductMinutes: -1 }),
    );

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('扣款分钟数不能为负数');
  });

  it('异常记录不存在：中央文案为「异常记录不存在」', async () => {
    prisma.attendanceException.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.handleException(999, { status: 'resolved' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('异常记录不存在');
  });
});
