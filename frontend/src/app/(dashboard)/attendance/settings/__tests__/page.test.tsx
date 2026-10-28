import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttendanceSettingsPage from '@/app/(dashboard)/attendance/settings/page';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const Form = ({ children }: any) => <div>{children}</div>;
  Form.Item = ({ label, children }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  );
  const InputNumber = ({ value }: any) => (
    <input data-testid="input-number" readOnly value={value ?? ''} />
  );
  const Card = ({ title, children }: any) => (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  );
  const Space = ({ children }: any) => <div>{children}</div>;
  const Button = ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  const Message = { success: jest.fn(), error: jest.fn() };
  const Grid = {
    Row: ({ children }: any) => <div>{children}</div>,
    Col: ({ children }: any) => <div>{children}</div>,
  };
  // DataState 依赖项：错误态内容由外层 role="alert" 容器承载，
  // 这里不再重复声明 role，避免 getByRole('alert') 命中多个节点。
  const Result = ({ subTitle, extra }: any) => (
    <div>
      <p>{subTitle}</p>
      {extra}
    </div>
  );
  const Empty = ({ description }: any) => <div>{description}</div>;
  const Skeleton = () => null;
  return { Form, InputNumber, Card, Space, Button, Message, Grid, Result, Empty, Skeleton };
});

describe('AttendanceSettingsPage（考勤设置）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
  });

  it('加载成功后渲染设置表单', async () => {
    (attendanceApi.getSettings as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        lateThreshold: 30,
        earlyThreshold: 30,
        earlyClockInMinutes: 60,
        makeupDaysLimit: 30,
        makeupMonthlyLimit: 3,
      },
    });
    render(<AttendanceSettingsPage />);

    await waitFor(() => expect(screen.getByText('打卡规则')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('请求未返回时展示加载态，不渲染默认值表单', async () => {
    (attendanceApi.getSettings as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<AttendanceSettingsPage />);

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    // 关键：加载中也不许把默认值当真实配置摆出来
    expect(screen.queryByText('打卡规则')).not.toBeInTheDocument();
  });

  it('接口返回业务错误时展示错误态与重试，不渲染默认值表单', async () => {
    (attendanceApi.getSettings as jest.Mock).mockResolvedValue({
      code: 500,
      message: '加载考勤设置失败',
    });
    render(<AttendanceSettingsPage />);

    await waitFor(() => expect(screen.getByText('加载考勤设置失败')).toBeInTheDocument());
    // 关键：失败时绝不能渲染默认值表单，否则用户保存会把默认值写回真实配置
    expect(screen.queryByText('打卡规则')).not.toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('错误态点击重试后恢复表单', async () => {
    (attendanceApi.getSettings as jest.Mock).mockResolvedValueOnce({
      code: 500,
      message: '加载考勤设置失败',
    });
    render(<AttendanceSettingsPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    (attendanceApi.getSettings as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        lateThreshold: 15,
        earlyThreshold: 10,
        earlyClockInMinutes: 30,
        makeupDaysLimit: 7,
        makeupMonthlyLimit: 2,
      },
    });
    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('打卡规则')).toBeInTheDocument());
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
  });

  it('请求抛错时展示错误态', async () => {
    (attendanceApi.getSettings as jest.Mock).mockRejectedValue(new Error('网络异常'));
    render(<AttendanceSettingsPage />);

    await waitFor(() => expect(screen.getByText('网络异常')).toBeInTheDocument());
    expect(screen.queryByText('打卡规则')).not.toBeInTheDocument();
  });
});