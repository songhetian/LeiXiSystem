import { renderHook, waitFor } from '@testing-library/react';
import { useDepartments, usePositions } from '@/hooks/use-departments';
import { systemApi } from '@/services/system';
import { clearDictCache } from '@/hooks/use-dict';

jest.mock('@/services/system', () => ({
  systemApi: {
    listDepartments: jest.fn(),
    listPositions: jest.fn(),
  },
}));

const mockDepartments = [
  { id: 1, name: '技术部' },
  { id: 2, name: '产品部' },
];

const mockPositions = [
  { id: 10, name: '工程师' },
  { id: 11, name: '产品经理' },
];

describe('useDepartments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDictCache();
    (systemApi.listDepartments as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockDepartments,
    });
  });

  it('挂载后加载部门列表并解包 data', async () => {
    const { result } = renderHook(() => useDepartments());

    await waitFor(() => {
      expect(result.current.departments).toEqual(mockDepartments);
    });
    expect(systemApi.listDepartments).toHaveBeenCalledTimes(1);
  });

  it('第二个组件挂载时命中共享缓存，不重复请求', async () => {
    const first = renderHook(() => useDepartments());
    await waitFor(() => {
      expect(first.result.current.departments).toEqual(mockDepartments);
    });

    const second = renderHook(() => useDepartments());
    await waitFor(() => {
      expect(second.result.current.departments).toEqual(mockDepartments);
    });
    expect(systemApi.listDepartments).toHaveBeenCalledTimes(1);
  });

  it('接口异常时 departments 保持空数组', async () => {
    (systemApi.listDepartments as jest.Mock).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useDepartments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.departments).toEqual([]);
  });
});

describe('usePositions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDictCache();
    (systemApi.listPositions as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockPositions,
    });
  });

  it('挂载后加载岗位列表并解包 data', async () => {
    const { result } = renderHook(() => usePositions());

    await waitFor(() => {
      expect(result.current.positions).toEqual(mockPositions);
    });
    expect(systemApi.listPositions).toHaveBeenCalledTimes(1);
  });
});
