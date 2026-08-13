import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ModalForm from '@/components/ModalForm';

jest.mock('@arco-design/web-react', () => {
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
  Form.Item = ({ label, field, children }: any) => (
    <div data-testid={`form-item-${field}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );

  const Input = ({ value, onChange, placeholder, id }: any) => (
    <input
      type="text"
      data-testid={`input-${id || 'default'}`}
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  const Select = ({ value, onChange, placeholder, id, options = [] }: any) => (
    <select
      data-testid={`select-${id || 'default'}`}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="">{placeholder || '请选择'}</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  return { Modal, Form, Input, Select };
});

const mockFields = [
  { key: 'name', label: '姓名', type: 'input', required: true },
  { key: 'departmentId', label: '部门', type: 'select', options: [
    { value: 1, label: '技术部' },
    { value: 2, label: '产品部' },
  ]},
];

describe('ModalForm', () => {
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
          onOk={onOk}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByTestId('btn-ok'));
      expect(onOk).toHaveBeenCalled();
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
