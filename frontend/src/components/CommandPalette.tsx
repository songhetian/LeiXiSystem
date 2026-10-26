'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useFocusTrap from '@/hooks/use-focus-trap';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSearch, IconCommand, IconUser } from '@arco-design/web-react/icon';
import { paletteCommandsFor } from '@/config/navigation';
import { usePaletteStore } from '@/store/palette';
import { useAuthStore } from '@/store/auth';
import { employeeApi, type Employee } from '@/services/employee';

/** 结果条目：页面命令 + 员工实体搜索统一结构 */
interface PaletteEntry {
  id: string;
  label: string;
  /** 次要说明（员工条目的工号·部门） */
  sublabel?: string;
  path: string;
  icon: React.ReactNode;
  group: string;
}

const EMPLOYEE_GROUP = '员工';
// ≥2 字符才触发员工搜索（单字命中率过低，白白打接口）
const MIN_EMPLOYEE_QUERY = 2;
const EMPLOYEE_DEBOUNCE_MS = 250;
const EMPLOYEE_PAGE_SIZE = 5;

export default function CommandPalette() {
  const router = useRouter();
  const open = usePaletteStore((s) => s.open);
  const togglePalette = usePaletteStore((s) => s.toggle);
  const setOpen = usePaletteStore((s) => s.setOpen);
  const permissions = useAuthStore((s) => s.user?.permissions);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // 自绘浮层没有 Arco Modal 那套焦点管理，靠 hook 补齐（打开收焦点 / Tab 循环 / 关闭还焦点）
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const listRef = useRef<HTMLDivElement>(null);
  // 员工搜索竞态防护：只有最新一次请求允许写结果
  const searchSeq = useRef(0);

  // 可见页面命令：由导航真值源派生并按权限过滤
  const commands = useMemo(() => paletteCommandsFor(permissions ?? undefined), [permissions]);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
      }
      if (e.key === 'Escape' && usePaletteStore.getState().open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [togglePalette, setOpen]);

  // 打开时重置查询、选中项与员工结果（焦点交给 useFocusTrap，避免两处各聚焦一次）
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setEmployees([]);
    }
  }, [open]);

  // 卸载时复位开关：登出/路由卸载后 store 不残留 open=true（也隔离测试间状态）
  useEffect(() => () => setOpen(false), [setOpen]);

  // 员工实体搜索：防抖 + RequestID 防竞态；无权限 / 查询过短直接清空
  useEffect(() => {
    const q = query.trim();
    const canSearch = open && q.length >= MIN_EMPLOYEE_QUERY
      && (permissions?.includes('employee:view') ?? false);
    if (!canSearch) {
      setEmployees([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      employeeApi
        .getList({ keyword: q, page: 1, pageSize: EMPLOYEE_PAGE_SIZE })
        .then((res) => {
          if (searchSeq.current === seq) setEmployees(res.data?.list ?? []);
        })
        .catch(() => {
          if (searchSeq.current === seq) setEmployees([]);
        });
    }, EMPLOYEE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open, permissions]);

  // 模糊匹配搜索（label + group + keywords）
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      const text = `${cmd.label} ${cmd.group} ${cmd.keywords || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [commands, query]);

  // 页面命令按分组组织；员工结果追加为独立分组
  const groupedResults = useMemo(() => {
    const groups = new Map<string, PaletteEntry[]>();
    for (const cmd of filteredCommands) {
      if (!groups.has(cmd.group)) groups.set(cmd.group, []);
      groups.get(cmd.group)!.push(cmd);
    }
    const entries = Array.from(groups.entries());
    if (employees.length > 0) {
      entries.push([
        EMPLOYEE_GROUP,
        employees.map((emp) => ({
          id: `employee-${emp.id}`,
          label: emp.name,
          sublabel: [emp.employeeNo, emp.departmentName].filter(Boolean).join(' · '),
          path: `/employees/${emp.id}`,
          icon: <IconUser />,
          group: EMPLOYEE_GROUP,
        })),
      ]);
    }
    return entries;
  }, [filteredCommands, employees]);

  // 扁平化用于键盘导航
  const flatList = useMemo(() => groupedResults.flatMap(([, items]) => items), [groupedResults]);

  // 选中项变化时滚动到可视区域（jsdom 未实现 scrollIntoView，可选调用兜底）
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback((entry: PaletteEntry) => {
    router.push(entry.path);
    setOpen(false);
  }, [router, setOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatList[selectedIndex]) {
        handleSelect(flatList[selectedIndex]);
      }
    }
  };

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="cmdk-overlay"
          onClick={() => setOpen(false)}
        >
          {/* 遮罩层 */}
          <div className="cmdk-mask" />

          {/* 面板主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="命令面板"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="cmdk-panel"
          >
            {/* 搜索输入区 */}
            <div className="cmdk-search">
              <IconSearch style={{ fontSize: 20, color: 'var(--lx-text-4)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="搜索页面、员工..."
                className="cmdk-input"
              />
              <kbd className="cmdk-kbd">ESC</kbd>
            </div>

            {/* 结果列表 */}
            <div ref={listRef} role="listbox" aria-label="命令结果" className="cmdk-list">
              {flatList.length === 0 ? (
                <div className="cmdk-empty">未找到匹配结果</div>
              ) : (
                groupedResults.map(([group, items]) => (
                  <div key={group} className="cmdk-group">
                    <div className="cmdk-group-title">{group}</div>
                    {items.map((entry) => {
                      runningIndex++;
                      const idx = runningIndex;
                      const isSelected = idx === selectedIndex;
                      return (
                        <div
                          key={entry.id}
                          role="option"
                          aria-selected={isSelected}
                          data-idx={idx}
                          onClick={() => handleSelect(entry)}
                          className={`cmdk-item ${isSelected ? 'is-selected' : ''}`}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <span className="cmdk-item-icon">{entry.icon}</span>
                          <span className="cmdk-item-label">{entry.label}</span>
                          {entry.sublabel && (
                            <span className="cmdk-item-sublabel">{entry.sublabel}</span>
                          )}
                          {isSelected && <kbd className="cmdk-item-enter">↵</kbd>}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* 底部提示栏 */}
            <div className="cmdk-footer">
              <div className="cmdk-hints">
                <span>
                  <kbd className="cmdk-hint-kbd">↑↓</kbd> 导航
                </span>
                <span>
                  <kbd className="cmdk-hint-kbd">↵</kbd> 选择
                </span>
                <span>
                  <kbd className="cmdk-hint-kbd">ESC</kbd> 关闭
                </span>
              </div>
              <div className="cmdk-shortcut">
                <IconCommand style={{ fontSize: 12 }} />
                <span>K</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
