import { describe, expect, it } from 'vitest';
import { okay, fail } from './apiEnvelope';

describe('apiEnvelope', () => {
  describe('okay()', () => {
    it('成功时 data 透传、message 默认空串', () => {
      const res = okay({ id: 1 });
      expect(res).toEqual({ success: true, data: { id: 1 }, message: '' });
    });

    it('不发 data 时产出 null 而非 undefined（JSON 序列化友好）', () => {
      expect(okay()).toEqual({ success: true, data: null, message: '' });
    });
  });

  describe('fail()', () => {
    it('失败带 message，data 固定为 null', () => {
      const res = fail('参数不合法');
      expect(res).toEqual({ success: false, data: null, message: '参数不合法' });
    });
  });
});