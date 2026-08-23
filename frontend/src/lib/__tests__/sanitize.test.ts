import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitize', () => {
  describe('sanitizeHtml', () => {
    it('空输入返回空字符串', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml('')).toBe('');
    });

    it('移除 script 标签', () => {
      const dirty = '<p>hello</p><script>alert("xss")</script>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('hello');
    });

    it('移除 on* 事件属性', () => {
      const dirty = '<img src="x" onerror="alert(1)">';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onerror');
    });

    it('保留安全标签', () => {
      const dirty = '<p><strong>hello</strong></p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toContain('<strong>');
      expect(clean).toContain('hello');
    });

    it('移除 iframe 标签', () => {
      const dirty = '<p>text</p><iframe src="https://evil.com"></iframe>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<iframe>');
      expect(clean).toContain('text');
    });

    it('移除 javascript: 协议的链接', () => {
      const dirty = '<a href="javascript:alert(1)">click</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
    });
  });
});
