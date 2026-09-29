import {
  getOvertimeToLeaveHours,
  DEFAULT_OVERTIME_TO_LEAVE_HOURS,
  overtimeHoursToLeaveDays,
} from './overtime-conversion';
import { Prisma } from '@prisma/client';

function reader(value: string | null | undefined, opts: { throws?: boolean } = {}) {
  return {
    systemSetting: {
      findUnique: jest.fn(() => {
        if (opts.throws) return Promise.reject(new Error('db down'));
        return Promise.resolve(value === undefined ? null : { value });
      }),
    },
  };
}

describe('overtime-conversion - 加班转调休折算口径', () => {
  it('读取系统设置中的折算小时数', async () => {
    await expect(getOvertimeToLeaveHours(reader('12'))).resolves.toBe(12);
  });

  it('设置缺失或非法时回退默认 8 小时', async () => {
    await expect(getOvertimeToLeaveHours(reader(undefined))).resolves.toBe(
      DEFAULT_OVERTIME_TO_LEAVE_HOURS,
    );
    await expect(getOvertimeToLeaveHours(reader('abc'))).resolves.toBe(
      DEFAULT_OVERTIME_TO_LEAVE_HOURS,
    );
    await expect(getOvertimeToLeaveHours(reader('0'))).resolves.toBe(
      DEFAULT_OVERTIME_TO_LEAVE_HOURS,
    );
  });

  it('读库异常必须抛出：不得静默回退 8（否则发放/扣回比率漂移）', async () => {
    await expect(getOvertimeToLeaveHours(reader(null, { throws: true }))).rejects.toThrow(
      'db down',
    );
  });

  it('加班小时按费率折算为调休天数（Decimal，无浮点误差）', () => {
    expect(overtimeHoursToLeaveDays(new Prisma.Decimal('7.5'), 8).toString()).toBe('0.9375');
    expect(overtimeHoursToLeaveDays(9, 8).toString()).toBe('1.125');
  });
});