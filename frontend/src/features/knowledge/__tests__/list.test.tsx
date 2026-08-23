import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import KnowledgeListPage from '@/features/knowledge/pages/list';
import { knowledgeApi } from '@/services/knowledge';

jest.mock('@/services/knowledge', () => ({
  knowledgeApi: {
    getCategories: jest.fn(),
    getArticles: jest.fn(),
    getArticleDetail: jest.fn(),
    getAttachments: jest.fn(),
    getPreviewUrl: jest.fn(),
  },
}));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
      <div data-testid="page-action">{action}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onPageChange, onRowClick }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
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
            <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick}>
              {t.label}
            </button>
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
            <tr
              key={row[rowKey]}
              data-testid="table-row"
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
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
          <span data-testid="page-current">{pagination.current}</span>
          <span data-testid="page-total">{pagination.total}</span>
        </div>
      )}
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  return {
    ...original,
    Modal: ({ visible, title, onOk, onCancel, children, footer }: any) =>
      visible ? (
        <div data-testid="detail-modal" data-title={title}>
          {children}
          {footer !== null && (
            <div data-testid="modal-footer">
              <button data-testid="modal-ok" onClick={onOk}>确定</button>
              <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
            </div>
          )}
        </div>
      ) : null,
  };
});

const mockCategories = [
  { id: 1, name: '公司制度', sort: 1, articleCount: 5 },
  { id: 2, name: '培训资料', sort: 2, articleCount: 3 },
  { id: 3, name: '常见问题', sort: 3, articleCount: 8 },
];

const mockArticles = [
  {
    id: 1,
    title: '员工手册',
    categoryName: '公司制度',
    summary: '公司基本规章制度说明',
    authorName: '管理员',
    viewCount: 100,
    status: 'published',
    createdAt: '2026-08-01T10:00:00+08:00',
  },
  {
    id: 2,
    title: '入职指南',
    categoryName: '培训资料',
    summary: '新员工入职流程和注意事项',
    authorName: 'HR',
    viewCount: 50,
    status: 'published',
    createdAt: '2026-08-05T10:00:00+08:00',
  },
  {
    id: 3,
    title: '考勤常见问题',
    categoryName: '常见问题',
    summary: '考勤系统使用常见问题解答',
    authorName: '行政',
    viewCount: 200,
    status: 'published',
    createdAt: '2026-08-10T10:00:00+08:00',
  },
];

describe('KnowledgeListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (knowledgeApi.getCategories as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockCategories,
        total: 3,
        page: 1,
        pageSize: 100,
      },
    });
    (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockArticles,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
    (knowledgeApi.getArticleDetail as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        ...mockArticles[0],
        content: '<p>员工手册内容...</p>',
        categoryId: 1,
      },
    });
    (knowledgeApi.getAttachments as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [],
    });
  });

  describe('正常用例', () => {
    it('renders PageContainer with title 知识库', () => {
      render(<KnowledgeListPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('知识库');
    });

    it('renders ProTable with article columns', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-title')).toHaveTextContent('标题');
      expect(screen.getByTestId('col-categoryName')).toHaveTextContent('分类');
      expect(screen.getByTestId('col-summary')).toHaveTextContent('摘要');
      expect(screen.getByTestId('col-authorName')).toHaveTextContent('作者');
      expect(screen.getByTestId('col-viewCount')).toHaveTextContent('阅读量');
      expect(screen.getByTestId('col-createdAt')).toHaveTextContent('创建时间');
    });

    it('fetches categories and articles on mount', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getCategories).toHaveBeenCalled();
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });

    it('renders article data in table', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-title')).toHaveTextContent('员工手册');
      expect(screen.getByTestId('cell-1-categoryName')).toHaveTextContent('公司制度');
      expect(screen.getByTestId('cell-1-viewCount')).toHaveTextContent('100');
    });

    it('renders search fields', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-keyword')).toHaveTextContent('关键词');
      expect(screen.getByTestId('search-categoryId')).toHaveTextContent('分类');
    });

    it('shows pagination info', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('3');
    });
  });

  describe('查看详情', () => {
    it('opens detail modal when row clicked', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('cell-1-title'));
      await waitFor(() => {
        expect(knowledgeApi.getArticleDetail).toHaveBeenCalledWith(1);
      });
    });

    it('fetches attachments when viewing detail', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('cell-1-title'));
      await waitFor(() => {
        expect(knowledgeApi.getAttachments).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('分类筛选', () => {
    it('filters articles by category', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (knowledgeApi.getArticles as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<KnowledgeListPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty article list', async () => {
      (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles article not found error (code 5002)', async () => {
      (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
        code: 5002,
        message: '文章不存在',
      });
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });

    it('handles permission error (code 5003)', async () => {
      (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
        code: 5003,
        message: '无权限访问该数据',
      });
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });
  });
});
