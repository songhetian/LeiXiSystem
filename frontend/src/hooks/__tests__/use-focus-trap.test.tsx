import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import useFocusTrap from '@/hooks/use-focus-trap';

/**
 * 手写浮层（CommandPalette 这类不用 Arco Modal 的自绘弹层）此前没有焦点陷阱：
 * 打开后按 Tab 会跑到浮层背后的页面上，键盘用户直接"走丢"；关闭后焦点也不回到触发按钮。
 * 本用例锁定三件事：打开收焦点、Tab 在容器内循环、关闭还焦点。
 */
function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const ref = useFocusTrap<HTMLDivElement>(open);

  return (
    <div>
      <button onClick={() => setOpen(true)}>打开面板</button>
      <button onClick={() => setOpen(false)}>外部按钮</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="测试浮层">
          <button>第一个</button>
          <input aria-label="中间输入框" />
          <button>最后一个</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('容器挂载（active=true）时，焦点自动落到容器内第一个可聚焦元素', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('打开面板'));

    expect(screen.getByText('第一个')).toHaveFocus();
  });

  it('在最后一个可聚焦元素上按 Tab，焦点循环回第一个（不逃出容器）', async () => {
    const user = userEvent.setup();
    render(<Harness initialOpen />);

    const first = screen.getByText('第一个');
    const last = screen.getByText('最后一个');
    last.focus();

    await user.tab();

    expect(first).toHaveFocus();
  });

  it('在第一个可聚焦元素上按 Shift+Tab，焦点循环到最后一个', async () => {
    const user = userEvent.setup();
    render(<Harness initialOpen />);

    const first = screen.getByText('第一个');
    const last = screen.getByText('最后一个');
    first.focus();

    await user.tab({ shift: true });

    expect(last).toHaveFocus();
  });

  it('容器内 Tab 顺序仍按 DOM 顺序前进（不破坏正常遍历）', async () => {
    const user = userEvent.setup();
    render(<Harness initialOpen />);

    const first = screen.getByText('第一个');
    const input = screen.getByLabelText('中间输入框');
    first.focus();

    await user.tab();

    expect(input).toHaveFocus();
  });

  it('关闭（active=false）后，焦点还原到打开浮层前的那个元素', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByText('打开面板');
    await user.click(trigger);
    expect(screen.getByText('第一个')).toHaveFocus();

    await user.click(screen.getByText('外部按钮'));

    expect(trigger).toHaveFocus();
  });
});
