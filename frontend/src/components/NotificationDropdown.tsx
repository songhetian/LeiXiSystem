'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Badge, List, Button, Empty, Tag } from '@arco-design/web-react';
import { IconNotification } from '@arco-design/web-react/icon';
import { useRouter } from 'next/navigation';
import { useThrottle } from '@/hooks/use-throttle';
import { notificationApi, Notification } from '@/services/notification';
import { notificationTypeMeta } from '@/lib/notification-meta';
import LoaderDots from '@/components/LoaderDots';
import { useCachedData } from '@/hooks/use-cached-data';

export function NotificationDropdown() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // 未读通知列表统一走共享缓存：打开面板立即出数据，失败不会被伪装成「暂无新通知」
  const {
    data: listRes,
    loading,
    error,
    revalidate: revalidateList,
  } = useCachedData<Awaited<ReturnType<typeof notificationApi.list>>>(
    'notifications:dropdown:unread',
    async () => {
      const res = await notificationApi.list({ page: 1, pageSize: 5, read: false });
      if (res.code !== 0) throw new Error(res.message || '通知加载失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const list = listRes?.data?.list ?? [];

  const updatePanelPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        width: 360,
        maxHeight: 420,
        background: 'var(--lx-bg-card)',
        borderRadius: 8,
        boxShadow: 'var(--lx-shadow-dropdown)',
        border: '1px solid var(--lx-border-2)',
        zIndex: 'var(--lx-z-popover)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      });
    }
  }, []);

  // 节流版：scroll/resize 时抑制高频 setPanelStyle
  const throttledUpdatePanelPosition = useThrottle(updatePanelPosition, 100);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount();
      if (res.code === 0 && res.data) {
        setUnread(res.data.count);
      }
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    // socket 推送到达时：未读数与面板列表一起刷新（列表由共享缓存去重）
    const handler = () => {
      fetchUnread();
      void revalidateList();
    };
    window.addEventListener('socket-notification', handler);
    // 轮询兜底：线上若反向代理没转发 WebSocket upgrade，socket 会一直连不上，
    // 此时没有这条兜底角标就永远停在旧数字（用户会以为"通知没实现"）。
    // 页面不可见时不打接口，回来后立即补一次。
    const timer = window.setInterval(() => {
      if (!document.hidden) void fetchUnread();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('socket-notification', handler);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchUnread, revalidateList]);

  useEffect(() => {
    if (open) {
      updatePanelPosition();
    }
  }, [open, updatePanelPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const panel = document.getElementById('notification-panel-root');
        if (panel && !panel.contains(e.target as Node)) {
          setOpen(false);
        }
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', throttledUpdatePanelPosition);
      window.addEventListener('scroll', throttledUpdatePanelPosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', throttledUpdatePanelPosition);
      window.removeEventListener('scroll', throttledUpdatePanelPosition, true);
    };
  }, [open, throttledUpdatePanelPosition]);

  // Escape 关闭浮层并把焦点归还触发器；打开时把焦点移入面板。
  // 此前只实现了「点击外部关闭」，键盘用户打开后无法用 Escape 关闭（WCAG SC 2.1.1 / 2.4.3）。
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleItemClick = async (item: Notification) => {
    if (!item.read) {
      try {
        await notificationApi.markRead(item.id);
        setUnread((prev) => Math.max(0, prev - 1));
        // 已读状态变化后让共享缓存重新拉取，避免本地副本与列表页不一致
        void revalidateList();
      } catch {
        // 忽略
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setUnread(0);
      void revalidateList();
    } catch {
      // 忽略
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push('/notifications');
  };

  // 类型颜色/文案统一走 lib/notification-meta.ts（与通知中心列表页同源）

  return (
    <div ref={triggerRef} style={{ position: 'relative' }}>
      <button
        data-testid="notification-trigger"
        type="button"
        className="lx-action-hover"
        style={styles.trigger}
        onClick={handleToggle}
        aria-label="通知"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="notification-panel-root"
      >
        <Badge count={unread} offset={[-2, 2]}>
          <IconNotification style={{ fontSize: 18, color: 'var(--lx-text-2)' }} />
        </Badge>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          id="notification-panel-root"
          data-testid="notification-panel"
          ref={panelRef}
          role="region"
          aria-label="通知消息"
          tabIndex={-1}
          style={panelStyle}
        >
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>通知消息</span>
            <Button type="text" size="mini" onClick={handleMarkAllRead}>
              全部已读
            </Button>
          </div>
          <div style={styles.panelBody}>
            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 border-b border-danger bg-danger-light px-3 py-2 text-xs text-danger"
              >
                <span>{error}</span>
                <Button type="text" size="mini" onClick={() => void revalidateList()}>
                  重试
                </Button>
              </div>
            )}
            {loading ? (
        <LoaderDots />
      ) : (
        <>
              {list.length === 0 && !loading && !error ? (
                <Empty description="暂无新通知" style={{ padding: '24px 0' }} />
              ) : (
                <List
                  size="small"
                  dataSource={list}
                  render={(item) => (
                    <List.Item
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${notificationTypeMeta(item.type).label}：${item.title}`}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: '10px 12px',
                        opacity: item.read ? 0.6 : 1,
                      }}
                      onClick={() => handleItemClick(item)}
                    >
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tag color={notificationTypeMeta(item.type).color} size="small">
                              {notificationTypeMeta(item.type).label}
                            </Tag>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</span>
                          </div>
                        }
                        description={
                          <div className="text-xs text-text-3 mt-1">
                            {item.content}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </>
      )}
          </div>
          <div style={styles.panelFooter}>
            <Button type="text" size="small" long onClick={handleViewAll}>
              查看全部
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 8,
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    borderRadius: 8,
    color: 'var(--lx-text-2)',
  } as React.CSSProperties,
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 360,
    maxHeight: 420,
    background: 'var(--lx-bg-card)',
    borderRadius: 8,
    boxShadow: 'var(--lx-shadow-dropdown)',
    border: '1px solid var(--lx-border-2)',
    zIndex: 'var(--lx-z-popover)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid var(--lx-border-2)',
  } as React.CSSProperties,
  panelTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--lx-text-1)',
  } as React.CSSProperties,
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 320,
  } as React.CSSProperties,
  panelFooter: {
    borderTop: '1px solid var(--lx-border-2)',
    padding: '8px 12px',
  } as React.CSSProperties,
};
