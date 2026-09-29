import { DictService } from './dict.service';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    dictType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dictItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
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

// 字典域原先使用 8001~8003 裸码，未登记到 ERROR_CODES / ERROR_MESSAGES。
// 裸码虽因过滤器 fallback 侥幸显示正确，但一旦码值被别处复用即会串文案，
// 且违反 core-contracts §2「新增错误码必须同时更新本表」的约定。
describe('DictService - 错误码须登记中央文案', () => {
  let service: DictService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DictService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('字典编码重复：抛出码须已注册，中央文案为「字典编码已存在」', async () => {
    prisma.dictType.findUnique.mockResolvedValue({ id: 1, code: 'X' });

    const payload = await catchPayload(() => service.createType({ code: 'X', name: 'X' }));

    expect(messageOf(payload.code)).toBe('字典编码已存在');
  });

  it('字典类型不存在：中央文案为「字典类型不存在」', async () => {
    prisma.dictType.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateType(999, { name: 'X' }));

    expect(messageOf(payload.code)).toBe('字典类型不存在');
  });

  it('字典项不存在：中央文案为「字典项不存在」', async () => {
    prisma.dictItem.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateItem(999, { label: 'X' }));

    expect(messageOf(payload.code)).toBe('字典项不存在');
  });
});
