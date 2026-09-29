import { DeductionRulesService } from './deduction-rules.service';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    deductionRule: {
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

describe('DeductionRulesService - 错误码语义（不得复用班次码 2001）', () => {
  let service: DeductionRulesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DeductionRulesService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('扣款规则不存在：中央文案为「扣款规则不存在」', async () => {
    prisma.deductionRule.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.update(999, { name: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('扣款规则不存在');
  });

  it('扣款规则重名冲突：中央文案为「存在重名或冲突的扣款规则」', async () => {
    prisma.deductionRule.create.mockRejectedValue({ code: 'P2002' });

    const payload = await catchPayload(() => service.create({ name: '规则', type: 'late', method: 'fixed' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('存在重名或冲突的扣款规则');
  });

  it('删除时规则不存在：中央文案为「扣款规则不存在」', async () => {
    prisma.deductionRule.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.remove(999));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('扣款规则不存在');
  });
});
