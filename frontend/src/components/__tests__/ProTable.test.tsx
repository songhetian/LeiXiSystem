import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProTable from '@/components/ProTable';
import type { SearchFieldConfig } from '@/components/SearchForm';

jest.mock('@/components/SearchForm', () => ({
  __esModule: true,
  default: ({ fields, onSearch, onReset }: any) => (
    <div data-testid="search-form">
      {fields.map((f: any) => (
        <span key={f.key} data-testid={`search-field-${f.key}`}>{f.label}</span>
      ))}
      <button data-testid="search-btn" onClick={() => onSearch({})}>查询</button>
      <button data-testid="reset-btn" onClick={() => onReset?.()}>重置</button>
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => {
  const Table = ({ columns, data, loading, pagination, scroll, onRow }: any) => {
    const onPageChange = pagination?.onChange;
    const current = pagination?.current || 1;
    const pageSize = pagination?.pageSize || 10;

    return (
    <div data-testid="table" data-loading={loading} data-scroll-x={String(scroll?.x)}>
      <table>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.dataIndex} data-testid={`col-${col.dataIndex}`}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, idx: number) => (
            // 忠实模拟 Arco Table：把 onRow(record, index) 的返回值挂到 <tr> 上
            <tr key={idx} data-testid="table-row" {...(onRow ? onRow(row, idx) : {})}>
              {columns.map((col: any) => (
                <td key={col.dataIndex}>
                  {col.render ? col.render(row[col.dataIndex], row, idx) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination !== false && (
        <div data-testid="pagination">
          <button data-testid="page-prev" onClick={() => onPageChange?.(current - 1, pageSize)}>上一页</button>
          <span data-testid="page-current">{current}</span>
          <span data-testid="page-total">{pagination.total}</span>
          <button data-testid="page-next" onClick={() => onPageChange?.(current + 1, pageSize)}>下一页</button>
        </div>
      )}
    </div>
  );
  };

  const Button = ({ children, onClick, type }: any) => (
    <button type="button" data-testid={`btn-${children}`} onClick={onClick}>
      {children}
    </button>
  );

  const Card = ({ children }: any) => <div data-testid="card">{children}</div>;
  const Space = ({ children }: any) => <div data-testid="space">{children}</div>;

  return { Table, Button, Card, Space };
});

const mockColumns = [
  { title: '工号', dataIndex: 'employeeNo' },
  { title: '姓名', dataIndex: 'name' },
  { title: '部门', dataIndex: 'department' },
];

const mockData = [
  { id: 1, employeeNo: 'E001', name: '张三', department: '技术部' },
  { id: 2, employeeNo: 'E002', name: '李四', department: '产品部' },
];

const mockSearchFields: SearchFieldConfig[] = [
  { key: 'name', label: '姓名', type: 'input' },
];

describe('ProTable', () => {
  describe('正常用例', () => {
    it('renders table with columns and data', () => {
      render(<ProTable columns={mockColumns} data={mockData} rowKey="id" />);
      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.getByTestId('col-employeeNo')).toHaveTextContent('工号');
      expect(screen.getAllByTestId('table-row')).toHaveLength(2);
    });

    it('renders search form when searchFields provided', () => {
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          searchFields={mockSearchFields}
          onSearch={() => {}}
        />,
      );
      expect(screen.getByTestId('search-form')).toBeInTheDocument();
      expect(screen.getByTestId('search-field-name')).toBeInTheDocument();
    });

    it('renders toolbar actions when provided', () => {
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          toolbar={[
            { key: 'add', label: '新增', onClick: jest.fn() },
          ]}
        />,
      );
      expect(screen.getByTestId('btn-新增')).toBeInTheDocument();
    });

    it('calls toolbar action onClick when button clicked', async () => {
      const user = userEvent.setup();
      const onAdd = jest.fn();
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          toolbar={[{ key: 'add', label: '新增', onClick: onAdd }]}
        />,
      );
      await user.click(screen.getByTestId('btn-新增'));
      expect(onAdd).toHaveBeenCalled();
    });

    it('shows loading state', () => {
      render(
        <ProTable columns={mockColumns} data={[]} rowKey="id" loading={true} />,
      );
      expect(screen.getByTestId('table')).toHaveAttribute('data-loading', 'true');
    });
  });

  describe('分页', () => {
    it('renders pagination with total and current page', () => {
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          pagination={{ current: 1, pageSize: 10, total: 100 }}
        />,
      );
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByTestId('page-current')).toHaveTextContent('1');
      expect(screen.getByTestId('page-total')).toHaveTextContent('100');
    });

    it('calls onPageChange when page changes', async () => {
      const user = userEvent.setup();
      const onPageChange = jest.fn();
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          pagination={{ current: 2, pageSize: 10, total: 100 }}
          onPageChange={onPageChange}
        />,
      );
      await user.click(screen.getByTestId('page-next'));
      expect(onPageChange).toHaveBeenCalled();
    });

    it('does not render pagination when pagination is false', () => {
      render(
        <ProTable columns={mockColumns} data={mockData} rowKey="id" pagination={false} />,
      );
      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });

  describe('边界用例', () => {
    it('renders empty table when data is empty', () => {
      render(<ProTable columns={mockColumns} data={[]} rowKey="id" />);
      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });

    it('works without searchFields', () => {
      render(<ProTable columns={mockColumns} data={mockData} rowKey="id" />);
      expect(screen.queryByTestId('search-form')).not.toBeInTheDocument();
    });

    it('works without toolbar', () => {
      render(<ProTable columns={mockColumns} data={mockData} rowKey="id" />);
      expect(screen.getByTestId('table')).toBeInTheDocument();
    });
  });

  describe('结构验证', () => {
    it('表格开启横向内容滚动（scroll.x=true），避免中文列被压缩逐字换行成竖向排列', () => {
      render(<ProTable columns={mockColumns} data={mockData} rowKey="id" />);
      expect(screen.getByTestId('table')).toHaveAttribute('data-scroll-x', 'true');
    });
    it('search area above table', () => {
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          searchFields={mockSearchFields}
          onSearch={() => {}}
        />,
      );
      const search = screen.getByTestId('search-form');
      const table = screen.getByTestId('table');
      expect(search.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe('空页自动回跳', () => {
    it('当前页越界时，自动跳转到最后有效页', () => {
      const onPageChange = jest.fn();
      render(
        <ProTable
          columns={mockColumns}
          data={[]}
          rowKey="id"
          pagination={{ current: 5, pageSize: 10, total: 25 }}
          onPageChange={onPageChange}
        />,
      );
      // 5 页 * 10 = 50 > 25，越界。最后有效页是 ceil(25/10) = 3
      expect(onPageChange).toHaveBeenCalledWith(3, 10);
    });

    it('当前页有效时，不触发跳转', () => {
      const onPageChange = jest.fn();
      render(
        <ProTable
          columns={mockColumns}
          data={mockData}
          rowKey="id"
          pagination={{ current: 2, pageSize: 10, total: 25 }}
          onPageChange={onPageChange}
        />,
      );
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('total 未知时，不自动跳转', () => {
      const onPageChange = jest.fn();
      render(
        <ProTable
          columns={mockColumns}
          data={[]}
          rowKey="id"
          pagination={{ current: 5, pageSize: 10 }}
          onPageChange={onPageChange}
        />,
      );
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});

describe('ProTable 行的键盘可达性（WCAG SC 2.1.1 / 2.4.3）', () => {
  const rows = [
    { id: 1, name: '张三' },
    { id: 2, name: '李四' },
    { id: 3, name: '王五' },
  ];
  const cols = [
    { title: '姓名', dataIndex: 'name' },
  ];

  it('未传 onRowClick 时行不可聚焦（不污染 Tab 序列）', () => {
    render(<ProTable columns={cols} data={rows} rowKey="id" />);
    for (const tr of screen.getAllByTestId('table-row')) {
      expect(tr).not.toHaveAttribute('tabindex');
    }
    expect(screen.queryByText(/按回车键/)).not.toBeInTheDocument();
  });

  it('传 onRowClick 时整张表只有一行进入 Tab 序列（roving tabindex）', () => {
    render(<ProTable columns={cols} data={rows} rowKey="id" onRowClick={() => {}} />);
    const trs = screen.getAllByTestId('table-row');
    expect(trs.filter((tr) => tr.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(trs.filter((tr) => tr.getAttribute('tabindex') === '-1')).toHaveLength(2);
  });

  it('Enter / Space 触发 onRowClick，方向键在行间移动焦点', async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    render(<ProTable columns={cols} data={rows} rowKey="id" onRowClick={onRowClick} />);
    const trs = screen.getAllByTestId('table-row');

    trs[0].focus();
    expect(document.activeElement).toBe(trs[0]);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(trs[1]);

    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);

    await user.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(trs[0]);
  });

  it('为键盘用户提供屏读可及的「回车打开」提示', () => {
    render(<ProTable columns={cols} data={rows} rowKey="id" onRowClick={() => {}} />);
    expect(screen.getByText(/按回车键或空格键打开详情/)).toHaveClass('lx-sr-only');
  });
});
