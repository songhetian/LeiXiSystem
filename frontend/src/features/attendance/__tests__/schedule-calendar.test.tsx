import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScheduleCalendarPage from '@/features/attendance/pages/schedule-calendar';
import { attendanceApi } from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';
import { clearDataCache } from '@/hooks/use-cached-data';
import { Message, Modal } from '@arco-design/web-react';
import * as XLSX from 'xlsx';

// 权限门：默认全放行，个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [{ id: 1, name: '研发部' }], loading: false }),
}));

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getShiftList: jest.fn(),
    getScheduleMatrix: jest.fn(),
    getLeaveList: jest.fn(),
    batchCreateSchedule: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    batchDeleteSchedules: jest.fn(),
  },
}));

jest.mock('@/components/EmployeeSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="employee-select" />,
}));

jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn(() => true),
}));

jest.mock('xlsx', () => ({
  read: jest.fn(),
  writeFile: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
    aoa_to_sheet: jest.fn(),
    book_new: jest.fn(),
    book_append_sheet: jest.fn(),
  },
}));

// 页面仅用 Arco 排版/表格组件，断言点在工具栏按钮：Table 等重组件用轻桩
jest.mock('@arco-design/web-react', () => ({
  // 轻量渲染真实行/列结构：页面把键盘交互放在单元格按钮与表头 th 上，需要真实节点断言
  Table: ({ columns, data, noDataElement }: any) => (
    <div data-testid="calendar-table">
      <table>
        <thead>
          <tr>
            {columns.map((col: any, i: number) => {
              const hp = col.onHeaderCell ? col.onHeaderCell(col, i) : {};
              // 页面用 data-cal-head 做表头方向键定位，桩必须整体透传，否则键位查询不到目标
              return (
                <th key={col.key ?? i} {...hp}>
                  {col.title}
                </th>
              );
            })}
          </tr>
        </thead>
        {data?.length ? (
          <tbody>
            {data.map((record: any, rowIdx: number) => (
              <tr key={record.id}>
                {columns.map((col: any, colIdx: number) => {
                  const cp = col.onCell ? col.onCell(record, rowIdx) : {};
                  return (
                    <td key={col.key ?? colIdx} onClick={cp.onClick} style={cp.style}>
                      {col.render ? col.render(undefined, record, rowIdx) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ) : null}
      </table>
      {data?.length ? null : noDataElement}
    </div>
  ),
  Button: ({ children, onClick, icon }: any) => (
    <button type="button" onClick={onClick}>{icon}{children}</button>
  ),
  Select: Object.assign(
    // 渲染为原生 select，便于用例真实改变筛选/印章：页面里有部门、印章、班次三处
    ({ children, value, onChange }: any) => (
      <select
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange?.(raw === '' ? undefined : raw === 'clear' ? 'clear' : Number(raw));
        }}
      >
        {children}
      </select>
    ),
    { Option: ({ value, children }: any) => <option value={value}>{children}</option> },
  ),
  Modal: Object.assign(
    ({ visible, children }: any) => (visible ? <div data-testid="modal">{children}</div> : null),
    { confirm: jest.fn() },
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  DatePicker: Object.assign(() => <div />, { MonthPicker: () => <div /> }),
  Spin: ({ children }: any) => <div>{children}</div>,
  Message: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
  Space: ({ children }: any) => <div>{children}</div>,
  Input: ({ value, onChange }: any) => (
    <input value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
  ),
  Switch: ({ checked, onChange }: any) => (
    <button
      type="button"
      data-testid="stamp-switch"
      aria-pressed={checked}
      onClick={() => onChange?.(!checked)}
    />
  ),
  Typography: { Text: ({ children }: any) => <span>{children}</span> },
}));

jest.mock('@arco-design/web-react/icon', () => ({
  IconLeft: () => <span />,
  IconRight: () => <span />,
  IconRefresh: () => <span />,
  IconPlus: () => <span />,
  IconSearch: () => <span />,
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

const EMPTY_LEAVES = { code: 0, data: { list: [], total: 0, page: 1, pageSize: 100 } };

// 当前查看月份按系统时间决定，日期断言跟着动态取，避免写死月份后跨月失败
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const NOW = new Date();
const YM = `${NOW.getFullYear()}-${pad2(NOW.getMonth() + 1)}`;
const D1 = `${YM}-01`;
const D2 = `${YM}-02`;
const DLAST = `${YM}-${pad2(new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate())}`;

describe('ScheduleCalendarPage（排班日历）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ id: 1, name: '早班', startTime: '08:00', endTime: '16:00', color: '#4ECDC4' }] },
    });
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [{ id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 }],
        schedules: [],
      },
    });
    (attendanceApi.getLeaveList as jest.Mock).mockResolvedValue(EMPTY_LEAVES);
  });

  it('有 attendance:manage 时导入/新增排班按钮渲染', async () => {
    render(<ScheduleCalendarPage />);
    // 等基础数据落地，工具栏随渲染出现
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: '导入' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增排班' })).toBeInTheDocument();
    expect(screen.getByTestId('stamp-switch')).toBeInTheDocument();
  });

  it('无 attendance:manage 时导入/印章模式/新增排班不渲染，查看类按钮保留', async () => {
    mockCan.mockReturnValue(false);
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    // 按钮无权限不渲染（PermissionGate），而非禁用
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增排班' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('stamp-switch')).not.toBeInTheDocument();
    // 查看/切换/导出类动作不受考勤管理权限点限制
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载模板' })).toBeInTheDocument();
  });

  it('首屏默认查看全部部门，不自动选中第一个部门', async () => {
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    // 排班矩阵请求不应带 departmentId；全公司视图才是进入页面时的默认范围
    const calls = (attendanceApi.getScheduleMatrix as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(([params]) => expect(params.departmentId).toBeUndefined());
  });

  it('首屏显示加载态，数据落地后渲染日历表格', async () => {
    render(<ScheduleCalendarPage />);

    // 首帧就是 loading：不能先闪「当前部门暂无员工」
    expect(screen.getByText('正在加载排班数据')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-table')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());
    expect(screen.queryByText('正在加载排班数据')).not.toBeInTheDocument();
  });

  it('排班矩阵加载失败展示页面内错误横幅与重试，重试成功后恢复', async () => {
    // 反复失败：部门默认值初始化会换一次 cacheKey，单次失败会被新 key 的请求盖掉
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 500,
      message: '排班服务异常',
    });

    render(<ScheduleCalendarPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('排班服务异常');
    // 失败时不能显示「暂无员工」空态，否则用户会以为真的没有员工
    expect(screen.queryByText('当前部门暂无员工')).not.toBeInTheDocument();

    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [{ id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 }],
        schedules: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('请假记录超过单页上限（100）时循环分页拉全量', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      employeeId: 1,
      vacationTypeId: 1,
      startDate: '2026-11-02',
      endDate: '2026-11-02',
      days: 1,
      reason: '事假',
      status: 'approved',
    }));
    (attendanceApi.getLeaveList as jest.Mock).mockImplementation(({ page }: any) =>
      Promise.resolve({
        code: 0,
        data: {
          list:
            page === 1
              ? firstPage
              : [
                  {
                    id: 101,
                    employeeId: 1,
                    vacationTypeId: 1,
                    startDate: '2026-11-20',
                    endDate: '2026-11-20',
                    days: 1,
                    reason: '事假',
                    status: 'approved',
                  },
                ],
          total: 101,
          page,
          pageSize: 100,
        },
      }),
    );

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    await waitFor(() =>
      expect(attendanceApi.getLeaveList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', page: 2, pageSize: 100 }),
      ),
    );
  });

  it('导出范围跟随当前筛选：只导出搜索命中的员工', async () => {
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [
          { id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 },
          { id: 2, name: '李四', employeeNo: 'E002', departmentId: 1 },
        ],
        schedules: [
          { id: 11, employeeId: 1, shiftId: 1, workDate: '2026-11-02' },
          { id: 12, employeeId: 2, shiftId: 1, workDate: '2026-11-02' },
        ],
      },
    });

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '张' } });
    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const rows = (exportToExcel as jest.Mock).mock.calls[0][3] as { emp?: { name?: string } }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].emp?.name).toBe('张三');
  });

  it('日期格是可聚焦按钮，可读名称包含员工、日期与状态', async () => {
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const cell = screen.getByRole('button', { name: `张三 ${D1} 未排班` });
    // 原生 button 默认可聚焦（tabIndex 0），无需显式写 tabindex 属性
    expect((cell as HTMLButtonElement).tabIndex).toBe(0);
    // 聚焦会同步更新 roving tabindex（state 变更需包在 act 内）
    act(() => cell.focus());
    expect(document.activeElement).toBe(cell);
  });

  it('方向键在日期格间移动焦点，边界不越界', async () => {
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [
          { id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 },
          { id: 2, name: '李四', employeeNo: 'E002', departmentId: 1 },
        ],
        schedules: [],
      },
    });

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const first = screen.getByRole('button', { name: `张三 ${D1} 未排班` });
    const second = screen.getByRole('button', { name: `张三 ${D2} 未排班` });
    const nextRow = screen.getByRole('button', { name: `李四 ${D1} 未排班` });

    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);

    // 上边界：首行按上键停在原地
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);

    // 跨行向下
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(nextRow);

    // End 跳到当行最后一列（当月最后一天）
    fireEvent.keyDown(nextRow, { key: 'End' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: `李四 ${DLAST} 未排班` }),
    );
  });

  it('表头是键盘可达的批量排班入口，Enter 打开当日批量弹窗', async () => {
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const header = screen.getByLabelText(new RegExp(`${D1} 对当前筛选`));
    expect(header).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(header, { key: 'Enter' });

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('表头方向键在日期列之间移动焦点', async () => {
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const first = screen.getByLabelText(new RegExp(`${D1} 对当前筛选`));
    const second = screen.getByLabelText(new RegExp(`${D2} 对当前筛选`));

    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);

    // 左边界不越界：1 号按左键停在原地
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
  });

  it('网格使用 roving tabindex：只有活动格可 Tab 到达，聚焦后转移', async () => {
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [
          { id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 },
          { id: 2, name: '李四', employeeNo: 'E002', departmentId: 1 },
        ],
        schedules: [],
      },
    });

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const first = screen.getByRole('button', { name: `张三 ${D1} 未排班` });
    const nextRow = screen.getByRole('button', { name: `李四 ${D1} 未排班` });
    expect(first.tabIndex).toBe(0);
    expect(nextRow.tabIndex).toBe(-1);

    act(() => nextRow.focus());
    await waitFor(() => expect(nextRow.tabIndex).toBe(0));
    expect(first.tabIndex).toBe(-1);
  });

  it('印章模式批量排班把新建与覆盖合并成一次批量请求', async () => {
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [
          { id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 },
          { id: 2, name: '李四', employeeNo: 'E002', departmentId: 1 },
        ],
        // 张三当日已有早班：本次批量属于「覆盖」，李四属于「新建」
        schedules: [{ id: 11, employeeId: 1, shiftId: 1, workDate: D1 }],
      },
    });
    (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          { id: 1, name: '早班', startTime: '08:00', endTime: '16:00', color: '#4ECDC4' },
          { id: 2, name: '晚班', startTime: '16:00', endTime: '24:00', color: '#888888' },
        ],
      },
    });
    (attendanceApi.batchCreateSchedule as jest.Mock).mockResolvedValue({ code: 0, data: { count: 2 } });
    (Modal.confirm as jest.Mock).mockImplementation(({ onOk }: any) => onOk?.());

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('stamp-switch'));
    const selects = await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(selects[selects.length - 1], { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText(new RegExp(`${D1} 对当前筛选`)));

    await waitFor(() => expect(attendanceApi.batchCreateSchedule).toHaveBeenCalledTimes(1));
    expect((attendanceApi.batchCreateSchedule as jest.Mock).mock.calls[0][0].items).toEqual([
      { employeeId: 2, shiftId: 2, workDate: D1 },
      { employeeId: 1, shiftId: 2, workDate: D1 },
    ]);
    // 覆盖不再逐条 update：100 人只有一次往返，且整批原子
    expect(attendanceApi.updateSchedule).not.toHaveBeenCalled();
  });

  it('印章模式清除当日排班只发一次批量删除请求', async () => {
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [
          { id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 },
          { id: 2, name: '李四', employeeNo: 'E002', departmentId: 1 },
        ],
        schedules: [
          { id: 11, employeeId: 1, shiftId: 1, workDate: D1 },
          { id: 12, employeeId: 2, shiftId: 1, workDate: D1 },
        ],
      },
    });
    (attendanceApi.batchDeleteSchedules as jest.Mock).mockResolvedValue({
      code: 0,
      data: { count: 2 },
    });
    (Modal.confirm as jest.Mock).mockImplementation(({ onOk }: any) => onOk?.());

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('stamp-switch'));
    const selects = await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(selects[selects.length - 1], { target: { value: 'clear' } });
    fireEvent.click(screen.getByLabelText(new RegExp(`${D1} 对当前筛选`)));

    await waitFor(() => expect(attendanceApi.batchDeleteSchedules).toHaveBeenCalledTimes(1));
    expect((attendanceApi.batchDeleteSchedules as jest.Mock).mock.calls[0][0]).toEqual([11, 12]);
    // 逐条删除不应再被使用
    expect(attendanceApi.deleteSchedule).not.toHaveBeenCalled();
  });

  it('后台刷新失败时保留已加载的表格与本地乐观排班', async () => {
    (attendanceApi.createSchedule as jest.Mock).mockResolvedValue({
      code: 0,
      data: { id: 99, employeeId: 1, shiftId: 1, workDate: D1 },
    });

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    // 印章模式下点空格 → 本地乐观写入
    fireEvent.click(screen.getByTestId('stamp-switch'));
    const selects = await waitFor(() => screen.getAllByRole('combobox'));
    fireEvent.change(selects[selects.length - 1], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: `张三 ${D1} 未排班` }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `张三 ${D1} 早班` })).toBeInTheDocument(),
    );

    // 800ms 后的后台刷新失败：不能清乐观值，也不能把整张表藏起来
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 500,
      message: '刷新失败',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    expect(screen.getByTestId('calendar-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `张三 ${D1} 早班` })).toBeInTheDocument();
  });

  it('只读用户点击日期格会明确提示没有管理权限', async () => {
    mockCan.mockReturnValue(false);
    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: `张三 ${D1} 未排班` }));

    expect(Message.info).toHaveBeenCalledWith('仅可查看排班，没有考勤管理权限');
  });

  it('导入按钮挂载了文件选择器；覆盖已有排班时先确认，取消则不写入', async () => {
    // 当天已有一条排班，导入同员工同日会走 upsert 覆盖
    (attendanceApi.getScheduleMatrix as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        employees: [{ id: 1, name: '张三', employeeNo: 'E001', departmentId: 1 }],
        schedules: [{ id: 11, employeeId: 1, shiftId: 1, workDate: D1 }],
      },
    });
    (XLSX.read as jest.Mock).mockReturnValue({ SheetNames: ['S'], Sheets: { S: {} } });
    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
      { 工号: 'E001', 日期: D1, 班次: '早班' },
    ]);
    // 用户点「取消」：不执行写入
    (Modal.confirm as jest.Mock).mockImplementation(({ onCancel }: any) => onCancel?.());

    render(<ScheduleCalendarPage />);
    await waitFor(() => expect(screen.getByTestId('calendar-table')).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const file = new File(['x'], 'schedule.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    // jsdom 未实现 Blob.arrayBuffer（浏览器已支持）；文件内容由 xlsx mock 接管，这里只需可解析的桩
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new ArrayBuffer(0)),
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: '确认导入' }),
      ),
    );
    expect(attendanceApi.batchCreateSchedule).not.toHaveBeenCalled();
  });
});
