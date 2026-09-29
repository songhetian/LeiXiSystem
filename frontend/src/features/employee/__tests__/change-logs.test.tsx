import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeeChangeLogsPage from '@/features/employee/pages/change-logs';
import { employeeApi } from '@/services/employee';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';
import { clearDictCache } from '@/hooks/use-dict';

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getChangeLogs: jest.fn(),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: {
    listDepartments: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ breadcrumbs, title, children }: any) => (
    <div data-testid="page-container" data-breadcrumbs={JSON.stringify(breadcrumbs ?? null)}>
      {breadcrumbs && <div data-testid="page-breadcrumb">{breadcrumbs.join(' / ')}</div>}
      {children}
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, searchFields, searchInlineActions, searchExpandable, toolbar, pagination }: any) => (
    <div
      data-testid="pro-table"
      data-inline-actions={String(searchInlineActions)}
      data-search-expandable={String(searchExpandable)}
    >
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <span key={f.key} data-testid={`search-${f.key}`}>{f.label}</span>
          ))}
        </div>
      )}
      {toolbar && (
        <div data-testid="toolbar">
          {toolbar.map((t: any) => (
            <button key={t.key} data-testid={`toolbar-${t.key}`}>{t.label}</button>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.dataIndex} data-testid={`col-${c.dataIndex}`}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id} data-testid="table-row">
              {columns.map((c: any) => (
                <td key={c.dataIndex} data-testid={`cell-${row.id}-${c.title}`}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

const mockRows = [
  {
    id: 1,
    employeeId: 3,
    field: 'resignReason',
    oldValue: null,
    newValue: '个人发展方向调整',
    changedBy: 1,
    changeType: 'resign',
    createdAt: '2026-08-27T10:00:00.000Z',
    employee: { id: 3, employeeNo: 'EMP0003', name: '王五', department: { id: 2, name: '产品部' } },
  },
];

describe('员工变动流水页', () => {
  beforeEach(() => {
    clearDataCache();
    clearDictCache();
    jest.clearAllMocks();
    (employeeApi.getChangeLogs as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: mockRows, total: 1, page: 1, pageSize: 20 },
    });
    (systemApi.listDepartments as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        { id: 1, name: '技术部' },
        { id: 2, name: '产品部' },
      ],
    });
  });

  it('不渲染顶部局部面包屑（顶部已有全局面包屑，与员工管理页一致）', async () => {
    render(<EmployeeChangeLogsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toBeInTheDocument();
    });
    const container = screen.getByTestId('page-container');
    // PageContainer 未传入 breadcrumbs，避免出现重复面包屑
    expect(container.getAttribute('data-breadcrumbs')).toBe('null');
    expect(screen.queryByTestId('page-breadcrumb')).not.toBeInTheDocument();
  });

  it('搜索框样式对齐员工管理页：inline 操作 + 不折叠', async () => {
    render(<EmployeeChangeLogsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toBeInTheDocument();
    });
    const table = screen.getByTestId('pro-table');
    expect(table.getAttribute('data-inline-actions')).toBe('true');
    expect(table.getAttribute('data-search-expandable')).toBe('false');
  });

  it('变动字段展示中文可读名（不暴露英文库字段名，如 resignReason）', async () => {
    render(<EmployeeChangeLogsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table-row')).toBeInTheDocument();
    });
    // 「变动字段」列：resignReason 应显示为「离职原因」
    expect(screen.getByTestId('cell-1-变动字段')).toHaveTextContent('离职原因');
  });

  it('变动时间按北京时间格式化，不泄漏 UTC 原始串', async () => {
    render(<EmployeeChangeLogsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table-row')).toBeInTheDocument();
    });
    // mockRows[0].createdAt = '2026-08-27T10:00:00.000Z' → 北京时间 2026-08-27 18:00
    expect(screen.getByTestId('cell-1-变动时间')).toHaveTextContent('2026-08-27 18:00');
    expect(screen.queryByText(/2026-08-27T10:00:00/)).toBeNull();
  });
});