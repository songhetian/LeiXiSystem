'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Badge, List, Button, Empty, Spin, Tag } from '@arco-design/web-react';
import { IconNotification } from '@arco-design/web-react/icon';
import { useRouter } from 'next/navigation';
import { useThrottle } from '@/hooks/use-throttle';
import { notificationApi, Notification } from '@/services/notification';

export function NotificationDropdown() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePanelPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        width: 360,
        maxHeight: 420,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        border: '1px solid #f2f3f5',
        zIndex: 9999,
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

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ page: 1, pageSize: 5, read: false });
      if (res.code === 0 && res.data) {
        setList(res.data.list);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const handler = () => fetchUnread();
    window.addEventListener('socket-notification', handler);
    return () => window.removeEventListener('socket-notification', handler);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) {
      updatePanelPosition();
      fetchList();
    }
  }, [open, fetchList, updatePanelPosition]);

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

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleItemClick = async (item: Notification) => {
    if (!item.read) {
      try {
        await notificationApi.markRead(item.id);
        setUnread((prev) => Math.max(0, prev - 1));
        setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      } catch {
        // 忽略
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setUnread(0);
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // 忽略
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push('/notifications');
  };

  const typeMap: Record<string, { color: string; label: string }> = {
    approval: { color: 'blue', label: '审批' },
    payslip: { color: 'green', label: '薪资' },
    system: { color: 'orange', label: '系统' },
    attendance: { color: 'purple', label: '考勤' },
  };

  return (
    <div ref={triggerRef} style={{ position: 'relative' }}>
      <button
        data-testid="notification-trigger"
        type="button"
        className="lx-action-hover"
        style={styles.trigger}
        onClick={handleToggle}
        aria-label="通知"
      >
        <Badge count={unread} offset={[-2, 2]}>
          <IconNotification style={{ fontSize: 18, color: '#4e5969' }} />
        </Badge>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div id="notification-panel-root" data-testid="notification-panel" style={panelStyle}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>通知消息</span>
            <Button type="text" size="mini" onClick={handleMarkAllRead}>
              全部已读
            </Button>
          </div>
          <div style={styles.panelBody}>
            <Spin loading={loading} style={{ display: 'block' }}>
              {list.length === 0 && !loading ? (
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
                      aria-label={`${typeMap[item.type]?.label || item.type}：${item.title}`}
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
                            <Tag color={typeMap[item.type]?.color || 'gray'} size="small">
                              {typeMap[item.type]?.label || item.type}
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
            </Spin>
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
    color: '#4e5969',
  } as React.CSSProperties,
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 360,
    maxHeight: 420,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    border: '1px solid #f2f3f5',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid #f2f3f5',
  } as React.CSSProperties,
  panelTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#1d2129',
  } as React.CSSProperties,
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    maxHeight: 320,
  } as React.CSSProperties,
  panelFooter: {
    borderTop: '1px solid #f2f3f5',
    padding: '8px 12px',
  } as React.CSSProperties,
};
