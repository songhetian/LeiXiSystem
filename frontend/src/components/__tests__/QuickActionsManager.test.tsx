import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import QuickActionsManager from '@/components/QuickActionsManager';
import { useQuickActions, QuickActionDef } from '@/hooks/use-quick-actions';

const POOL: QuickActionDef[] = [
  { key: 'employees', label: '员工管理', path: '/employees' },
  { key: 'punch', label: '打卡', path: '/attendance/punch' },
];

/** 用真实 hook 驱动，验证「组件 + hook」整链路而不是假 api */
function Harness() {
  const api = useQuickActions(POOL, 'lx-qa-manager-test');
  const [visible, setVisible] = useState(true);
  return (
    <>
      <span data-testid="visible-keys">{api.visible.map((a) => a.key).join(',')}</span>
      <button data-testid="open" onClick={() => setVisible(true)} />
      <QuickActionsManager visible={visible} onClose={() => setVisible(false)} api={api} />
    </>
  );
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

  it('填写名称与路径后添加成功，自定义项进入可见列表', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('新入口名称'), { target: { value: '我的排班' } });
    fireEvent.change(screen.getByLabelText('新入口路径'), {
      target: { value: '/attendance/my-schedule' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    const keys = screen.getByTestId('visible-keys').textContent!.split(',');
    expect(keys.length).toBe(3);
    expect(keys[2].startsWith('custom-')).toBe(true);
    // 名称已回显在自定义列表中
    expect(screen.getByText('我的排班')).toBeInTheDocument();
  });

  it('路径非法时不添加', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('新入口名称'), { target: { value: '坏路径' } });
    fireEvent.change(screen.getByLabelText('新入口路径'), { target: { value: 'no-slash' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(screen.getByTestId('visible-keys').textContent).toBe('employees,punch');
  });

  it('删除自定义入口后从列表移除', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('新入口名称'), { target: { value: '临时' } });
    fireEvent.change(screen.getByLabelText('新入口路径'), { target: { value: '/tmp' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    fireEvent.click(screen.getByLabelText('删除临时'));
    expect(screen.getByTestId('visible-keys').textContent).toBe('employees,punch');
  });
});
