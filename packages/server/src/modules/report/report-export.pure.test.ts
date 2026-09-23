import { describe, it, expect } from 'vitest';
import { cellValue, toCsv } from './report-export.pure';

const COLS = [
  { header: '申请人', key: 'name' },
  { header: '金额', key: 'amount', format: 'money' as const },
  { header: '时长', key: 'hours', format: 'number' as const },
  { header: '是否休息', key: 'rest', format: 'bool' as const },
];

describe('report-export.pure 导出渲染', () => {
  it('cellValue：按 format 渲染金额/数值/布尔/文本，空值返回空串', () => {
    expect(cellValue({ amount: 3 }, { header: '', key: 'amount', format: 'money' })).toBe('3.00');
    expect(cellValue({ hours: 45 }, { header: '', key: 'hours', format: 'number' })).toBe('45.0');
    expect(cellValue({ rest: true }, { header: '', key: 'rest', format: 'bool' })).toBe('是');
    expect(cellValue({ rest: false }, { header: '', key: 'rest', format: 'bool' })).toBe('否');
    expect(cellValue({ name: '张三' }, { header: '', key: 'name' })).toBe('张三');
    expect(cellValue({ name: undefined }, { header: '', key: 'name' })).toBe('');
    expect(cellValue({ name: null }, { header: '', key: 'name' })).toBe('');
  });

  it('toCsv：首行表头 + 每行按列拼接，金额/时长按 format 渲染', () => {
    const rows = [{ name: '张三', amount: 128.5, hours: 2, rest: false }];
    expect(toCsv(COLS, rows)).toBe('申请人,金额,时长,是否休息\r\n张三,128.50,2.0,否');
  });

  it('toCsv：含逗号/引号/换行的文本用双引号包裹并转义内部引号', () => {
    expect(toCsv([{ header: '备注', key: 'note' }], [{ note: 'a,b' }])).toBe('备注\r\n"a,b"');
    expect(toCsv([{ header: '备注', key: 'note' }], [{ note: 'he said "hi"' }])).toBe('备注\r\n"he said ""hi"""');
  });

  it('toCsv：无数据行时仅输出表头', () => {
    expect(toCsv(COLS, [])).toBe('申请人,金额,时长,是否休息');
  });
});