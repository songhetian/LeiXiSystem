import { toast } from 'sonner';

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

  // 读取用户偏好
  let userSettings = null;
  try {
    userSettings = JSON.parse(localStorage.getItem('notificationSettings') || 'null');
  } catch {}
  const duration = userSettings?.toastDuration || 5000;

  // 根据优先级确定toast类型
  let toastMethod = toast.info;
  switch (priority) {
    case 'low':
      toastMethod = toast.info;
      break;
    case 'medium':
      toastMethod = toast.info;
      break;
    case 'high':
      toastMethod = toast.warning;
      break;
    case 'urgent':
      toastMethod = toast.error;
      break;
    default:
      toastMethod = toast.info;
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

  // 构建描述内容
  let description = content;
  if (content_type === 'rich_text') {
    // Sonner支持JSX，但为了安全起见，我们使用纯文本
    description = content.replace(/<[^>]*>/g, '');
  } else if (content_type === 'image' && image_url) {
    description = `${content}\n[图片]`;
  } else if (content_type === 'link' && link_url) {
    description = `${content}\n${link_url}`;
  } else if (content_type === 'mixed') {
    let mixedContent = content.replace(/<[^>]*>/g, '');
    if (image_url) mixedContent += '\n[图片]';
    if (link_url) mixedContent += `\n${link_url}`;
    description = mixedContent;
  }

  // 播放提示音（可选）
  if (userSettings?.notificationSound && (priority === 'high' || priority === 'urgent')) {
    try {
      const audio = new Audio('/sounds/notify.mp3');
      audio.play().catch(() => {});
    } catch {}
  }

  // 显示toast
  toastMethod(title, {
    description: description,
    duration: duration,
    position: 'bottom-right',
  });
};
