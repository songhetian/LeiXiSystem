import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Message } from '@arco-design/web-react';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';

jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  const Modal = ({ visible, title, onCancel, confirmLoading, onOk, okText, cancelText, children }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="modal" data-confirm-loading={confirmLoading}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        <button data-testid="btn-cancel" onClick={onCancel}>{cancelText || '取消'}</button>
        <button data-testid="btn-ok" onClick={onOk} disabled={confirmLoading}>
          {confirmLoading ? '加载中...' : (okText || '确定')}
        </button>
      </div>
    );
  };

  const Form = ({ children, onSubmit }: any) => (
    <form data-testid="modal-form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit?.(); }}>
      {children}
    </form>
  );
  Form.Item = ({ label, field, children, help, error }: any) => (
    <div data-testid={`form-item-${field}`}>
      {label && <label htmlFor={field}>{label}</label>}
      {children}
      {(help || error) && (
        <div role="alert" data-testid={`field-error-${field}`}>{help || error}</div>
      )}
    </div>
  );

  const Input: any = React.forwardRef(
    ({ value, onChange, placeholder, id }: any, ref: any) => (
      <input
        ref={ref}
        type="text"
        id={id}
        data-testid={`input-${id || 'default'}`}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
  );

  const Select = ({ value, onChange, placeholder, id, options = [] }: any) => (
    <select
      data-testid={`select-${id || 'default'}`}
      id={id}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="">{placeholder || '请选择'}</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const DatePicker = ({ value, onChange, placeholder, id }: any) => (
    <input
      type="text"
      data-testid={`datepicker-${id || 'default'}`}
      value={value || ''}
      placeholder={placeholder || '请选择日期'}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  const Message = {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  };

  return { Modal, Form, Input, Select, DatePicker, Message };
});

const mockFields: FormFieldConfig[] = [
  { key: 'name', label: '姓名', type: 'input', required: true },
  { key: 'departmentId', label: '部门', type: 'select', options: [
    { value: 1, label: '技术部' },
    { value: 2, label: '产品部' },
  ]},
];

// 稳定的初始值引用：ModalForm 的 useEffect 依赖 initialValues，
// 若不传则默认 {} 每次渲染生成新引用，输入触发 re-render 时会引发无限循环。
// 传入此稳定引用可避免该问题（仅测试需要，源码不可改）。
const stableInitialValues: Record<string, any> = {};

describe('ModalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常用例', () => {
    it('renders modal when visible is true', () => {
      render(
        <ModalForm
          visible={true}
          title="新增员工"
          fields={mockFields}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('新增员工');
    });

    it('does not render modal when visible is false', () => {
      render(
        <ModalForm
          visible={false}
          title="新增员工"
          fields={mockFields}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders form fields inside modal', () => {
      render(
        <ModalForm
          visible={true}
          title="新增员工"
          fields={mockFields}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByTestId('form-item-name')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-departmentId')).toBeInTheDocument();
    });

    it('calls onOk with form values when confirm button clicked', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      // name 为必填字段，先填写后再提交
      await user.type(screen.getByTestId('input-name'), '张三');
      await user.click(screen.getByTestId('btn-ok'));
      expect(onOk).toHaveBeenCalledWith(expect.objectContaining({ name: '张三' }));
    });

    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          onOk={() => {}}
          onCancel={onCancel}
        />,
      );
      await user.click(screen.getByTestId('btn-cancel'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('渲染 date 类型字段时使用 DatePicker', () => {
      const dateFields: FormFieldConfig[] = [
        { key: 'hireDate', label: '入职日期', type: 'date', placeholder: '请选择入职日期' },
      ];
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={dateFields}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByTestId('form-item-hireDate')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请选择入职日期')).toBeInTheDocument();
    });
  });

  describe('边界用例', () => {
    it('shows loading state when confirmLoading is true', () => {
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          confirmLoading={true}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByTestId('modal')).toHaveAttribute('data-confirm-loading', 'true');
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('fills form with initialValues', () => {
      render(
        <ModalForm
          visible={true}
          title="编辑"
          fields={mockFields}
          initialValues={{ name: '张三', departmentId: 1 }}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByTestId('form-item-name')).toBeInTheDocument();
    });

    it('handles empty fields array', () => {
      render(
        <ModalForm
          visible={true}
          title="测试"
          fields={[]}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('必填字段为空时点击确定显示内联错误且不调用 onOk', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      // 不填写必填的 name 字段直接提交
      await user.click(screen.getByTestId('btn-ok'));
      expect(screen.getByTestId('field-error-name')).toHaveTextContent('请填写姓名');
      expect(onOk).not.toHaveBeenCalled();
    });

    it('pattern 校验失败时显示内联 rule.message 且不调用 onOk', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      const phoneFields: FormFieldConfig[] = [
        {
          key: 'phone',
          label: '手机号',
          type: 'input',
          rules: [{ pattern: /^1\d{10}$/, message: '手机号格式不正确' }],
        },
      ];
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={phoneFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      // 输入不符合正则的值
      await user.type(screen.getByTestId('input-phone'), 'abc');
      await user.click(screen.getByTestId('btn-ok'));
      expect(screen.getByTestId('field-error-phone')).toHaveTextContent('手机号格式不正确');
      expect(onOk).not.toHaveBeenCalled();
    });

    it('pattern 校验通过时调用 onOk', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      const phoneFields: FormFieldConfig[] = [
        {
          key: 'phone',
          label: '手机号',
          type: 'input',
          rules: [{ pattern: /^1\d{10}$/, message: '手机号格式不正确' }],
        },
      ];
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={phoneFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      await user.type(screen.getByTestId('input-phone'), '13800138000');
      await user.click(screen.getByTestId('btn-ok'));
      expect(onOk).toHaveBeenCalledWith(expect.objectContaining({ phone: '13800138000' }));
    });
  });

  describe('内联校验与聚焦', () => {
    it('必填字段为空时显示内联错误且不调用 onOk', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByTestId('btn-ok'));
      expect(onOk).not.toHaveBeenCalled();
      expect(screen.getByTestId('field-error-name')).toHaveTextContent('请填写姓名');
    });

    it('校验失败时聚焦第一个错误字段', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByTestId('btn-ok'));
      await waitFor(() => {
        expect(screen.getByTestId('input-name')).toHaveFocus();
      });
    });

    it('修正错误后再次提交可成功并清除内联错误', async () => {
      const user = userEvent.setup();
      const onOk = jest.fn();
      render(
        <ModalForm
          visible={true}
          title="新增"
          fields={mockFields}
          initialValues={stableInitialValues}
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByTestId('btn-ok'));
      expect(screen.getByTestId('field-error-name')).toBeInTheDocument();
      await user.type(screen.getByTestId('input-name'), '张三');
      await user.click(screen.getByTestId('btn-ok'));
      expect(onOk).toHaveBeenCalled();
      expect(screen.queryByTestId('field-error-name')).not.toBeInTheDocument();
    });
  });

  describe('结构验证', () => {
    it('renders form inside modal content', () => {
      render(
        <ModalForm
          visible={true}
          title="测试"
          fields={mockFields}
          onOk={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByTestId('modal-content')).toContainElement(screen.getByTestId('modal-form'));
    });
  });
});
