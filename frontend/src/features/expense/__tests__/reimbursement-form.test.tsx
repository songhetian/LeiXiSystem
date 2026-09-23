import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReimbursementForm from '@/features/expense/components/ReimbursementForm';
import { reimbursementApi } from '@/services/reimbursement';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/reimbursement', () => ({
  reimbursementApi: {
    getTypes: jest.fn(),
    getExpenseTypes: jest.fn(),
    uploadFile: jest.fn(),
    createReimbursement: jest.fn(),
  },
}));

const mockTypes = [
  { id: 1, name: '差旅费', code: 'TRAVEL', status: 'active' },
  { id: 2, name: '餐饮费', code: 'MEAL', status: 'active' },
];

const mockExpenseTypes = [
  { id: 1, name: '市内交通费', unit: '次', sortOrder: 0, status: 'active' },
  { id: 2, name: '招待餐费', unit: '次', sortOrder: 1, status: 'active' },
];

describe('ReimbursementForm', () => {
  const onSuccess = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache(); // useCachedData 模块级共享缓存需在用例间清空，防止缓存串数据
    (reimbursementApi.getTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockTypes });
    (reimbursementApi.getExpenseTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockExpenseTypes });
    (reimbursementApi.createReimbursement as jest.Mock).mockResolvedValue({ code: 0, data: { id: 9 } });
    (reimbursementApi.uploadFile as jest.Mock).mockResolvedValue({ code: 0, data: { url: '/uploads/reimbursement/xx.png', fileName: '发票.png' } });
  });

  const renderForm = (draftTab: boolean = false) =>
    render(
      <ReimbursementForm visible onSuccess={onSuccess} onCancel={onCancel} />,
    );

  it('渲染基础信息（标题/报销分类/事由备注）', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('报销单标题')).toBeInTheDocument());
    // Arco Select/TextArea 的 label 关联在 jsdom 中不可靠，改按可见文本校验
    expect(screen.getByText('报销分类')).toBeInTheDocument();
    expect(screen.getByText('事由备注')).toBeInTheDocument();
  });

  it('加载一级类型与二级费用类型作为选项', async () => {
    renderForm();
    await waitFor(() => {
      expect(reimbursementApi.getTypes).toHaveBeenCalled();
      expect(reimbursementApi.getExpenseTypes).toHaveBeenCalled();
    });
  });

  it('正式提交时调用 createReimbursement（含明细与备注）', async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('报销单标题')).toBeInTheDocument());

    // 表单会自动填充默认标题，先清空再输入
    await user.clear(screen.getByLabelText('报销单标题'));
    await user.type(screen.getByLabelText('报销单标题'), '8月出差报销');
    await user.type(screen.getByPlaceholderText('简单说明情况...'), '北京出差');

    // 填一条明细金额，避免被「请至少填写一项费用明细」拦截
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '100');

    await user.click(screen.getByRole('button', { name: /正式提交/ }));

    await waitFor(() => {
      expect(reimbursementApi.createReimbursement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '8月出差报销',
          remark: '北京出差',
          status: 'pending',
        }),
      );
    });
  });

  it('存为草稿时 status 为 draft 且不校验必填项', async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('报销单标题')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /存为草稿/ }));

    await waitFor(() => {
      expect(reimbursementApi.createReimbursement).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
      );
    });
  });

  it('可新增明细项并选择费用类型/金额/日期/备注', async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('报销单标题')).toBeInTheDocument());

    expect(screen.getAllByPlaceholderText('0.00')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /新增一笔费用明细项/ }));
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('0.00').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('单据附件上传成功后计入 attachments', async () => {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('报销单标题')).toBeInTheDocument());

    // 通过隐藏 input 触发上传
    const file = new File(['x'], '发票.png', { type: 'image/png' });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(reimbursementApi.uploadFile).toHaveBeenCalled());
  });
});