import { toast } from 'react-toastify';
import React from 'react';

/**
 * Displays a notification toast with various content types and priority styles.
 * @param {object} notification - The notification object.
 * @param {string} notification.title - The title of the notification.
 * @param {string} notification.content - The main content of the notification.
 * @param {string} [notification.content_type='text'] - Type of content: 'text', 'rich_text', 'image', 'link', 'mixed'.
 * @param {string} [notification.image_url] - URL for image content.
 * @param {string} [notification.link_url] - URL for link content.
 * @param {'low'|'medium'|'high'|'urgent'} [notification.priority='medium'] - Priority level.
 */
export const showNotificationToast = (notification) => {
  const {
    title,
    content,
    content_type = 'text',
    image_url,
    link_url,
    priority = 'medium',
  } = notification;

  let toastType = toast.info;
  // 读取用户偏好
  let userSettings = null;
  try {
    userSettings = JSON.parse(localStorage.getItem('notificationSettings') || 'null');
  } catch {}
  const duration = userSettings?.toastDuration || 5000;
  let toastOptions = {
    autoClose: duration,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: 'light',
  };

  switch (priority) {
    case 'low':
      toastType = toast.info;
      break;
    case 'medium':
      toastType = toast.info;
      break;
    case 'high':
      toastType = toast.warn;
      break;
    case 'urgent':
      toastType = toast.error;
      break;
    default:
      toastType = toast.info;
  }

  // 免打扰时间段检查（紧急不屏蔽）
  const inDnd = (() => {
    if (!userSettings?.doNotDisturbStart || !userSettings?.doNotDisturbEnd) return false;
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const start = userSettings.doNotDisturbStart;
      const end = userSettings.doNotDisturbEnd;
      if (start === end) return false;
      if (start < end) {
        return nowStr >= start && nowStr <= end;
      } else {
        // 跨午夜
        return nowStr >= start || nowStr <= end;
      }
    } catch {
      return false;
    }
  })();
  if (inDnd && priority !== 'urgent') return;

  const renderContent = () => {
    switch (content_type) {
      case 'rich_text':
        return React.createElement(
          'div',
          null,
          React.createElement('strong', null, title),
          React.createElement('div', { dangerouslySetInnerHTML: { __html: content } })
        )
      case 'image':
        return React.createElement(
          'div',
          null,
          React.createElement('strong', null, title),
          React.createElement('p', null, content),
          image_url && React.createElement('img', { src: image_url, alt: 'Notification', style: { maxWidth: '100%', height: 'auto' } })
        )
      case 'link':
        return React.createElement(
          'div',
          null,
          React.createElement('strong', null, title),
          React.createElement('p', null, content),
          link_url && React.createElement('a', { href: link_url, target: '_blank', rel: 'noopener noreferrer' }, link_url)
        )
      case 'mixed':
        return React.createElement(
          'div',
          null,
          React.createElement('strong', null, title),
          React.createElement('div', { dangerouslySetInnerHTML: { __html: content } }),
          image_url && React.createElement('img', { src: image_url, alt: 'Notification', style: { maxWidth: '100%', height: 'auto' } }),
          link_url && React.createElement('a', { href: link_url, target: '_blank', rel: 'noopener noreferrer' }, link_url)
        )
      case 'text':
      default:
        return React.createElement(
          'div',
          null,
          React.createElement('strong', null, title),
          React.createElement('p', null, content)
        )
    }
  }
  // 播放提示音（可选）
  if (userSettings?.notificationSound && (priority === 'high' || priority === 'urgent')) {
    try {
      const audio = new Audio('/sounds/notify.mp3');
      audio.play().catch(() => {});
    } catch {}
  }
  toastType(renderContent(), toastOptions);
};
