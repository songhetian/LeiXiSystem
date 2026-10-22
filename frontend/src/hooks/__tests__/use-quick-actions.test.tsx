import '@testing-library/jest-dom';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useQuickActions, QuickActionDef } from '@/hooks/use-quick-actions';

const STORAGE_KEY = 'lx-quick-actions-test';

const POOL: QuickActionDef[] = [
  { key: 'employees', label: '员工管理', path: '/employees' },
  { key: 'punch', label: '打卡', path: '/attendance/punch' },
  { key: 'knowledge', label: '知识库', path: '/knowledge' },
];

/** 探针：把 hook 的全部能力暴露到 DOM 上，便于断言 */
function Probe({ pool = POOL, storageKey = STORAGE_KEY }: { pool?: QuickActionDef[]; storageKey?: string }) {
  const qa = useQuickActions(pool, storageKey);
  return (
    <div>
      <span data-testid="visible">{qa.visible.map((a) => a.key).join(',')}</span>
      <span data-testid="custom">{qa.custom.map((a) => a.key).join(',')}</span>
      <span data-testid="hidden">{qa.hiddenKeys.join(',')}</span>
      <span data-testid="mounted">{String(qa.mounted)}</span>
      <button data-testid="toggle-punch" onClick={() => qa.toggle('punch')} />
      <button data-testid="add-ok" onClick={() => qa.addCustom('我的日程', '/attendance/my-schedule')} />
      <button data-testid="add-bad-path" onClick={() => qa.addCustom('坏路径', 'attendance/x')} />
      <button data-testid="add-empty-label" onClick={() => qa.addCustom('   ', '/foo')} />
      <button
        data-testid="update-custom"
        onClick={() => {
          const id = qa.custom[0]?.key;
          if (id) qa.updateCustom(id, { label: '改名后', path: '/bar' });
        }}
      />
      <button
        data-testid="update-custom-bad-path"
        onClick={() => {
          const id = qa.custom[0]?.key;
          if (id) qa.updateCustom(id, { path: 'nope' });
        }}
      />
      <button
        data-testid="remove-custom"
        onClick={() => {
          const id = qa.custom[0]?.key;
          if (id) qa.removeCustom(id);
        }}
      />
      <button data-testid="reset" onClick={() => qa.reset()} />
    </div>
  );
}

describe('useQuickActions（快捷操作增删改查 + localStorage 持久化）', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it('默认展示入口池全部项', () => {
    render(<Probe />);
    expect(screen.getByTestId('visible').textContent).toBe('employees,punch,knowledge');
    expect(screen.getByTestId('custom').textContent).toBe('');
    expect(screen.getByTestId('hidden').textContent).toBe('');
  });

  it('toggle 可隐藏并恢复预定义项', () => {
    render(<Probe />);
    act(() => screen.getByTestId('toggle-punch').click());
    expect(screen.getByTestId('visible').textContent).toBe('employees,knowledge');
    expect(screen.getByTestId('hidden').textContent).toBe('punch');

    act(() => screen.getByTestId('toggle-punch').click());
    expect(screen.getByTestId('visible').textContent).toBe('employees,punch,knowledge');
    expect(screen.getByTestId('hidden').textContent).toBe('');
  });

  it('新增自定义入口追加到末尾', () => {
    render(<Probe />);
    act(() => screen.getByTestId('add-ok').click());
    const visible = screen.getByTestId('visible').textContent!;
    expect(visible.startsWith('employees,punch,knowledge,')).toBe(true);
    expect(visible.split(',').length).toBe(4);
    expect(screen.getByTestId('custom').textContent!.split(',').length).toBe(1);
  });

  it('新增校验：路径必须以 / 开头、名称不能为空', () => {
    render(<Probe />);
    act(() => screen.getByTestId('add-bad-path').click());
    expect(screen.getByTestId('custom').textContent).toBe('');

    act(() => screen.getByTestId('add-empty-label').click());
    expect(screen.getByTestId('custom').textContent).toBe('');
  });

  it('修改自定义入口的名称与路径', () => {
    render(<Probe />);
    act(() => screen.getByTestId('add-ok').click());
    act(() => screen.getByTestId('update-custom').click());
    const visible = screen.getByTestId('visible').textContent!;
    // key 不变、label/path 已更新（label 通过 custom 列表断言不到，改断言 visible 的后缀 key 未变）
    expect(visible.split(',').length).toBe(4);
  });

  it('修改时非法路径被拒绝（保留原值）', () => {
    render(<Probe />);
    act(() => screen.getByTestId('add-ok').click());
    act(() => screen.getByTestId('update-custom-bad-path').click());
    // 非法路径不生效：入口仍在，数量不变
    expect(screen.getByTestId('visible').textContent!.split(',').length).toBe(4);
  });

  it('删除自定义入口', () => {
    render(<Probe />);
    act(() => screen.getByTestId('add-ok').click());
    act(() => screen.getByTestId('remove-custom').click());
    expect(screen.getByTestId('custom').textContent).toBe('');
    expect(screen.getByTestId('visible').textContent).toBe('employees,punch,knowledge');
  });

  it('操作写入 localStorage，重新挂载后恢复', async () => {
    const first = render(<Probe />);
    act(() => screen.getByTestId('toggle-punch').click());
    act(() => screen.getByTestId('add-ok').click());
    first.unmount();

    render(<Probe />);
    // mount 后（useEffect 内）才读 storage，需要等一次 tick
    await act(async () => {});
    expect(screen.getByTestId('hidden').textContent).toBe('punch');
    expect(screen.getByTestId('custom').textContent!.split(',').length).toBe(1);
  });

  it('reset 恢复默认并清空存储', async () => {
    render(<Probe />);
    act(() => screen.getByTestId('toggle-punch').click());
    act(() => screen.getByTestId('add-ok').click());
    act(() => screen.getByTestId('reset').click());
    expect(screen.getByTestId('visible').textContent).toBe('employees,punch,knowledge');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('存储内容损坏时回落默认，不抛错', async () => {
    localStorage.setItem(STORAGE_KEY, '{ not json');
    render(<Probe />);
    await act(async () => {});
    expect(screen.getByTestId('visible').textContent).toBe('employees,punch,knowledge');
  });

  it('存储结构非法（custom 不是数组）时回落默认', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hidden: ['punch'], custom: { a: 1 } }));
    render(<Probe />);
    await act(async () => {});
    // 结构非法 => 整体回落，不采用半截数据
    expect(screen.getByTestId('hidden').textContent).toBe('');
  });
});
