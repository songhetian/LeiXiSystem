import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PunchDevicesPage from '@/features/attendance/pages/punch-devices';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getPunchDeviceList: jest.fn(),
    createPunchDevice: jest.fn(),
    updatePunchDevice: jest.fn(),
    deletePunchDevice: jest.fn(),
  },
}));

// 权限门：默认全放行，个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, toolbar }: any) => (
    <div data-testid="pro-table">
      {toolbar?.map((t: any) => (
        <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
      <table>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((col: any) => (
                <td key={col.dataIndex}>
                  {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => ({
  Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  Modal: { confirm: jest.fn() },
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Space: ({ children }: any) => <div>{children}</div>,
}));

// ModalForm 作为独立 seam mock：本页断言点在权限门与列表，不测表单内部
jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title }: any) => (visible ? <div data-testid="modal-form">{title}</div> : null),
}));

const mockDevices = [
  { id: 1, name: '前台打卡机', deviceNo: 'ZJ-001', ipAddress: '192.168.1.100', port: 80, enabled: true },
];

describe('PunchDevicesPage（打卡设备）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (attendanceApi.getPunchDeviceList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockDevices, total: 1 },
    });
  });

  it('渲染设备列表与新增设备按钮', async () => {
    render(<PunchDevicesPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));

    expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
    expect(screen.getByText('前台打卡机')).toBeInTheDocument();
  });

  it('无 attendance:manage 时新增/编辑/删除按钮不渲染', async () => {
    mockCan.mockReturnValue(false);
    render(<PunchDevicesPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));

    // 按钮无权限不渲染（PermissionGate），而非禁用
    expect(screen.queryByTestId('toolbar-add')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    // 设备列表照常展示（查看不受限）
    expect(screen.getByText('前台打卡机')).toBeInTheDocument();
  });
});
