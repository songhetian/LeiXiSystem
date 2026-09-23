import { leaveDateKeys, toDateOnly } from '@/lib/leave-days';

describe('toDateOnly', () => {
  it('已归一化的 YYYY-MM-DD 原样返回', () => {
    expect(toDateOnly('2026-08-10')).toBe('2026-08-10');
  });
  it('ISO datetime 串裁剪为 YYYY-MM-DD', () => {
    expect(toDateOnly('2026-08-10T00:00:00.000Z')).toBe('2026-08-10');
  });
  it('空值/无法解析返回空串', () => {
    expect(toDateOnly(undefined)).toBe('');
    expect(toDateOnly('')).toBe('');
  });
});

describe('leaveDateKeys', () => {
  it('将纯 YYYY-MM-DD 起止日期展开为逐日 员工_日期 键', () => {
    expect(leaveDateKeys(7, '2026-08-10', '2026-08-12')).toEqual([
      '7_2026-08-10',
      '7_2026-08-11',
      '7_2026-08-12',
    ]);
  });

  it('兼容后端返回的 ISO datetime 串（请假显示不丢失）', () => {
    expect(leaveDateKeys(7, '2026-08-10T00:00:00.000Z', '2026-08-12T00:00:00.000Z')).toEqual([
      '7_2026-08-10',
      '7_2026-08-11',
      '7_2026-08-12',
    ]);
  });

  it('单日请假只生成一个键', () => {
    expect(leaveDateKeys(3, '2026-08-01', '2026-08-01')).toEqual(['3_2026-08-01']);
  });

  it('起始晚于结束或日期缺失返回空数组', () => {
    expect(leaveDateKeys(7, '2026-08-13', '2026-08-12')).toEqual([]);
    expect(leaveDateKeys(7, undefined, '2026-08-12')).toEqual([]);
    expect(leaveDateKeys(7, '2026-08-10', undefined)).toEqual([]);
  });
});