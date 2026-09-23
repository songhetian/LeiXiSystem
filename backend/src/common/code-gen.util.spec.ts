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
});