'use client';

import { useRef } from 'react';

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
 */
export default function KeepAliveHost({
  activePath,
  children,
  alivePaths,
}: KeepAliveHostProps) {
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  const cache = cacheRef.current;

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
          key={path}
          hidden={path !== activePath}
          className={path === activePath ? 'keep-alive-node page-enter' : 'keep-alive-node'}
          style={{ width: '100%', height: '100%' }}
        >
          {node}
        </div>
      ))}
    </>
  );
}