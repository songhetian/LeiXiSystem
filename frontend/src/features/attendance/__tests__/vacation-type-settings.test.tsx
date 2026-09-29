import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationTypeSettingsPage from '@/features/attendance/pages/vacation-type-settings';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getVacationTypes: jest.fn(),
    createVacationType: jest.fn(),
    updateVacationType: jest.fn(),
    deleteVacationType: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, toolbar, error }: any) => (
    <div data-testid="pro-table">
      {error && <div data-testid="table-error">{error}</div>}
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

// 功能性 ModalForm mock：维护取值状态并回传 onOk，用于验证提交载荷
jest.mock('@/components/ModalForm', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ visible, fields, initialValues, onOk, onCancel, onValuesChange }: any) => {
      const [values, setValues] = React.useState(initialValues ?? {});
      React.useEffect(() => {
        setValues(initialValues ?? {});
      }, [initialValues]);
      if (!visible) return null;
      const set = (key: string, value: any) => {
        setValues((prev: any) => ({ ...prev, [key]: value }));
        onValuesChange?.(key, value);
      };
      return (
        <div data-testid="modal-form">
          {fields.map((f: any) => (
            <div key={f.key} data-testid={`field-${f.key}`}>
              <label>{f.label}</label>
              {f.type === 'select' && (
                <select
                  data-testid={`select-${f.key}`}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  <option value="" />
                  {(f.options || []).map((o: any) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.type === 'monthDays' && (
                <div data-testid="month-days-grid">
                  {(values[f.key] || new Array(12).fill(0)).map((v: number, i: number) => (
                    <input
                      key={i}
                      data-testid={`monthDays-${i}`}
                      value={String(v ?? '')}
                      onChange={(e) => {
                        const arr = [...(values[f.key] || new Array(12).fill(0))];
                        arr[i] = e.target.value === '' ? 0 : Number(e.target.value);
                        set(f.key, arr);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <button data-testid="modal-ok" onClick={() => onOk(values)}>确定</button>
          <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
        </div>
      );
    },
  };
});

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const Tag = ({ children }: any) => <span data-testid="tag">{children}</span>;
  const Space = ({ children }: any) => <div>{children}</div>;
  const Button = ({ children, onClick }: any) => (
    <button type="button" data-testid={`btn-${children}`} onClick={onClick}>
      {children}
    </button>
  );
  const Message = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
  const Modal = { confirm: jest.fn() };
  return { Tag, Space, Button, Message, Modal };
});

const MONTHLY_TYPE = {
  id: 3,
  code: 'monthly',
  name: '月假',
  baseDays: 4,
  enabled: true,
  sortOrder: 3,
  monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
};

const YEARLY_TYPE = {
  id: 1,
  code: 'annual',
  name: '年假',
  baseDays: 5,
  enabled: true,
  sortOrder: 1,
  monthlyDays: null,
};

describe('VacationTypeSettingsPage（月假额度配置）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (attendanceApi.getVacationTypes as jest.Mock).mockResolvedValue({
      code: 0,
      data: [YEARLY_TYPE, MONTHLY_TYPE],
    });
    (attendanceApi.createVacationType as jest.Mock).mockResolvedValue({ code: 0 });
    (attendanceApi.updateVacationType as jest.Mock).mockResolvedValue({ code: 0 });
  });

  it('默认按年额度模式，不显示 12 个月额度输入', async () => {
    render(<VacationTypeSettingsPage />);
    await waitFor(() => expect(attendanceApi.getVacationTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('toolbar-add'));

    expect(screen.queryByTestId('field-monthlyDays')).not.toBeInTheDocument();
  });

  it('切换为按月额度后显示 12 个月额度输入，并隐藏不结转的年度结转配置', async () => {
    render(<VacationTypeSettingsPage />);
    await waitFor(() => expect(attendanceApi.getVacationTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('toolbar-add'));
    expect(screen.getByTestId('field-carryOverRatio')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('select-monthlyMode'), { target: { value: 'true' } });

    expect(screen.getByTestId('field-monthlyDays')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^monthDays-\d+$/).length).toBe(12);
    expect(screen.queryByTestId('field-carryOverRatio')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-carryOverMaxDays')).not.toBeInTheDocument();
  });

  it('按月模式提交时携带 12 元素的 monthlyDays', async () => {
    render(<VacationTypeSettingsPage />);
    await waitFor(() => expect(attendanceApi.getVacationTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('toolbar-add'));
    fireEvent.change(screen.getByTestId('select-monthlyMode'), { target: { value: 'true' } });
    fireEvent.change(screen.getByTestId('monthDays-0'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('monthDays-7'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('modal-ok'));

    await waitFor(() => expect(attendanceApi.createVacationType).toHaveBeenCalled());
    const payload = (attendanceApi.createVacationType as jest.Mock).mock.calls[0][0];
    expect(payload.monthlyDays).toHaveLength(12);
    expect(payload.monthlyDays[0]).toBe(4);
    expect(payload.monthlyDays[7]).toBe(5);
  });

  it('按年模式提交时 monthlyDays 为 null（清空月假额度）', async () => {
    render(<VacationTypeSettingsPage />);
    await waitFor(() => expect(attendanceApi.getVacationTypes).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('toolbar-add'));
    fireEvent.click(screen.getByTestId('modal-ok'));

    await waitFor(() => expect(attendanceApi.createVacationType).toHaveBeenCalled());
    const payload = (attendanceApi.createVacationType as jest.Mock).mock.calls[0][0];
    expect(payload.monthlyDays).toBeNull();
  });

  it('编辑月假类型时回填按月模式与各月额度', async () => {
    render(<VacationTypeSettingsPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row').length).toBe(2));

    fireEvent.click(screen.getAllByTestId('btn-编辑')[1]);

    expect(screen.getByTestId('field-monthlyDays')).toBeInTheDocument();
    await waitFor(() => {
      expect((screen.getByTestId('monthDays-6') as HTMLInputElement).value).toBe('5');
    });

    fireEvent.change(screen.getByTestId('monthDays-6'), { target: { value: '6' } });
    fireEvent.click(screen.getByTestId('modal-ok'));

    await waitFor(() => expect(attendanceApi.updateVacationType).toHaveBeenCalled());
    const [id, payload] = (attendanceApi.updateVacationType as jest.Mock).mock.calls[0];
    expect(id).toBe(3);
    expect(payload.monthlyDays[6]).toBe(6);
  });

  it('接口返回业务错误(code!==0)时展示错误态，而非静默空表', async () => {
    (attendanceApi.getVacationTypes as jest.Mock).mockResolvedValue({
      code: 500,
      message: '查询假期类型失败',
    });
    render(<VacationTypeSettingsPage />);

    await waitFor(() =>
      expect(screen.getByTestId('table-error')).toHaveTextContent('查询假期类型失败'),
    );
  });
});