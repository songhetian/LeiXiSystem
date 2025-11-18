import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { getSocket } from '../utils/socket';
import './NotificationBadge.css';

const NotificationBadge = ({ onNavigate }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const hasAuth = !!localStorage.getItem('token') && !!localStorage.getItem('user');


  useEffect(() => {
    if (!hasAuth) {
      setUnreadCount(0);
      return;
    }
    loadUnreadCount();

    const handleNew = (payload) => {
      try {
        const me = JSON.parse(localStorage.getItem('user') || '{}');
        if (!me?.id) return;
        if (payload?.recipient_id === me.id) {
          setUnreadCount((c) => c + 1);
        }
      } catch {}
    };

    const handleUpdate = (payload) => {
      if (!payload) return;
      if (payload.action === 'read-all') {
        setUnreadCount(0);
      } else if (payload.is_read === true) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    };

    let attached = false;
    const tryAttach = () => {
      if (attached) return;
      const s = getSocket();
      if (s && s.on) {
        s.on('notification:new', handleNew);
        s.on('notification:update', handleUpdate);
        attached = true;
      }
    };
    tryAttach();
    const timer = setInterval(tryAttach, 500);

    return () => {
      clearInterval(timer);
      const s = getSocket();
      if (s && s.off) {
        s.off('notification:new', handleNew);
        s.off('notification:update', handleUpdate);
      }
    };
  }, [hasAuth]);

  const loadUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await axios.get(getApiUrl('/api/notifications/unread-count'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const count = response.data?.data?.count ?? 0;
      setUnreadCount(Number(count) || 0);
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  };

  const handleClick = () => {
    if (onNavigate) {
      onNavigate('notification-center');
    }
  };

  if (!hasAuth || unreadCount === 0) {
    return null;
  }

  return (
    <div className="notification-badge-wrapper" onClick={handleClick}>
      <div className="notification-badge">
        {unreadCount > 99 ? '99+' : unreadCount}
      </div>
    </div>
  );
};

export default NotificationBadge;
