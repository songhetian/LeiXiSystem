import { validatePasswordStrength, PasswordStrengthLevel } from './password-strength.util';

describe('PasswordStrengthUtil', () => {
  describe('validatePasswordStrength — 弱等级（weak）', () => {
    const level: PasswordStrengthLevel = 'weak';

    it('密码长度 < 6 位时失败', () => {
      const result = validatePasswordStrength('12345', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码长度至少为 6 位');
    });

    it('密码长度 = 6 位时通过', () => {
      const result = validatePasswordStrength('123456', { level });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('密码长度 > 6 位时通过', () => {
      const result = validatePasswordStrength('1234567', { level });
      expect(result.valid).toBe(true);
    });

    it('弱等级下，纯字母也通过', () => {
      const result = validatePasswordStrength('abcdef', { level });
      expect(result.valid).toBe(true);
    });

    it('弱等级下，常见弱密码也通过（弱等级不校验弱密码）', () => {
      const result = validatePasswordStrength('123456', { level });
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePasswordStrength — 中等级（medium，默认）', () => {
    const level: PasswordStrengthLevel = 'medium';

    it('密码长度 < 8 位时失败', () => {
      const result = validatePasswordStrength('abc1234', { level });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('8 位'))).toBe(true);
    });

    it('只有字母没有数字时失败', () => {
      const result = validatePasswordStrength('abcdefgh', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含字母和数字');
    });

    it('只有数字没有字母时失败', () => {
      const result = validatePasswordStrength('12345678', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含字母和数字');
    });

    it('包含字母 + 数字且长度 8 位时通过', () => {
      const result = validatePasswordStrength('abcd1234', { level });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('包含字母 + 数字且长度 > 8 位时通过', () => {
      const result = validatePasswordStrength('abcd12345', { level });
      expect(result.valid).toBe(true);
    });

    it('密码与用户名相同时失败', () => {
      const result = validatePasswordStrength('testuser123', { level, username: 'testuser123' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码不能与用户名相同');
    });

    it('密码与用户名不同时通过', () => {
      const result = validatePasswordStrength('abcd1234', { level, username: 'testuser' });
      expect(result.valid).toBe(true);
    });

    it('常见弱密码（如 12345678）时失败', () => {
      const result = validatePasswordStrength('12345678', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码过于简单，请使用更复杂的密码');
    });

    it('常见弱密码（如 password）时失败', () => {
      const result = validatePasswordStrength('password1', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码过于简单，请使用更复杂的密码');
    });

    it('默认等级为 medium', () => {
      const result = validatePasswordStrength('123456');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePasswordStrength — 强等级（strong）', () => {
    const level: PasswordStrengthLevel = 'strong';

    it('密码长度 < 10 位时失败', () => {
      const result = validatePasswordStrength('Abc123456', { level });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('10 位'))).toBe(true);
    });

    it('没有大写字母时失败', () => {
      const result = validatePasswordStrength('abcd123456!', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含大写字母');
    });

    it('没有小写字母时失败', () => {
      const result = validatePasswordStrength('ABCD123456!', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含小写字母');
    });

    it('没有数字时失败', () => {
      const result = validatePasswordStrength('Abcdefghij!', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含数字');
    });

    it('没有特殊字符时失败', () => {
      const result = validatePasswordStrength('Abcd123456', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含特殊字符');
    });

    it('包含大小写字母 + 数字 + 特殊字符且长度 10 位时通过', () => {
      const result = validatePasswordStrength('Abcd1234!@', { level });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('包含大小写字母 + 数字 + 特殊字符且长度 > 10 位时通过', () => {
      const result = validatePasswordStrength('Abcd12345!@#', { level });
      expect(result.valid).toBe(true);
    });

    it('密码与用户名相同时失败', () => {
      const result = validatePasswordStrength('Testuser123!', { level, username: 'Testuser123!' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码不能与用户名相同');
    });

    it('常见弱密码时失败', () => {
      const result = validatePasswordStrength('Password123', { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码过于简单，请使用更复杂的密码');
    });

    it('支持多种特殊字符', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '[', ']', '{', '}', '|', ';', ':', ',', '.', '<', '>', '?', '/'];
      for (const char of specialChars) {
        const result = validatePasswordStrength(`Abc123456${char}`, { level });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validatePasswordStrength — 常见弱密码校验', () => {
    const level: PasswordStrengthLevel = 'medium';

    const weakPasswords = [
      '12345678',
      '123456789',
      'password',
      'password1',
      'qwerty123',
      'abc12345',
      '11111111',
      '00000000',
      'admin123',
      'letmein1',
      'welcome1',
      'monkey123',
      'dragon123',
      'master123',
      '1234qwer',
      '12345678a',
      'a12345678',
      'password123',
      'iloveyou1',
      'trustno1',
    ];

    it.each(weakPasswords)('弱密码 %p 应该被拒绝', (pwd) => {
      const result = validatePasswordStrength(pwd, { level });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码过于简单，请使用更复杂的密码');
    });
  });

  describe('validatePasswordStrength — 边界情况', () => {
    it('空密码应该失败', () => {
      const result = validatePasswordStrength('');
      expect(result.valid).toBe(false);
    });

    it('null 或 undefined 密码应该失败', () => {
      const result1 = validatePasswordStrength(null as any);
      expect(result1.valid).toBe(false);
      const result2 = validatePasswordStrength(undefined as any);
      expect(result2.valid).toBe(false);
    });

    it('错误的等级应该降级到 medium', () => {
      const result = validatePasswordStrength('abcd1234', { level: 'invalid' as any });
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePasswordStrength — 多错误提示', () => {
    it('多个规则不满足时，返回所有错误', () => {
      const result = validatePasswordStrength('abc', { level: 'strong' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
