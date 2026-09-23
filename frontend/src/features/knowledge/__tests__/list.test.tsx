import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import KnowledgeListPage from '@/features/knowledge/pages/list';
import { knowledgeApi } from '@/services/knowledge';
import { clearDataCache } from '@/hooks/use-cached-data';

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
      {title && <h2 data-testid="page-title">{title}</h2>}
      <div data-testid="page-action">{action}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  return {
    ...original,
    Input: {
      ...(original.Input ?? {}),
      Search: ({ onChange, onSearch, value, disabled }: any) => (
        <input
          data-testid="keyword-search"
          data-disabled={String(!!disabled)}
          value={value ?? ''}
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
    clearDataCache();
    jest.clearAllMocks();
    (knowledgeApi.getCategories as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockCategories,
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

  describe('根视图（文件夹卡片）', () => {
    it('不渲染冗余页面大标题（顶部已有全局面包屑）', () => {
      render(<KnowledgeListPage />);
      expect(screen.queryByTestId('page-title')).toBeNull();
    });

    it('挂载时拉取分类与文章', async () => {
      render(<KnowledgeListPage />);
      await waitFor(() => {
        expect(knowledgeApi.getCategories).toHaveBeenCalled();
        expect(knowledgeApi.getArticles).toHaveBeenCalled();
      });
    });

    it('根视图展示分类文件夹卡片（含未分类）与文档计数', async () => {
      render(<KnowledgeListPage />);
      expect(await screen.findByText('公司制度')).toBeInTheDocument();
      expect(screen.getByText('培训资料')).toBeInTheDocument();
      expect(screen.getByText('常见问题')).toBeInTheDocument();
      expect(screen.getByText('未分类')).toBeInTheDocument();
      expect(screen.getByText('2 篇')).toBeInTheDocument();
    });

    it('未进入分类时搜索框不可用', async () => {
      render(<KnowledgeListPage />);
      await screen.findByText('公司制度');
      expect(screen.getByTestId('keyword-search')).toHaveAttribute('data-disabled', 'true');
    });

    it('根视图不直接平铺文章列表', async () => {
      render(<KnowledgeListPage />);
      await screen.findByText('公司制度');
      expect(screen.queryByText('员工手册')).not.toBeInTheDocument();
    });
  });

  describe('分类内（文章卡片）', () => {
    it('点击文件夹进入分类，展示该分类文章卡片', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await user.click(await screen.findByText('公司制度'));
      expect(await screen.findByText('员工手册')).toBeInTheDocument();
      expect(screen.getByText('差旅报销制度')).toBeInTheDocument();
      // 其他分类文章不显示
      expect(screen.queryByText('入职指南')).not.toBeInTheDocument();
    });

    it('进入分类后搜索框可用，输入关键字过滤文章', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await user.click(await screen.findByText('公司制度'));
      await screen.findByText('员工手册');
      expect(screen.getByTestId('keyword-search')).toHaveAttribute('data-disabled', 'false');
      await user.type(screen.getByTestId('keyword-search'), '差旅');
      await waitFor(() => {
        expect(screen.getByText('差旅报销制度')).toBeInTheDocument();
        expect(screen.queryByText('员工手册')).not.toBeInTheDocument();
      });
    });

    it('支持返回根视图并重新看到文件夹', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await user.click(await screen.findByText('公司制度'));
      await screen.findByText('员工手册');
      await user.click(screen.getByRole('button', { name: /返回/ }));
      expect(await screen.findByText('培训资料')).toBeInTheDocument();
    });
  });

  describe('文章预览', () => {
    it('点击文章打开预览并拉取详情与附件', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await user.click(await screen.findByText('公司制度'));
      await user.click(await screen.findByText('员工手册'));
      await waitFor(() => {
        expect(knowledgeApi.getArticleDetail).toHaveBeenCalledWith(1);
        expect(knowledgeApi.getAttachments).toHaveBeenCalledWith(1);
      });
    });

    it('预览弹窗提供附件预览按钮', async () => {
      const user = userEvent.setup();
      render(<KnowledgeListPage />);
      await user.click(await screen.findByText('公司制度'));
      await user.click(await screen.findByText('员工手册'));
      expect(await screen.findByText('手册.pdf')).toBeInTheDocument();
    });
  });

  describe('内嵌附件预览', () => {
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
      await user.click(await screen.findByText('公司制度'));
      await user.click(await screen.findByText('员工手册'));
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
    it('空文章时根视图仍显示文件夹卡片（0 篇），不平铺文章', async () => {
      (knowledgeApi.getArticles as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 200 },
      });
      render(<KnowledgeListPage />);
      expect(await screen.findByText('公司制度')).toBeInTheDocument();
      expect(screen.getByText('未分类')).toBeInTheDocument();
      expect(screen.queryByText('员工手册')).not.toBeInTheDocument();
    });
  });
});