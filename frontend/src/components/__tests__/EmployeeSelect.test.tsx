import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeeSelect from '@/components/EmployeeSelect';
import { employeeApi } from '@/services/employee';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/employee', () => ({
  employeeApi: { getList: jest.fn() },
}));

const employee = {
  id: 1,
  employeeNo: 'E001',
  name: '张三',
  departmentName: '研发部',
};

/** 打开 Arco Select 下拉（下拉内容挂在 body 上，需要触发一次点击） */
function openDropdown() {
  const trigger = document.querySelector('.arco-select') as HTMLElement;
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
}

describe('EmployeeSelect（员工下拉）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 使用 useCachedData 的组件测试必须清空共享缓存，防止跨用例串数据
    clearDataCache();
  });

  it('加载成功后展示「工号 - 姓名 (部门)」格式的选项', async () => {
    (employeeApi.getList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [employee], total: 1, page: 1, pageSize: 50 },
    });
    render(<EmployeeSelect />);
    await waitFor(() => expect(employeeApi.getList).toHaveBeenCalled());

    openDropdown();
    expect(await screen.findByText('E001 - 张三 (研发部)')).toBeInTheDocument();
  });

  it('接口失败时提示「加载失败」而不是「暂无数据」', async () => {
    (employeeApi.getList as jest.Mock).mockRejectedValue(new Error('网络异常'));
    render(<EmployeeSelect />);
    await waitFor(() => expect(employeeApi.getList).toHaveBeenCalled());

    openDropdown();
    expect(
      await screen.findByText('员工列表加载失败，请收起后重试'),
    ).toBeInTheDocument();
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });

  it('业务码非 0 同样按失败处理（不能当成查无此人）', async () => {
    (employeeApi.getList as jest.Mock).mockResolvedValue({
      code: 500,
      message: '员工列表读取失败',
      data: { list: [], total: 0, page: 1, pageSize: 50 },
    });
    render(<EmployeeSelect />);
    await waitFor(() => expect(employeeApi.getList).toHaveBeenCalled());

    openDropdown();
    expect(
      await screen.findByText('员工列表加载失败，请收起后重试'),
    ).toBeInTheDocument();
  });
});
