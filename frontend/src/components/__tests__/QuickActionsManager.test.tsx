import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import QuickActionsManager, { QuickRouteOption } from '@/components/QuickActionsManager';
import { useQuickActions, QuickActionDef } from '@/hooks/use-quick-actions';

const POOL: QuickActionDef[] = [
  { key: 'employees', label: '员工管理', path: '/employees' },
  { key: 'punch', label: '打卡', path: '/attendance/punch' },
];

/** 模拟导航树派生的可选页面（已按权限过滤） */
const ROUTES: QuickRouteOption[] = [
  { path: '/attendance/my-schedule', label: '我的排班' },
  { path: '/knowledge/admin', label: '知识库管理' },
  { path: '/employees', label: '员工列表' },
];

/** 用真实 hook 驱动，验证「组件 + hook」整链路而不是假 api */
function Harness({ routes = ROUTES }: { routes?: QuickRouteOption[] }) {
  const api = useQuickActions(POOL, 'lx-qa-manager-test');
  const [visible, setVisible] = useState(true);
  return (
    <>
      <span data-testid="visible-keys">{api.visible.map((a) => a.key).join(',')}</span>
      <span data-testid="custom-paths">{api.custom.map((c) => c.path).join(',')}</span>
      <QuickActionsManager visible={visible} onClose={() => setVisible(false)} api={api} routes={routes} />
    </>
  );
}

/** 打开新增行的 Arco Select 下拉（下拉内容挂在 body 上） */
function openAddDropdown() {
  const trigger = document.querySelector('.lx-qa-add-row .arco-select') as HTMLElement;
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
}

/** 下拉里当前渲染出的选项文案 */
function optionTexts(): string[] {
  return Array.from(document.querySelectorAll('.arco-select-option')).map((el) => el.textContent ?? '');
}

describe('QuickActionsManager（快捷操作管理面板）', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('取消勾选后入口从可见列表移除', () => {
    render(<Harness />);
    const row = screen.getByTestId('qa-pool-punch');
    fireEvent.click(row.querySelector('input[type="checkbox"]')!);
    expect(screen.getByTestId('visible-keys').textContent).toBe('employees');
  });

  it('自定义入口只能从页面下拉中选择，选中后自动带出名称', () => {
    render(<Harness />);
    openAddDropdown();
    expect(optionTexts()).toContain('我的排班');
    fireEvent.click(screen.getByText('我的排班'));

    // 名称由页面标题自动带出，无需手输
    expect((screen.getByLabelText('新入口名称') as HTMLInputElement).value).toBe('我的排班');
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));

    const keys = screen.getByTestId('visible-keys').textContent!.split(',');
    expect(keys.length).toBe(3);
    expect(keys[2].startsWith('custom-')).toBe(true);
    expect(screen.getByTestId('custom-paths').textContent).toBe('/attendance/my-schedule');
    expect(screen.getByText('我的排班')).toBeInTheDocument();
  });

  it('已被入口池或自定义项占用的页面不再出现在下拉中', () => {
    render(<Harness />);
    openAddDropdown();
    // /employees 已在入口池里，/attendance/punch 不在 ROUTES
    expect(optionTexts()).not.toContain('员工列表');
    expect(optionTexts()).toContain('知识库管理');

    fireEvent.click(screen.getByText('我的排班'));
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    openAddDropdown();
    expect(optionTexts()).not.toContain('我的排班');
    expect(optionTexts()).toContain('知识库管理');
  });

  it('未选择页面时点击添加不会新增入口', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('新入口名称'), { target: { value: '临时' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(screen.getByTestId('visible-keys').textContent).toBe('employees,punch');
  });

  it('编辑自定义入口可切换页面并保存', () => {
    render(<Harness />);
    openAddDropdown();
    fireEvent.click(screen.getByText('我的排班'));
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));

    fireEvent.click(screen.getByLabelText('编辑我的排班'));
    const editTrigger = document.querySelector('.lx-qa-custom-row.is-editing .arco-select') as HTMLElement;
    fireEvent.mouseDown(editTrigger);
    fireEvent.click(editTrigger);
    // 新增行与编辑行各有一份选项，取后渲染的那份（编辑行的下拉）
    const options = screen.getAllByText('知识库管理');
    fireEvent.click(options[options.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(screen.getByTestId('custom-paths').textContent).toBe('/knowledge/admin');
  });

  it('删除自定义入口后从列表移除', () => {
    render(<Harness />);
    openAddDropdown();
    fireEvent.click(screen.getByText('我的排班'));
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    fireEvent.click(screen.getByLabelText('删除我的排班'));
    expect(screen.getByTestId('visible-keys').textContent).toBe('employees,punch');
  });

  it('没有任何可选页面时下拉给出空态提示', () => {
    render(<Harness routes={[]} />);
    openAddDropdown();
    expect(screen.getByText('暂无可添加的页面')).toBeInTheDocument();
  });
});
