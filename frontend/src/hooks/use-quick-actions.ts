'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 快捷入口定义（预定义池与用户自定义共用结构） */
export interface QuickActionDef {
  key: string;
  label: string;
  path: string;
  /** 自定义项标记（true 才允许修改/删除） */
  custom?: boolean;
}

export interface QuickActionsPersisted {
  hiddenKeys: string[];
  custom: QuickActionDef[];
}

export interface QuickActionsApi {
  /** 首帧（SSR/hydration）不读 localStorage，避免服务端与客户端渲染不一致 */
  mounted: boolean;
  /** 渲染用列表：入口池未被隐藏的项 + 自定义项（保持池内顺序，自定义追加在末尾） */
  visible: QuickActionDef[];
  /** 入口池原样（管理面板用） */
  pool: QuickActionDef[];
  hiddenKeys: string[];
  custom: QuickActionDef[];
  /** 预定义项显示/隐藏 */
  toggle: (key: string) => void;
  /** 新增自定义入口：名称必填、路径必须以 / 开头；返回错误文案（null 表示成功） */
  addCustom: (label: string, path: string) => string | null;
  updateCustom: (key: string, patch: { label?: string; path?: string }) => string | null;
  removeCustom: (key: string) => void;
  /** 恢复默认（清空存储） */
  reset: () => void;
}

const DEFAULT_STORAGE_KEY = 'lx-quick-actions-v1';

/** 存储结构校验：任何一项不合法都整体回落默认，避免半截脏数据把首页渲染成空白 */
function parseStored(raw: string | null): QuickActionsPersisted | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { hiddenKeys, custom } = data as Record<string, unknown>;
  if (!Array.isArray(hiddenKeys) || !Array.isArray(custom)) return null;
  if (!hiddenKeys.every((k) => typeof k === 'string')) return null;
  const customOk = custom.every(
    (c): c is QuickActionDef =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as QuickActionDef).key === 'string' &&
      typeof (c as QuickActionDef).label === 'string' &&
      typeof (c as QuickActionDef).path === 'string',
  );
  if (!customOk) return null;
  return { hiddenKeys: hiddenKeys as string[], custom: custom as QuickActionDef[] };
}

function validate(label: string, path: string): string | null {
  if (!label || !label.trim()) return '请输入名称';
  if (label.trim().length > 12) return '名称不超过 12 个字';
  if (!path || !path.trim()) return '请选择页面';
  if (!path.trim().startsWith('/')) return '路径必须以 / 开头';
  return null;
}

/**
 * 首页快捷操作管理：入口池（预定义）+ 用户自定义项的增删改查，
 * 持久化到 localStorage（纯个人偏好，不进服务端）。
 */
export function useQuickActions(
  pool: QuickActionDef[],
  storageKey: string = DEFAULT_STORAGE_KEY,
): QuickActionsApi {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<QuickActionsPersisted>({ hiddenKeys: [], custom: [] });
  // 用 ref 保存最新 state，供持久化 effect 在 SSR 首帧跳过写入（避免把默认值覆盖用户已存数据）
  const stateRef = useRef(state);

  // 挂载后才读存储：SSR 首帧与客户端首帧渲染一致，读盘放在 effect 里
  useEffect(() => {
    setMounted(true);
    const stored = parseStored(window.localStorage.getItem(storageKey));
    if (stored) {
      stateRef.current = stored;
      setState(stored);
    }
  }, [storageKey]);

  // 挂载完成后，任何变更都回写存储（reset 时删除键）
  useEffect(() => {
    if (!mounted) return;
    stateRef.current = state;
    if (state.hiddenKeys.length === 0 && state.custom.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // 隐私模式/配额超限：静默降级，仅本次会话生效
    }
  }, [state, mounted, storageKey]);

  const visible = useMemo(() => {
    const hidden = new Set(state.hiddenKeys);
    return [...pool.filter((a) => !hidden.has(a.key)), ...state.custom];
  }, [pool, state]);

  const toggle = useCallback((key: string) => {
    setState((prev) => {
      const hidden = new Set(prev.hiddenKeys);
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
      return { ...prev, hiddenKeys: Array.from(hidden) };
    });
  }, []);

  const addCustom = useCallback(
    (label: string, path: string): string | null => {
      const err = validate(label, path);
      if (err) return err;
      setState((prev) => {
        // key 前缀固定，便于识别"自定义项"；时间戳保证唯一
        const key = `custom-${Date.now()}-${prev.custom.length}`;
        return {
          ...prev,
          custom: [...prev.custom, { key, label: label.trim(), path: path.trim(), custom: true }],
        };
      });
      return null;
    },
    [],
  );

  const updateCustom = useCallback(
    (key: string, patch: { label?: string; path?: string }): string | null => {
      const target = stateRef.current.custom.find((c) => c.key === key);
      if (!target) return '入口不存在';
      const nextLabel = patch.label ?? target.label;
      const nextPath = patch.path ?? target.path;
      const err = validate(nextLabel, nextPath);
      if (err) return err;
      setState((prev) => ({
        ...prev,
        custom: prev.custom.map((c) =>
          c.key === key ? { ...c, label: nextLabel.trim(), path: nextPath.trim() } : c,
        ),
      }));
      return null;
    },
    [],
  );

  const removeCustom = useCallback((key: string) => {
    setState((prev) => ({ ...prev, custom: prev.custom.filter((c) => c.key !== key) }));
  }, []);

  const reset = useCallback(() => {
    setState({ hiddenKeys: [], custom: [] });
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // 忽略
    }
  }, [storageKey]);

  return { mounted, visible, pool, hiddenKeys: state.hiddenKeys, custom: state.custom, toggle, addCustom, updateCustom, removeCustom, reset };
}
