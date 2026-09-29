import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import KnowledgeAdminPage from '@/features/knowledge/pages/admin';
import { knowledgeApi } from '@/services/knowledge';

// 控制 Tabs mock 只渲染哪一个 TabPane：categories=仅分类管理；articles=仅文章管理
let mockTabsMode: 'categories' | 'articles' = 'categories';

jest.mock('@/services/knowledge', () => ({
  knowledgeApi: {
    getCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    reorderCategories: jest.fn(),
    getArticles: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
    deleteArticle: jest.fn(),
    getAttachments: jest.fn(),
    deleteAttachment: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/DataState', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-state">{children}</div>,
}));

jest.mock('@arco-design/web-react/icon', () => ({
  IconUpload: () => <span>icon-upload</span>,
  IconPlus: () => <span>icon-plus</span>,
  IconEdit: () => <span>icon-edit</span>,
  IconDelete: () => <span>icon-delete</span>,
  IconDragDotVertical: () => <span>icon-drag</span>,
  IconBook: () => <span>icon-book</span>,
  IconFilePdf: () => <span>icon-file-pdf</span>,
  IconFileImage: () => <span>icon-file-image</span>,
  IconFile: () => <span>icon-file</span>,
}));

// 精简 Arco 组件：Tabs 只渲染指定页、Modal/Upload/Form/Select/Popconfirm 便于断言
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');

  const Form = Object.assign(
    ({ children }: any) => <form data-testid="form">{children}</form>,
    {
      useForm: () => {
        const form: any = {};
        form.validate = jest.fn().mockResolvedValue({});
        form.setFieldsValue = jest.fn();
        form.resetFields = jest.fn();
        form.getFieldsValue = jest.fn();
        return [form];
      },
      Item: ({ label, field, children }: any) => (
        <div data-testid={`form-item-${field ?? label}`}>
          {label && <label>{label}</label>}
          {children}
        </div>
      ),
    },
  );

  return {
    ...actual,
    Tabs: Object.assign(
      ({ defaultActiveTab, children }: any) => {
        const active = mockTabsMode || defaultActiveTab || 'categories';
        const panes = (Array.isArray(children) ? children : [children]).filter(
          (child: any) => child?.key === active,
        );
        return <div data-testid="tabs">{panes}</div>;
      },
      {
        TabPane: ({ children }: any) => <div data-testid="tab-pane">{children}</div>,
      },
    ),
    Table: ({ columns, data, pagination }: any) => (
      <table data-testid="arco-table">
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.title ?? c.dataIndex}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data || []).map((row: any) => (
            <tr key={row.id} data-testid={`article-row-${row.id}`}>
              {columns.map((c: any) => (
                <td key={c.dataIndex}>{c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    Modal: ({ visible, title, children, onOk, onCancel, okText, cancelText }: any) =>
      visible ? (
        <div data-testid={`modal-${title}`}>
          {children}
          <button type="button" data-testid="modal-ok" onClick={() => onOk?.()}>
            {okText || '确定'}
          </button>
          <button type="button" data-testid="modal-cancel" onClick={() => onCancel?.()}>
            {cancelText || '取消'}
          </button>
        </div>
      ) : null,
    Upload: ({ children }: any) => <div data-testid="upload-area">{children}</div>,
    Select: ({ options }: any) => (
      <select data-testid="select">
        {(options || []).map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    Popconfirm: ({ children, onOk }: any) => (
      <span data-testid="popconfirm">
        {children}
        <button type="button" data-testid="popconfirm-ok" onClick={() => onOk?.()}>
          确认
        </button>
      </span>
    ),
    Form,
    Message: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
  };
});

const mockedApi = knowledgeApi as jest.Mocked<typeof knowledgeApi>;

describe('知识库管理 - 分类管理（卡片式 / 拖拽排序 / 隐藏 ID 与排序）', () => {
  beforeEach(() => {
    mockTabsMode = 'categories';
    jest.clearAllMocks();
    mockedApi.getCategories.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        { id: 1, name: '公司制度', sort: 0, createdAt: '2026-08-01T10:00:00+08:00', updatedAt: '' },
        { id: 2, name: '培训资料', sort: 1, createdAt: '2026-08-02T10:00:00+08:00', updatedAt: '' },
      ],
    });
  });

  it('分类以卡片列表展示，不显示 ID 与 排序 列', async () => {
    render(<KnowledgeAdminPage />);

    expect(await screen.findByText('公司制度')).toBeInTheDocument();
    expect(screen.getByText('培训资料')).toBeInTheDocument();
    expect(screen.getByTestId('cat-1')).toBeInTheDocument();
    expect(screen.getByTestId('cat-2')).toBeInTheDocument();
    expect(screen.queryByText('ID')).not.toBeInTheDocument();
    expect(screen.queryByText('排序')).not.toBeInTheDocument();
  });

  it('拖拽卡片触发 reorderCategories 并按新顺序提交 ids', async () => {
    render(<KnowledgeAdminPage />);
    await screen.findByText('公司制度');

    mockedApi.reorderCategories.mockResolvedValue({ code: 0, message: 'ok', data: { success: true } });

    // 把第 1 个卡片拖到第 2 个卡片位置：顺序由 [1,2] 变为 [2,1]
    fireEvent.dragStart(screen.getByTestId('cat-1'));
    fireEvent.drop(screen.getByTestId('cat-2'));

    await waitFor(() => expect(mockedApi.reorderCategories).toHaveBeenCalled());
    expect(mockedApi.reorderCategories).toHaveBeenCalledWith([2, 1]);
  });
});

describe('知识库管理 - 文章管理（创建后出现上传区）', () => {
  beforeEach(() => {
    mockTabsMode = 'articles';
    jest.clearAllMocks();
    mockedApi.getCategories.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [{ id: 1, name: '公司制度', sort: 0, createdAt: '', updatedAt: '' }],
    });
    mockedApi.getArticles.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    mockedApi.getAttachments.mockResolvedValue({ code: 0, message: 'ok', data: [] });
  });

  it('新增文章成功后弹窗内出现附件上传区域（无需二次编辑）', async () => {
    mockedApi.createArticle.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { id: 5 },
    });

    render(<KnowledgeAdminPage />);
    await waitFor(() => expect(mockedApi.getArticles).toHaveBeenCalled());

    // 打开「新增文章」弹窗
    fireEvent.click(screen.getByText('新增文章'));
    await waitFor(() => expect(screen.getByTestId('modal-新增文章')).toBeInTheDocument());

    // 点击确定 → createArticle 成功 → 停留在编辑态并显示上传区
    fireEvent.click(screen.getByTestId('modal-ok'));

    await waitFor(() => expect(mockedApi.createArticle).toHaveBeenCalled());
    expect(await screen.findByTestId('upload-area')).toBeInTheDocument();
    expect(screen.getByText(/单个文件不超过/)).toBeInTheDocument();
  });

  it('删除附件需二次确认（Popconfirm），直接点击不删除（与分类/文章删除一致）', async () => {
    mockedApi.getArticles.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: [
          {
            id: 5,
            title: '文章A',
            categoryId: 1,
            categoryName: '公司制度',
            viewCount: 0,
            status: 'published',
            createdAt: '',
            updatedAt: '',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    mockedApi.getAttachments.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        {
          id: 99,
          articleId: 5,
          fileName: 'manual.pdf',
          fileType: 'pdf',
          fileSize: 2048,
          fileUrl: 'https://oss.example.com/manual.pdf',
          createdAt: '',
        },
      ],
    });
    mockedApi.deleteAttachment.mockResolvedValue({ code: 0, message: 'ok' });

    render(<KnowledgeAdminPage />);
    await waitFor(() => expect(screen.getByTestId('article-row-5')).toBeInTheDocument());

    // 打开编辑弹窗（会加载附件）
    fireEvent.click(screen.getByText('编辑'));
    const modal = await screen.findByTestId('modal-编辑文章');
    await waitFor(() => expect(mockedApi.getAttachments).toHaveBeenCalledWith(5));

    // 附件删除按钮被 Popconfirm 包裹：直接点击「删除」不应触发接口（限定在弹窗内，避免命中表格操作的确认）
    const pop = await within(modal).findByTestId('popconfirm');
    fireEvent.click(within(pop).getByText('删除'));
    expect(mockedApi.deleteAttachment).not.toHaveBeenCalled();

    // 确认后才真正删除
    fireEvent.click(within(modal).getByTestId('popconfirm-ok'));
    await waitFor(() => expect(mockedApi.deleteAttachment).toHaveBeenCalledWith(5, 99));
  });
});
