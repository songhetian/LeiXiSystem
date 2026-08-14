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
  const Table = ({ columns, data, loading, pagination }: any) => {
    const onPageChange = pagination?.onChange;
    const current = pagination?.current || 1;
    const pageSize = pagination?.pageSize || 10;

    return (
    <div data-testid="table" data-loading={loading}>
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
            <tr key={idx} data-testid="table-row">
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
});
