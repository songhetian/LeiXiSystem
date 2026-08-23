import { sanitizeCell } from '@/lib/excel';

describe('sanitizeCell 公式注入防护', () => {
  it('数值原样返回', () => {
    expect(sanitizeCell(123)).toBe(123);
    expect(sanitizeCell(0)).toBe(0);
  });

  it('以 = 开头的文本前置单引号', () => {
    expect(sanitizeCell('=HYPERLINK("http://evil.com")')).toBe("'=HYPERLINK(\"http://evil.com\")");
  });

  it('以 + - @ 开头的文本前置单引号', () => {
    expect(sanitizeCell('+1+1')).toBe("'+1+1");
    expect(sanitizeCell('-1+2')).toBe("'-1+2");
    expect(sanitizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('以 Tab / 回车开头的文本前置单引号', () => {
    expect(sanitizeCell('\t=cmd')).toBe("'\t=cmd");
    expect(sanitizeCell('\r=cmd')).toBe("'\r=cmd");
  });

  it('普通文本不受影响', () => {
    const v = '张三';
    expect(sanitizeCell(v)).toBe(v);
  });

  it('空串与数字字符串不受影响', () => {
    expect(sanitizeCell('')).toBe('');
    expect(sanitizeCell('42')).toBe('42');
  });
});