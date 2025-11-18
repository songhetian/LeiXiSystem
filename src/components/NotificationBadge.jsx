import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import './NotificationBadge.css';

const NotificationBadge = ({ onNavigate }) => {
  const [unreadCount, setUnreadCount] = useState(0);


  useEffect(() => {
    loadUnreadCount();
    // 每30秒刷新一次
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(getApiUrl('/api/notifications/unread'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  };

  const handleClick = () => {
    if (onNavigate) {
      onNavigate('notification-center');
    }
  };

  if (unreadCount === 0) {
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
