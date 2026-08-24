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

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  return {
    ...original,
    Tree: ({ treeData, onSelect, selectedKeys }: any) => (
      <div data-testid="category-tree">
        {treeData?.map((root: any) => (
          <div key={root.key}>
            <button
              data-testid={`tree-node-${root.key}`}
              data-selected={String(selectedKeys?.includes(root.key))}
              onClick={() => onSelect?.([root.key])}
            >
              {root.title}
            </button>
            {root.children?.map((child: any) => (
              <button
                key={child.key}
                data-testid={`tree-node-${child.key}`}
                data-selected={String(selectedKeys?.includes(child.key))}
                onClick={() => onSelect?.([child.key])}
              >
                {child.title}
              </button>
            ))}
          </div>
        ))}
      </div>
    ),
    Input: {
      ...original.Input ?? {},
      Search: ({ onChange, onSearch }: any) => (
        <input
          data-testid="keyword-search"
          onChange={(e) => {
            onChange?.(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      ),
    },
    Modal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <div data-testid={`modal-${title}`}>
          {children}
          {footer}
        </div>
      ) : null,
  };
});

jest.mock('../components/FilePreviewModal', () => ({
  __esModule: true,
  default: ({ file }: any) =>
    file ? <div data-testid="file-preview-modal" data-name={file.name} /> : null,
}));

const mockCategories = [
  { id: 1, name: '公司制度', sort: 1, articleCount: 2, createdAt: '', updatedAt: '' },
  { id: 2, name: '培训资料', sort: 2, articleCount: 1, createdAt: '', updatedAt: '' },
  { id: 3, name: '常见问题', sort: 3, articleCount: 0, createdAt: '', updatedAt: '' },
];

const mockArticles = [
  { id: 1, title: '员工手册', categoryId: 1, categoryName: '公司制度', summary: '公司基本规章制度说明', authorName: '管理员', viewCount: 100, status: 'published', createdAt: '2026-08-01T10:00:00+08:00' },
  { id: 2, title: '差旅报销制度', categoryId: 1, categoryName: '公司制度', summary: '差旅报销说明', authorName: 'HR', viewCount: 50, status: 'published', createdAt: '2026-08-05T10:00:00+08:00' },
  { id: 3, title: '入职指南', categoryId: 2, categoryName: '培训资料', summary: '新员工入职流程', authorName: 'HR', viewCount: 30, status: 'published', createdAt: '2026-08-10T10:00:00+08:00' },
];

const mockAttachment = { id: 11, articleId: 1, fileName: '手册.pdf', fileType: 'pdf', fileSize: 2048, fileUrl: '/uploads/x.pdf', createdAt: '' };

describe('KnowledgeListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (knowledgeApi.getCategories as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockCategories, total: 3, page: 1, pageSize: 100 },
    });
    (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockArticles, total: 3, page: 1, pageSize: 200 },
    });
    (knowledgeApi.getArticleDetail as jest.Mock).mockResolvedValue({
      code: 0,
      data: { ...mockArticles[0], content: '<p>内容</p>', categoryId: 1 },
    });
    (knowledgeApi.getAttachments as jest.Mock).mockResolvedValue({ code: 0, data: [mockAttachment] });
    (knowledgeApi.getPreviewUrl as jest.Mock).mockResolvedValue({
      code: 0,
      data: { previewUrl: '/knowledge/preview/11?token=abc', expiresAt: 0, fileName: '手册.pdf' },
    });
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: jest.fn(() => 'blob:mock') });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: jest.fn() });
  });

  describe('正常用例', () => {
    it('渲染 PageContainer 标题知识库', () => {
      render(<KnowledgeListPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('知识库');
    });

    it('挂载时拉取分类与文章', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getCategories).toHaveBeenCalled();
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });

    it('渲染左侧分类树（全部 + 各分类）', async () => {
      render(<KnowledgeListPage />);
      expect(await screen.findByTestId('category-tree')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-all')).toHaveTextContent('全部');
      expect(screen.getByTestId('tree-node-1')).toHaveTextContent('公司制度');
      expect(screen.getByTestId('tree-node-3')).toHaveTextContent('常见问题');
    });

    it('默认选中全部并展示全部文章', async () => {
      render(<KnowledgeListPage />);
      expect(await screen.findByText('员工手册')).toBeInTheDocument();
      expect(screen.getByText('入职指南')).toBeInTheDocument();
    });
  });

  describe('分类过滤', () => {
    it('点击分类节点过滤文章', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await screen.findByText('员工手册');
      await user.click(screen.getByTestId('tree-node-2'));
      await waitFor(() => {
        expect(screen.getByText('入职指南')).toBeInTheDocument();
        expect(screen.queryByText('员工手册')).not.toBeInTheDocument();
      });
    });
  });

  describe('关键字搜索', () => {
    it('输入关键字过滤文章', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await screen.findByText('员工手册');
      await user.type(screen.getByTestId('keyword-search'), '差旅');
      await waitFor(() => {
        expect(screen.getByText('差旅报销制度')).toBeInTheDocument();
        expect(screen.queryByText('员工手册')).not.toBeInTheDocument();
      });
    });
  });

  describe('文章详情', () => {
    it('点击文章打开详情并拉取详情与附件', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await screen.findByText('员工手册');
      await user.click(screen.getByText('员工手册'));
      await waitFor(() => {
        expect(knowledgeApi.getArticleDetail).toHaveBeenCalledWith(1);
        expect(knowledgeApi.getAttachments).toHaveBeenCalledWith(1);
      });
    });

    it('详情附件提供预览按钮', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await screen.findByText('员工手册');
      await user.click(screen.getByText('员工手册'));
      expect(await screen.findByText('手册.pdf')).toBeInTheDocument();
    });
  });

  describe('内嵌预览', () => {
    it('点击预览获取下载 blob 并打开内嵌模态', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (k: string) => (k === 'content-type' ? 'application/pdf' : k === 'content-disposition' ? 'inline; filename="手册.pdf"' : null),
        },
        blob: () => Promise.resolve(new Blob()),
      }) as any;
      render(<KnowledgeListPage />);
      await screen.findByText('员工手册');
      await user.click(screen.getByText('员工手册'));
      const previewBtn = await screen.findByText('预览');
      await user.click(previewBtn);
      await waitFor(() => {
        expect(knowledgeApi.getPreviewUrl).toHaveBeenCalledWith(11);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/download?token=abc'),
        );
      });
      expect(await screen.findByTestId('file-preview-modal')).toHaveAttribute('data-name', '手册.pdf');
    });
  });

  describe('边界用例', () => {
    it('处理空文章列表', async () => {
      (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 200 },
      });
      render(<KnowledgeListPage />);
      expect(await screen.findByText(/暂无文档/)).toBeInTheDocument();
    });
  });
});