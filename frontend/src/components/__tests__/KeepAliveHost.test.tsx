import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import KeepAliveHost from '@/components/KeepAliveHost';

/** 有内部状态的计数器，用于验证页签切换时组件实例未被卸载/重建 */
function Counter() {
  const [n, setN] = useState(0);
  return (
    <button data-testid="counter" onClick={() => setN(n + 1)}>
      {n}
    </button>
  );
}

describe('KeepAliveHost', () => {
  it('切换活跃路径时，旧子页保持挂载（缓存），仅新页可见', () => {
    const { rerender } = render(
      <KeepAliveHost activePath="/a" alivePaths={['/a', '/b']}>
        <div data-testid="p-a">Page A</div>
      </KeepAliveHost>,
    );

    // 初始活跃页可见
    expect(screen.getByTestId('p-a').parentElement).not.toHaveAttribute('hidden');

    rerender(
      <KeepAliveHost activePath="/b" alivePaths={['/a', '/b']}>
        <div data-testid="p-b">Page B</div>
      </KeepAliveHost>,
    );

    // 切到 /b 后，/a 仍在文档中（保持挂载），但被隐藏；/b 可见
    expect(screen.getByTestId('p-a')).toBeInTheDocument();
    expect(screen.getByTestId('p-a').parentElement).toHaveAttribute('hidden');
    expect(screen.getByTestId('p-b')).toBeInTheDocument();
    expect(screen.getByTestId('p-b').parentElement).not.toHaveAttribute('hidden');
  });

  it('在缓存页之间切换，组件实例状态得以保留', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <KeepAliveHost activePath="/a" alivePaths={['/a', '/b']}>
        <Counter />
      </KeepAliveHost>,
    );

    // 将计数器累加到 1
    await user.click(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter')).toHaveTextContent('1');

    // 切到 /b
    rerender(
      <KeepAliveHost activePath="/b" alivePaths={['/a', '/b']}>
        <div data-testid="p-b">Page B</div>
      </KeepAliveHost>,
    );

    // 切回 /a，传入全新的同类型子树，但实例应保留（仍为 1，而非重置为 0）
    rerender(
      <KeepAliveHost activePath="/a" alivePaths={['/a', '/b']}>
        <Counter />
      </KeepAliveHost>,
    );
    expect(screen.getByTestId('counter')).toHaveTextContent('1');
  });

  it('从 alivePaths 移除（关闭页签）后，对应缓存子树被卸载', () => {
    const { rerender } = render(
      <KeepAliveHost activePath="/a" alivePaths={['/a', '/b']}>
        <div data-testid="p-a">Page A</div>
      </KeepAliveHost>,
    );

    rerender(
      <KeepAliveHost activePath="/b" alivePaths={['/a', '/b']}>
        <div data-testid="p-b">Page B</div>
      </KeepAliveHost>,
    );
    expect(screen.getByTestId('p-a')).toBeInTheDocument();

    // 关闭 /a 页签（从 alivePaths 移除）
    rerender(
      <KeepAliveHost activePath="/b" alivePaths={['/b']}>
        <div data-testid="p-b">Page B</div>
      </KeepAliveHost>,
    );
    expect(screen.queryByTestId('p-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('p-b')).toBeInTheDocument();
  });
});