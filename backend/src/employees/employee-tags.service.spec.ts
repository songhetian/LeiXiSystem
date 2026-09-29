import { EmployeeTagsService } from './employee-tags.service';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    employeeTag: {
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

describe('EmployeeTagsService - 错误码语义（不得复用考勤域 2001）', () => {
  let service: EmployeeTagsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new EmployeeTagsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('标签不存在：中央文案为「员工标签不存在」', async () => {
    prisma.employeeTag.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.update(999, { name: 'x' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('员工标签不存在');
  });

  it('标签名称已存在：中央文案为「标签名称已存在」', async () => {
    prisma.employeeTag.create.mockRejectedValue({ code: 'P2002' });

    const payload = await catchPayload(() => service.create({ name: '重点' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('标签名称已存在');
  });

  it('删除时标签不存在：中央文案为「员工标签不存在」', async () => {
    prisma.employeeTag.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.remove(999));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('员工标签不存在');
  });
});
