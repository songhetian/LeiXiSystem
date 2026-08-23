import { parsePagination } from './pagination.util';

describe('parsePagination', () => {
  it('默认 page=1, pageSize=20', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('正常解析合法参数', () => {
    const result = parsePagination({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('pageSize 超过上限时限制为 100', () => {
    const result = parsePagination({ page: '1', pageSize: '9999' });
    expect(result.pageSize).toBe(100);
  });

  it('pageSize 为 0 或负数时使用默认值', () => {
    expect(parsePagination({ pageSize: '0' }).pageSize).toBe(20);
    expect(parsePagination({ pageSize: '-5' }).pageSize).toBe(20);
  });

  it('page 小于 1 时重置为 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-1' }).page).toBe(1);
  });

  it('非数字参数使用默认值', () => {
    const result = parsePagination({ page: 'abc', pageSize: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('支持自定义上限', () => {
    const result = parsePagination({ pageSize: '500' }, { maxPageSize: 200 });
    expect(result.pageSize).toBe(200);
  });

  it('支持自定义默认值', () => {
    const result = parsePagination({}, { defaultPageSize: 50 });
    expect(result.pageSize).toBe(50);
  });

  it('参数为 number 类型也支持', () => {
    const result = parsePagination({ page: 5, pageSize: 30 });
    expect(result.page).toBe(5);
    expect(result.pageSize).toBe(30);
  });

  it('参数为 undefined 时使用默认值', () => {
    const result = parsePagination({ page: undefined, pageSize: undefined });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
