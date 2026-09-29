import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemLogsPage from '@/features/system/pages/logs';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/system', () => ({
  systemApi: {
    listLogs: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, searchFields, pagination }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <span key={f.key} data-testid={`search-${f.key}`}>{f.label}</span>
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
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((c: any) => (
                <td key={c.dataIndex} data-testid={`cell-${row[rowKey]}-${c.dataIndex}`}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination !== false && (
        <div data-testid="pagination">
          <span data-testid="page-total">{pagination.total}</span>
        </div>
      )}
    </div>
  ),
}));

const mockLogs = [
  {
    id: 9,
    username: 'admin',
    module: 'auth',
    action: 'login',
    method: 'POST',
    url: '/api/auth/login',
    ip: '127.0.0.1',
    status: 'success',
    createdAt: '2026-09-28T10:36:44.000Z',
  },
];

describe('系统操作日志页', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (systemApi.listLogs as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: mockLogs, total: 1, page: 1, pageSize: 20 },
    });
  });

  it('时间列按北京时间格式化，不泄漏 ISO 原始串', async () => {
    render(<SystemLogsPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });
    expect(screen.getByTestId('cell-9-createdAt')).toHaveTextContent('2026-09-28 18:36');
    expect(screen.queryByText(/2026-09-28T10:36:44/)).toBeNull();
  });
});
