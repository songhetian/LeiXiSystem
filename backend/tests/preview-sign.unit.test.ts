// S12 · 预览签名引擎 单元测试（TDD RED 先行）
// 预览 URL 签名生成与验证：HMAC + 时效，防止未授权访问
import { describe, it, expect } from '@jest/globals';
import { signPreviewUrl, verifyPreviewToken, type PreviewTokenPayload } from '../src/knowledge/engine/preview-sign';

describe('S12 · 预览签名引擎（纯函数）', () => {
  const secret = 'test-secret-key-12345';

  describe('signPreviewUrl — 生成签名', () => {
    it('应该生成包含 token 的签名结果', () => {
      const result = signPreviewUrl({
        fileUrl: 'https://oss.example.com/docs/xxx.pdf',
        fileName: '测试文档.pdf',
        secret,
        expiresIn: 3600,
      });
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('不同的 fileUrl 应该生成不同的 token', () => {
      const r1 = signPreviewUrl({ fileUrl: 'url1.pdf', fileName: '1', secret, expiresIn: 3600 });
      const r2 = signPreviewUrl({ fileUrl: 'url2.pdf', fileName: '2', secret, expiresIn: 3600 });
      expect(r1.token).not.toBe(r2.token);
    });
  });

  describe('verifyPreviewToken — 验证签名', () => {
    it('有效 token 应该验证通过并返回 payload', () => {
      const { token } = signPreviewUrl({
        fileUrl: 'https://oss.example.com/docs/test.pdf',
        fileName: '测试文档.pdf',
        secret,
        expiresIn: 3600,
      });

      const result = verifyPreviewToken(token, secret);
      expect(result.valid).toBe(true);
      expect((result.payload as PreviewTokenPayload).fileUrl).toBe('https://oss.example.com/docs/test.pdf');
      expect((result.payload as PreviewTokenPayload).fileName).toBe('测试文档.pdf');
    });

    it('过期 token 应该验证失败', () => {
      const { token } = signPreviewUrl({
        fileUrl: 'https://oss.example.com/docs/test.pdf',
        fileName: 'test.pdf',
        secret,
        expiresIn: -1,
      });

      const result = verifyPreviewToken(token, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('expired');
    });

    it('篡改后的 token 应该验证失败', () => {
      const { token } = signPreviewUrl({
        fileUrl: 'https://oss.example.com/docs/test.pdf',
        fileName: 'test.pdf',
        secret,
        expiresIn: 3600,
      });

      const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
      const result = verifyPreviewToken(tampered, secret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid');
    });

    it('错误的密钥应该验证失败', () => {
      const { token } = signPreviewUrl({
        fileUrl: 'https://oss.example.com/docs/test.pdf',
        fileName: 'test.pdf',
        secret: 'correct-secret',
        expiresIn: 3600,
      });

      const result = verifyPreviewToken(token, 'wrong-secret');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid');
    });
  });
});
