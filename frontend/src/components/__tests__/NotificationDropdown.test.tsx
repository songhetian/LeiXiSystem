import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationDropdown } from '../NotificationDropdown';
import { notificationApi } from '@/services/notification';

const mockPush = jest.fn();
jest.mock('@/services/notification');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedNotificationApi = notificationApi as jest.Mocked<typeof notificationApi>;

const mockNotifications = [
  { id: 1, title: '审批通过', content: '您的请假申请已通过', type: 'approval', read: false, createdAt: '2026-08-14T09:00:00+08:00' },
  { id: 2, title: '工资条已发布', content: '2026年7月工资条已发布', type: 'payslip', read: false, createdAt: '2026-08-13T10:00:00+08:00' },
  { id: 3, title: '系统公告', content: '系统将于今晚维护', type: 'system', read: true, createdAt: '2026-08-12T08:00:00+08:00' },
];

describe('NotificationDropdown（通知下拉面板）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotificationApi.list.mockResolvedValue({
      code: 0,
      data: { list: mockNotifications.slice(0, 2), total: 2, page: 1, pageSize: 5 },
    });
    mockedNotificationApi.unreadCount.mockResolvedValue({ code: 0, data: { count: 2 } });
    mockedNotificationApi.markRead.mockResolvedValue({ code: 0 });
    mockedNotificationApi.markAllRead.mockResolvedValue({ code: 0 });
  });

  it('显示未读数量 Badge', async () => {
    render(<NotificationDropdown />);
    await waitFor(() => {
      expect(screen.getByTestId('notification-trigger')).toBeInTheDocument();
    });
    expect(mockedNotificationApi.unreadCount).toHaveBeenCalled();
  });

  it('触发器暴露 aria-haspopup / aria-expanded / aria-controls（SC 4.1.2）', async () => {
    render(<NotificationDropdown />);
    const trigger = await screen.findByTestId('notification-trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'notification-panel-root');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('Escape 关闭面板并把焦点归还触发器（SC 2.1.1 / 2.4.3）', async () => {
    render(<NotificationDropdown />);
    const trigger = await screen.findByTestId('notification-trigger');
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByTestId('notification-panel')).toBeInTheDocument(),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('点击触发按钮展开后加载未读通知列表', async () => {
    render(<NotificationDropdown />);
    await waitFor(() => screen.getByTestId('notification-trigger'));
    fireEvent.click(screen.getByTestId('notification-trigger'));
    // 展开后应该调用 list 接口
    await waitFor(() => {
      expect(mockedNotificationApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ read: false }),
      );
    });
  });

  it('点击全部已读调用 markAllRead', async () => {
    render(<NotificationDropdown />);
    await waitFor(() => screen.getByTestId('notification-trigger'));
    fireEvent.click(screen.getByTestId('notification-trigger'));
    await waitFor(() => expect(mockedNotificationApi.list).toHaveBeenCalled());
    // 查找并点击全部已读按钮
    const markAllBtn = screen.getByText('全部已读');
    fireEvent.click(markAllBtn);
    await waitFor(() => {
      expect(mockedNotificationApi.markAllRead).toHaveBeenCalled();
    });
  });

  it('通知列表业务码非 0 时展示失败与重试，不伪装成「暂无新通知」', async () => {
    mockedNotificationApi.list.mockResolvedValue({ code: 500, message: '通知加载失败' });
    render(<NotificationDropdown />);
    await waitFor(() => screen.getByTestId('notification-trigger'));
    fireEvent.click(screen.getByTestId('notification-trigger'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('通知加载失败');
    expect(screen.queryByText('暂无新通知')).not.toBeInTheDocument();

    // 重试成功后恢复正常列表
    mockedNotificationApi.list.mockResolvedValue({
      code: 0,
      data: { list: mockNotifications.slice(0, 2), total: 2, page: 1, pageSize: 5 },
    });
    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('审批通过')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('点击查看全部跳转到通知中心', async () => {
    render(<NotificationDropdown />);
    await waitFor(() => screen.getByTestId('notification-trigger'));
    fireEvent.click(screen.getByTestId('notification-trigger'));
    await waitFor(() => expect(mockedNotificationApi.list).toHaveBeenCalled());
    fireEvent.click(screen.getByText('查看全部'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });
});
