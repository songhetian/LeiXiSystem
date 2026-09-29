import { generateAutoCode } from './code-gen.util';

describe('code-gen.util - 业务编码自动生成', () => {
  it('返回 prefix + 正确长度的日期时间 + 3位随机数', () => {
    const code = generateAutoCode('ET');
    // ET + 14位日期时间 + 3位随机
    expect(code).toMatch(/^ET\d{17}$/);
  });

  it('保留调用方指定的前缀（用于区分实体命名空间）', () => {
    expect(generateAutoCode('ROLE')).toMatch(/^ROLE\d{17}$/);
    expect(generateAutoCode('WF')).toMatch(/^WF\d{17}$/);
    expect(generateAutoCode('AG')).toMatch(/^AG\d{17}$/);
  });

  it('日期时间部分为 14 位（YYYYMMDDHHmmss）', () => {
    const code = generateAutoCode('ET');
    const ts = code.slice(2, 2 + 14);
    expect(/^\d{14}$/.test(ts)).toBe(true);
  });

  it('时间戳按北京时间生成：UTC 宿主机不得错位 8 小时', () => {
    // 该用例在 Asia/Shanghai 宿主机上与旧实现同解；须以 TZ=UTC（生产容器默认）运行才呈负例。
    jest.useFakeTimers().setSystemTime(new Date('2026-09-26T18:30:45Z'));
    try {
      // UTC 18:30:45 → 北京 2026-09-27 02:30:45
      expect(generateAutoCode('BX')).toMatch(/^BX20260927023045\d{3}$/);
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * 同一秒内连续生成必须互不重复。
   *
   * 原实现只靠 3 位随机数区分同秒调用，碰撞概率 1/1000：报销单号（BX）尚有
   * P2002 重试兜底，但报销类型编码（ET，reimbursement.service.createType）
   * 没有任何重试，一次碰撞就抛「报销类型编码已存在」，把用户挡在门外；
   * 单元测试「生成的单号在不同调用之间不重复」也会因此偶发失败。
   * 唯一性不应靠概率保证：同秒内改为在上一枚后缀上单调递增。
   */
  it('同一秒内连续生成也必须互不重复（随机数碰撞不得导致重码）', () => {
    // 固定随机源，模拟同秒内随机数恰好碰撞
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.424);
    try {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) codes.add(generateAutoCode('ET'));
      expect(codes.size).toBe(50);
    } finally {
      spy.mockRestore();
    }
  });
});