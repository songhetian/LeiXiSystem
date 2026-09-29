import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { PunchMakeupController } from './punch-makeup.controller';

// 补卡类型值域必须与审批监听器（attendance-approval.listener.ts）一致：
// 领域口径（C3）只有「上班卡=当日首次打卡」「下班卡=当日最后一次打卡」两种，
// 前端历史值 morning/evening/noon_* 在后端无对应字段，属值域分裂。
describe('PunchMakeupController · 补卡入参值域校验', () => {
  let controller: PunchMakeupController;
  let service: any;
  const req = { user: { id: 7 } };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 1, punchType: 'check_in' }),
      update: jest.fn().mockResolvedValue({ id: 1, punchType: 'check_in' }),
    };
    controller = new PunchMakeupController(service);
  });

  it('接受合法补卡类型 check_in / check_out', async () => {
    const res = await controller.create(
      {
        punchDate: '2026-08-10',
        punchType: 'check_in',
        originalTime: '08:55:00',
        makeupTime: '08:56',
        reason: '地铁延误',
      } as any,
      req,
    );

    expect(res.code).toBe(0);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ punchType: 'check_in', userId: 7 }),
    );
  });

  it('拒绝未定义的补卡类型（如旧的 morning）', async () => {
    await expect(
      controller.create(
        { punchDate: '2026-08-10', punchType: 'morning', reason: '地铁延误' } as any,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('拒绝午休补卡类型（后端无对应打卡字段）', async () => {
    await expect(
      controller.create(
        { punchDate: '2026-08-10', punchType: 'noon_morning', reason: '午休' } as any,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('拒绝非法日期与时间格式', async () => {
    await expect(
      controller.create(
        { punchDate: '2026/08/10', punchType: 'check_in', reason: '格式错误' } as any,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.create(
        { punchDate: '2026-08-10', punchType: 'check_in', makeupTime: '8:5', reason: '格式错误' } as any,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('缺少补卡原因时拒绝', async () => {
    await expect(
      controller.create({ punchDate: '2026-08-10', punchType: 'check_in' } as any, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update 同样校验补卡类型', async () => {
    const res = await controller.update(1, { punchType: 'check_out' } as any, req);
    expect(res.code).toBe(0);
    expect(service.update).toHaveBeenCalledWith(1, 7, expect.objectContaining({ punchType: 'check_out' }));

    await expect(
      controller.update(1, { punchType: 'evening' } as any, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});