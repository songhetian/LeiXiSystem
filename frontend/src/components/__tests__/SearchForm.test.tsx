import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SearchForm, { SearchFieldConfig } from '@/components/SearchForm';

jest.mock('@arco-design/web-react', () => {
  const Form = ({ children, onSubmit, className }: any) => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit?.();
    };
    return <form data-testid="search-form" onSubmit={handleSubmit} className={className}>{children}</form>;
  };
  Form.Item = ({ label, children, field }: any) => (
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

  const Button = ({ children, onClick, type, htmlType, disabled }: any) => (
    <button
      type={htmlType || 'button'}
      data-testid={`btn-${children}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  const Card = ({ children, style }: any) => <div data-testid="card" style={style}>{children}</div>;
  const Grid = {
    Row: ({ children }: any) => <div data-testid="grid-row">{children}</div>,
    Col: ({ children, span }: any) => <div data-testid="grid-col" data-span={span}>{children}</div>,
  };

  return { Form, Input, Select, Button, Card, Grid };
});

const mockFields: SearchFieldConfig[] = [
  { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
  { key: 'departmentId', label: '部门', type: 'select', options: [
    { value: 1, label: '技术部' },
    { value: 2, label: '产品部' },
  ]},
  { key: 'status', label: '状态', type: 'select', options: [
    { value: 'active', label: '在职' },
    { value: 'inactive', label: '离职' },
  ]},
];

describe('SearchForm', () => {
  describe('正常用例', () => {
    it('renders all fields from config', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('form-item-name')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-departmentId')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-status')).toBeInTheDocument();
    });

    it('renders search and reset buttons', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('btn-查询')).toBeInTheDocument();
      expect(screen.getByTestId('btn-重置')).toBeInTheDocument();
    });

    it('calls onSearch with form values when search button clicked', async () => {
      const user = userEvent.setup();
      const onSearch = jest.fn();
      render(<SearchForm fields={mockFields} onSearch={onSearch} />);

      await user.click(screen.getByTestId('btn-查询'));
      expect(onSearch).toHaveBeenCalled();
    });

    it('resets form values when reset button clicked', async () => {
      const user = userEvent.setup();
      const onReset = jest.fn();
      render(<SearchForm fields={mockFields} onSearch={() => {}} onReset={onReset} />);

      await user.click(screen.getByTestId('btn-重置'));
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('边界用例', () => {
    it('renders empty form when fields is empty array', () => {
      render(<SearchForm fields={[]} onSearch={() => {}} />);
      expect(screen.getByTestId('search-form')).toBeInTheDocument();
      expect(screen.getByTestId('btn-查询')).toBeInTheDocument();
    });

    it('works without onReset callback', () => {
      const onSearch = jest.fn();
      expect(() => {
        render(<SearchForm fields={mockFields} onSearch={onSearch} />);
      }).not.toThrow();
    });
  });

  describe('结构验证', () => {
    it('renders inside a Card', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('uses grid layout for fields', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('grid-row')).toBeInTheDocument();
    });
  });
});
