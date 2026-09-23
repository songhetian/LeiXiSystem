import { ApprovalGroupService } from './approval-group.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

function createMockPrisma() {
  return {
    approvalGroup: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 1, code: 'AG', name: '组' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    approvalGroupMember: { findMany: jest.fn() },
  };
}

describe('ApprovalGroupService', () => {
  let service: ApprovalGroupService;
  let prisma: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ApprovalGroupService(prisma);
    jest.clearAllMocks();
  });

  describe('create - 编码自动生成', () => {
    it('未传编码时自动生成（前缀 AG + 时间戳 + 随机），避免手填英文编码', async () => {
      await service.create({ name: '财务审批组', createdBy: 1 });
      const data = prisma.approvalGroup.create.mock.calls[0][0].data;
      expect(data.code).toMatch(/^AG\d{17}$/);
      expect(data.name).toBe('财务审批组');
    });

    it('自动生成时不做编码查重', async () => {
      await service.create({ name: '人事审批组', createdBy: 1 });
      expect(prisma.approvalGroup.findUnique).not.toHaveBeenCalled();
    });

    it('手工传码时仍做查重并抛冲突', async () => {
      prisma.approvalGroup.findUnique.mockResolvedValue({ id: 1, code: 'finance' });
      await expect(
        service.create({ name: '财务', code: 'finance', createdBy: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.approvalGroup.create).not.toHaveBeenCalled();
    });
  });
});