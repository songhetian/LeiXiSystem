import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommandPalette from '@/components/CommandPalette';
import { usePaletteStore } from '@/store/palette';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

/** 浮层外放一个可聚焦按钮，用来验证「关闭后焦点还回去」 */
function renderWithOutsideTrigger() {
  return render(
    <>
      <button>外部触发按钮</button>
      <CommandPalette />
    </>,
  );
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog', { name: '命令面板' });
}

describe('CommandPalette - 手写浮层的焦点管理', () => {
  beforeEach(() => {
    mockPush.mockClear();
    // store 是模块级单例：用例间复位开关，避免上一个用例的 open 状态泄漏
    usePaletteStore.setState({ open: false });
  });

  it('用 Ctrl+K 打开后暴露 dialog 语义（role=dialog + aria-modal）', async () => {
    const user = userEvent.setup();
    renderWithOutsideTrigger();

    const dialog = await openPalette(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('打开后焦点自动进入浮层内的搜索框', async () => {
    const user = userEvent.setup();
    renderWithOutsideTrigger();

    await openPalette(user);

    expect(screen.getByPlaceholderText('搜索页面、员工...')).toHaveFocus();
  });

  it('搜索框是唯一可聚焦元素时，按 Tab 不逃出浮层（焦点仍留在浮层内）', async () => {
    const user = userEvent.setup();
    renderWithOutsideTrigger();

    const dialog = await openPalette(user);
    const input = screen.getByPlaceholderText('搜索页面、员工...');

    await user.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(input).toHaveFocus();
  });

  it('按 Esc 关闭后，焦点回到打开浮层前的元素', async () => {
    const user = userEvent.setup();
    renderWithOutsideTrigger();

    const trigger = screen.getByText('外部触发按钮');
    await user.click(trigger);
    expect(trigger).toHaveFocus();

    await openPalette(user);
    expect(screen.getByPlaceholderText('搜索页面、员工...')).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '命令面板' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
