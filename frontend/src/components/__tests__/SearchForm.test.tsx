import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SearchForm, { SearchFieldConfig } from '@/components/SearchForm';

jest.mock('@/components/EmployeeSelect', () => {
  return (props: any) => (
    <select
      data-testid={`employee-select-${props.placeholder || 'default'}`}
      data-id={props.id || ''}
      value={props.value == null ? '' : props.value}
      onChange={(e) => {
        // 模拟选中某个员工：回调 onChange(value, employee)
        const emp = props.value == null ? { id: 1, name: '张三' } : undefined;
        props.onChange?.(e.target.value || null, emp);
      }}
    >
      <option value="">全部</option>
      <option value="zhangsan">张三</option>
    </select>
  );
});

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

  const Select = ({ value, onChange, placeholder, id, options = [], showSearch, allowClear }: any) => (
    <select
      data-testid={`select-${id || 'default'}`}
      data-show-search={String(!!showSearch)}
      data-allow-clear={String(!!allowClear)}
      value={value == null ? '' : value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const Button = ({ children, onClick, type, htmlType, disabled, ...rest }: any) => (
    <button
      type={htmlType || 'button'}
      data-testid={`btn-${children}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );

  const Card = ({ children, style }: any) => <div data-testid="card" style={style}>{children}</div>;
  const Grid = {
    Row: ({ children }: any) => <div data-testid="grid-row">{children}</div>,
    Col: ({ children, span, style }: any) => (
      <div
        data-testid="grid-col"
        data-span={span}
        data-style={style ? Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';') : ''}
      >
        {children}
      </div>
    ),
  };

  // Arco Picker 不透传原生 id，真实组件通过 inputProps 落到 input 上，这里如实模拟
  const RangePicker = (props: any) => (
    <div data-testid="date-range" data-input-id={props.inputProps?.[0]?.id || ''} />
  );
  const DatePicker = (props: any) => (
    <div data-testid="date-picker" data-input-id={props.inputProps?.id || ''} />
  );
  DatePicker.RangePicker = RangePicker;

  return { Form, Input, Select, Button, Card, Grid, DatePicker };
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

    it('employee 类型字段在选中员工后写入姓名并随查询提交', async () => {
      const user = userEvent.setup();
      const onSearch = jest.fn();
      render(
        <SearchForm
          fields={[{ key: 'keyword', label: '姓名', type: 'employee' }]}
          onSearch={onSearch}
        />,
      );
      const select = screen.getByTestId('employee-select-搜索员工姓名或工号');
      await user.selectOptions(select, 'zhangsan');

      await user.click(screen.getByTestId('btn-查询'));
      // EmployeeSelect 选中时把 emp.name（张三）写入字段值
      expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keyword: '张三' }));
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

    it('accepts debounceMs prop without error', () => {
      const onSearch = jest.fn();
      expect(() => {
        render(<SearchForm fields={mockFields} onSearch={onSearch} debounceMs={300} />);
      }).not.toThrow();
    });
  });

  describe('结构验证', () => {
    it('renders inside a Card', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('uses a dedicated fields grid area', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      expect(screen.getByTestId('search-fields')).toBeInTheDocument();
    });
  });

  describe('重置与防抖', () => {
    it('点击重置时还原 initialValues（而非清空）', async () => {
      const user = userEvent.setup();
      const onReset = jest.fn();
      render(
        <SearchForm
          fields={mockFields}
          onSearch={() => {}}
          onReset={onReset}
          initialValues={{ name: 'abc' }}
        />,
      );
      const input = screen.getByTestId('input-name');
      expect(input).toHaveValue('abc');

      await user.clear(input);
      await user.type(input, 'xyz');
      expect(input).toHaveValue('xyz');

      await user.click(screen.getByTestId('btn-重置'));
      expect(onReset).toHaveBeenCalled();
      expect(input).toHaveValue('abc');
    });

    it('debounceMs>0 时卸载组件后不再触发 onSearch（定时器已清理）', () => {
      jest.useFakeTimers();
      const onSearch = jest.fn();
      const { unmount } = render(
        <SearchForm fields={mockFields} onSearch={onSearch} debounceMs={300} />,
      );

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'x' } });

      unmount();
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSearch).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('月份类型', () => {
    it('renders a month picker for month type fields', () => {
      render(
        <SearchForm
          fields={[{ key: 'month', label: '月份', type: 'month' }]}
          onSearch={() => {}}
        />,
      );
      expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    });
  });

  describe('展开/收起', () => {
    const manyFields: SearchFieldConfig[] = [
      { key: 'a', label: 'A', type: 'input' },
      { key: 'b', label: 'B', type: 'input' },
      { key: 'c', label: 'C', type: 'input' },
      { key: 'd', label: 'D', type: 'input' },
      { key: 'e', label: 'E', type: 'input' },
    ];

    it('collapses extra fields beyond column count by default', () => {
      render(<SearchForm fields={manyFields} onSearch={() => {}} column={3} />);
      // 默认只渲染前三项（column=3）
      expect(screen.getByTestId('form-item-a')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-c')).toBeInTheDocument();
      expect(screen.queryByTestId('form-item-d')).not.toBeInTheDocument();
      expect(screen.getByTestId('toggle-collapse')).toBeInTheDocument();
    });

    it('renders all fields when collapsedCount not exceeded', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} column={4} />);
      expect(screen.getByTestId('form-item-name')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-status')).toBeInTheDocument();
      expect(screen.queryByTestId('toggle-collapse')).not.toBeInTheDocument();
    });

    it('expands to show all fields when collapsed, and collapses back', async () => {
      const user = userEvent.setup();
      render(<SearchForm fields={manyFields} onSearch={() => {}} column={3} />);
      expect(screen.queryByTestId('form-item-d')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('toggle-collapse'));
      expect(screen.getByTestId('form-item-d')).toBeInTheDocument();
      expect(screen.getByTestId('form-item-e')).toBeInTheDocument();

      await user.click(screen.getByTestId('toggle-collapse'));
      expect(screen.queryByTestId('form-item-d')).not.toBeInTheDocument();
    });
  });

  describe('企业后台布局（字段栅格 + 右侧固定操作列）', () => {
    it('下拉字段支持搜索（showSearch）与清空（allowClear）', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      const selects = screen.getAllByTestId(/^select-/);
      expect(selects.length).toBe(2); // 部门 + 状态两个下拉
      for (const sel of selects) {
        expect(sel).toHaveAttribute('data-show-search', 'true');
        expect(sel).toHaveAttribute('data-allow-clear', 'true');
      }
    });

    it('下拉字段首项为“全部”选项', () => {
      render(<SearchForm fields={mockFields} onSearch={() => {}} />);
      const departmentSel = screen.getByTestId('select-departmentId');
      const options = Array.from(departmentSel.querySelectorAll('option')).map((o) => o.textContent);
      expect(options[0]).toBe('全部');
      // 业务选项仍在“全部”之后
      expect(options).toContain('技术部');
      expect(options).toContain('产品部');
    });

    it('字段区与操作区分离：操作按钮不再占满整行', () => {
      const fourFields: SearchFieldConfig[] = [
        { key: 'a', label: 'A', type: 'input' },
        { key: 'b', label: 'B', type: 'input' },
        { key: 'c', label: 'C', type: 'input' },
        { key: 'd', label: 'D', type: 'input' },
      ];
      render(<SearchForm fields={fourFields} onSearch={() => {}} column={3} />);
      // 字段网格 + 独立操作列各司其职
      expect(screen.getByTestId('search-fields')).toBeInTheDocument();
      expect(screen.getByTestId('search-actions')).toBeInTheDocument();
      // 查询/重置按钮归属于操作列容器，而非散落在字段格内
      const actions = screen.getByTestId('search-actions') as HTMLElement;
      expect(actions.querySelector('[data-testid="btn-查询"]')).not.toBeNull();
      expect(actions.querySelector('[data-testid="btn-重置"]')).not.toBeNull();
    });

    it('展开/收起按钮固定在操作列中', async () => {
      const user = userEvent.setup();
      const manyFields: SearchFieldConfig[] = [
        { key: 'a', label: 'A', type: 'input' },
        { key: 'b', label: 'B', type: 'input' },
        { key: 'c', label: 'C', type: 'input' },
        { key: 'd', label: 'D', type: 'input' },
      ];
      render(<SearchForm fields={manyFields} onSearch={() => {}} column={3} />);
      const actions = screen.getByTestId('search-actions') as HTMLElement;
      expect(actions.querySelector('[data-testid="toggle-collapse"]')).not.toBeNull();
      await user.click(screen.getByTestId('toggle-collapse'));
      expect(screen.getByTestId('form-item-d')).toBeInTheDocument();
    });
  });

  describe('起止日期成对校验', () => {
    // 回归背景：开始日期晚于结束日期时，此前照样发请求，接口返回空列表，
    // 用户看到的是「没有数据」而不是「你填反了」。
    const dateFields: SearchFieldConfig[] = [
      { key: 'keyword', label: '关键词', type: 'input' },
      { key: 'startDate', label: '开始日期', type: 'date' },
      { key: 'endDate', label: '结束日期', type: 'date' },
    ];

    it('开始晚于结束时提示并阻断查询', async () => {
      const user = userEvent.setup();
      const onSearch = jest.fn();
      render(
        <SearchForm
          fields={dateFields}
          onSearch={onSearch}
          initialValues={{ startDate: '2026-10-10', endDate: '2026-10-01' }}
          expandable={false}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('「开始日期」不能晚于「结束日期」');

      await user.click(screen.getByTestId('btn-查询'));
      expect(onSearch).not.toHaveBeenCalled();
    });

    it('区间顺序合法时正常查询', async () => {
      const user = userEvent.setup();
      const onSearch = jest.fn();
      render(
        <SearchForm
          fields={dateFields}
          onSearch={onSearch}
          initialValues={{ startDate: '2026-10-01', endDate: '2026-10-10' }}
          expandable={false}
        />,
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('btn-查询'));
      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-10' }),
      );
    });

    it('防抖查询同样不把非法区间发出去', () => {
      jest.useFakeTimers();
      const onSearch = jest.fn();
      render(
        <SearchForm
          fields={dateFields}
          onSearch={onSearch}
          initialValues={{ startDate: '2026-10-10', endDate: '2026-10-01' }}
          debounceMs={300}
          expandable={false}
        />,
      );

      fireEvent.change(screen.getByTestId('input-keyword'), { target: { value: '张三' } });
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSearch).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('只有起始日期字段（无对应结束字段）时不做成对校验', () => {
      render(
        <SearchForm
          fields={[{ key: 'startDate', label: '开始日期', type: 'date' }]}
          onSearch={() => {}}
          initialValues={{ startDate: '2026-10-10' }}
          expandable={false}
        />,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('无障碍：label 与控件 id 绑定（WCAG SC 1.3.1 / 3.3.2 / 4.1.2）', () => {
    // 回归背景：此前只有 Select 传了 id，日期/区间/员工/文本四类控件的 <label htmlFor>
    // 全部悬空 —— 点击 label 无法聚焦控件，屏幕阅读器也不朗读字段名。
    const allTypes: SearchFieldConfig[] = [
      { key: 'kw', label: '关键词', type: 'input' },
      { key: 'dept', label: '部门', type: 'select', options: [] },
      { key: 'day', label: '日期', type: 'date' },
      { key: 'span', label: '区间', type: 'range' },
      { key: 'emp', label: '员工', type: 'employee' },
      { key: 'mon', label: '月份', type: 'month' },
    ];

    it('五类控件的 label 均指向真实控件 id', () => {
      render(<SearchForm fields={allTypes} onSearch={() => {}} expandable={false} />);

      // 文本 / 下拉：id 直接落在原生控件上
      expect(screen.getByTestId('input-kw')).toBeInTheDocument();
      expect(screen.getByTestId('select-dept')).toBeInTheDocument();
      // 日期 / 月份 / 区间：id 经 inputProps 落到 Arco Picker 的原生 input 上
      const datePickers = screen.getAllByTestId('date-picker');
      expect(datePickers.map((el) => el.getAttribute('data-input-id')).sort()).toEqual(['day', 'mon']);
      expect(screen.getByTestId('date-range')).toHaveAttribute('data-input-id', 'span');
      // 员工：id 透传给 EmployeeSelect
      expect(screen.getByTestId('employee-select-搜索员工姓名或工号')).toHaveAttribute('data-id', 'emp');
    });

    it('每个 label 的 htmlFor 都能对应到一个存在的控件 id', () => {
      const { container } = render(
        <SearchForm fields={allTypes} onSearch={() => {}} expandable={false} />,
      );
      const labels = Array.from(container.querySelectorAll('label'));
      expect(labels).toHaveLength(allTypes.length);
      for (const label of labels) {
        const htmlFor = label.getAttribute('for');
        expect(htmlFor).toBeTruthy();
        // 字段 key 本身必须出现在 label 的 for 上
        expect(allTypes.map((f) => f.key)).toContain(htmlFor);
      }
    });
  });
});
