'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * 节流：在 `wait` 毫秒窗口内最多执行一次 `fn`。
 * - leading：窗口开始的首次调用立即执行（默认 true）
 * - trailing：窗口结束时若仍有待处理调用，用最新参数补执行一次（默认 true，避免滚动停在两帧之间丢失最后一次状态）
 *
 * 适用于高频事件（scroll / resize / mousemove）中较轻的 setState 或计算。
 * 返回稳定的回调引用，可安全用于 useEffect / addEventListener，不随 fn 变化重绑。
 */
export function useThrottle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait = 100,
  leading = true,
): (...args: Args) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const lastCall = useRef(0);
  const trailingArgs = useRef<Args | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invoke = useCallback((args: Args) => {
    lastCall.current = Date.now();
    fnRef.current(...args);
  }, []);

  // 卸载时清理未执行的 trailing 定时器
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      const remaining = wait - (now - lastCall.current);

      if (remaining <= 0) {
        // 窗口已过：立即执行（leading），并丢弃可能存在的 trailing 定时器
        if (timeout.current) {
          clearTimeout(timeout.current);
          timeout.current = null;
          trailingArgs.current = null;
        }
        invoke(args);
        return;
      }

      // 窗口内：记下最新参数，仅当尚未排定时器时安排一次 trailing
      trailingArgs.current = args;
      if (!timeout.current) {
        timeout.current = setTimeout(() => {
          timeout.current = null;
          const pending = trailingArgs.current;
          trailingArgs.current = null;
          if (pending) invoke(pending);
        }, remaining);
      }
    },
    [wait, leading, invoke],
  );
}