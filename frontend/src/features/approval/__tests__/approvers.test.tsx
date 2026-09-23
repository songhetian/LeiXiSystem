import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApproverManagementPage from '@/features/approval/pages/approvers';
import { approvalApi } from '@/services/approval';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listGroups: jest.fn(),
    updateGroup: jest.fn(),
    createGroup: jest.fn(),
    deleteGroup: jest.fn(),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: {
    listUsers: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

jest.mock('@/components/DataState', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-state">{children}</div>,
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Tag: ({ color, children }: any) => <span data-testid="tag" data-color={color}>{children}</span>,
    Select: () => <select data-testid="member-select" />,
    Space: ({ children }: any) => <span data-testid="space">{children}</span>,
  };
});

const groups = [
  { id: 1, name: '部门主管组', code: 'AG001', status: 1, members: [{ id: 11, groupId: 1, userId: 101 }] },
  { id: 2, name: '财务审批组', code: 'AG002', status: 0, members: [] },
];

const users = [
  { id: 101, username: 'zhangsan', name: '张三' },
  { id: 102, username: 'lisi', name: '李四' },
];

describe('ApproverManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (approvalApi.listGroups as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: groups, total: 2, page: 1, pageSize: 100 },
    });
    (systemApi.listUsers as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: users, total: 2, page: 1, pageSize: 100 },
    });
  });

  it('加载审批组列表并展示组名、编码、成员', async () => {
    render(<ApproverManagementPage />);
    expect(await screen.findByText('部门主管组')).toBeInTheDocument();
    expect(screen.getByText('AG001')).toBeInTheDocument();
    expect(await screen.findByText('张三')).toBeInTheDocument();
  });

  it('staleTime 内二次挂载复用缓存，listGroups 仅请求一次', async () => {
    const { unmount } = render(<ApproverManagementPage />);
    await waitFor(() => expect(approvalApi.listGroups).toHaveBeenCalledTimes(1));
    unmount();
    render(<ApproverManagementPage />);
    await waitFor(() => expect(screen.getAllByText('部门主管组').length).toBeGreaterThan(0));
    expect(approvalApi.listGroups).toHaveBeenCalledTimes(1);
  });
});