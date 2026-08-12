// S01 · shared 包 TDD — 工号 schema（对齐 CONTEXT.md A7 校验规则）
import { describe, it, expect } from 'vitest';
import { employeeNoSchema } from '../src/schemas/employeeNo';

describe('employeeNoSchema（工号规则 ^[A-Za-z0-9-]{2,20}$）', () => {
  // ---- 正常用例 ----
  it('接受合法工号：字母数字组合', () => {
    expect(employeeNoSchema.parse('EMP001')).toBe('EMP001');
  });
  it('接受合法工号：包含连字符', () => {
    expect(employeeNoSchema.parse('ab-12')).toBe('ab-12');
  });

  // ---- 边界用例 ----
  it('边界：2 位工号通过', () => {
    expect(employeeNoSchema.parse('ab')).toBe('ab');
  });
  it('边界：20 位工号通过', () => {
    expect(employeeNoSchema.parse('A'.repeat(20))).toBe('A'.repeat(20));
  });
  it('边界：1 位工号拒绝', () => {
    expect(() => employeeNoSchema.parse('a')).toThrow();
  });
  it('边界：21 位工号拒绝', () => {
    expect(() => employeeNoSchema.parse('A'.repeat(21))).toThrow();
  });

  // ---- 异常用例 ----
  it('异常：含下划线拒绝', () => {
    expect(() => employeeNoSchema.parse('emp_01')).toThrow();
  });
  it('异常：含中文拒绝', () => {
    expect(() => employeeNoSchema.parse('员工001')).toThrow();
  });
  it('异常：含空格拒绝', () => {
    expect(() => employeeNoSchema.parse('EMP 001')).toThrow();
  });
  it('异常：空字符串拒绝', () => {
    expect(() => employeeNoSchema.parse('')).toThrow();
  });
  it('异常：非字符串拒绝', () => {
    expect(() => employeeNoSchema.parse(12345)).toThrow();
  });
});
