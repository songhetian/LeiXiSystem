'use client';

import { useRef, useState, useEffect } from 'react';

export interface KeepAliveHostProps {
  /** 当前激活的路由路径 */
  activePath: string;
  /** 当前激活路由对应的子树（React 元素），仅代表当前页 */
  children: React.ReactNode;
  /** 需要保持挂载的路径集合；不在其中的历史路径将被卸载以释放资源 */
  alivePaths?: string[];
}

/**
 * 页签 Keep-Alive：让已打开过的页面保持挂载，切换页签不再重走
 * 挂载 → 发请求 → 渲染 全流程，从而保留组件内部状态并去掉重复请求的卡顿。
 *
 * 实现原理（与 PageTransition 的"重挂载"互补）：
 * - 用 ref 缓存「路径 → 子树」；每次渲染把当前 activePath 的最新子树写入缓存。
 * - 所有缓存子树同时渲染，非当前路径用 hidden 隐藏（display:none），
 *   因此组件实例始终存活，内部 useState 等状态不丢失。
 * - alivePaths 之外的路径（即已关闭的页签）从缓存移除，触发其卸载。
 *
 * 强制刷新（页签「刷新当前页」）：
 * - KeepAlive 复用实例意味着普通 router.refresh() 不会重跑挂载期数据请求；
 * - 监听 `lx-keep-alive-refresh`（detail.path = 目标路径）事件，
 *   按路径递增版本号并写入渲染 key —— key 变化强制 React 卸载旧实例、重建新实例。
 */
export default function KeepAliveHost({
  activePath,
  children,
  alivePaths,
}: KeepAliveHostProps) {
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  const cache = cacheRef.current;
  // 已播放过入场的路径：Keep-Alive 的语义是「切回原地」，每次切回都重播淡入+位移
  // 会让用户以为页面被重新加载（表格/图表尤其明显），因此入场动画只在首次打开时播一次。
  const enteredRef = useRef<Set<string>>(new Set());
  // 路径 → 重挂载版本号；增量写入渲染 key，驱动目标页强制重挂载
  const refreshCountsRef = useRef<Map<string, number>>(new Map());
  const [, setVersion] = useState(0);

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (!path) return;
      refreshCountsRef.current.set(path, (refreshCountsRef.current.get(path) ?? 0) + 1);
      // 同步丢弃缓存中的旧子树，重建时以最新 children 挂载全新实例
      cacheRef.current.delete(path);
      setVersion((v) => v + 1);
    };
    window.addEventListener('lx-keep-alive-refresh', onRefresh);
    return () => window.removeEventListener('lx-keep-alive-refresh', onRefresh);
  }, []);

  // 始终以最新子树覆盖当前活跃路径
  cache.set(activePath, children);

  // 清理已关闭页签对应的缓存子树（触发卸载）
  if (alivePaths) {
    const keep = new Set(alivePaths);
    keep.add(activePath);
    for (const path of Array.from(cache.keys())) {
      if (!keep.has(path)) {
        cache.delete(path);
      }
    }
  }

  return (
    <>
      {Array.from(cache.entries()).map(([path, node]) => (
        <div
          key={`${path}#${refreshCountsRef.current.get(path) ?? 0}`}
          hidden={path !== activePath}
          className={
            path === activePath && !enteredRef.current.has(path)
              ? 'keep-alive-node page-enter'
              : 'keep-alive-node'
          }
          // 只认节点自身的动画结束（子组件的 animationend 会冒泡上来，不能据此判定）
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && path === activePath) {
              enteredRef.current.add(path);
            }
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {node}
        </div>
      ))}
    </>
  );
}