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
  let toastOptions = {
    autoClose: 5000,
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

  const renderContent = () => {
    switch (content_type) {
      case 'rich_text':
        return (
          <div>
            <strong>{title}</strong>
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      case 'image':
        return (
          <div>
            <strong>{title}</strong>
            <p>{content}</p>
            {image_url && <img src={image_url} alt="Notification" style={{ maxWidth: '100%', height: 'auto' }} />}
          </div>
        );
      case 'link':
        return (
          <div>
            <strong>{title}</strong>
            <p>{content}</p>
            {link_url && <a href={link_url} target="_blank" rel="noopener noreferrer">{link_url}</a>}
          </div>
        );
      case 'mixed':
        return (
          <div>
            <strong>{title}</strong>
            <div dangerouslySetInnerHTML={{ __html: content }} />
            {image_url && <img src={image_url} alt="Notification" style={{ maxWidth: '100%', height: 'auto' }} />}
            {link_url && <a href={link_url} target="_blank" rel="noopener noreferrer">{link_url}</a>}
          </div>
        );
      case 'text':
      default:
        return (
          <div>
            <strong>{title}</strong>
            <p>{content}</p>
          </div>
        );
    }
  };

  toastType(renderContent(), toastOptions);
};
