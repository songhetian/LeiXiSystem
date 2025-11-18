import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'read', 'unread'

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found.');
      }

      const response = await fetch(
        getApiUrl(`/api/notifications?page=${page}&pageSize=${pageSize}&status=${statusFilter}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch notifications.');
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, pageSize, statusFilter]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/notifications/${notificationId}/read`), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark notification as read.');
      }

      toast.success('Notification marked as read.');
      fetchNotifications(); // Refresh list
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/notifications/read-all`), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark all notifications as read.');
      }

      toast.success('All notifications marked as read.');
      fetchNotifications(); // Refresh list
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/notifications/${notificationId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete notification.');
      }

      toast.success('Notification deleted.');
      fetchNotifications(); // Refresh list
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const renderNotificationContent = (notification) => {
    const { content, content_type, image_url, link_url } = notification;
    switch (content_type) {
      case 'rich_text':
        return <div dangerouslySetInnerHTML={{ __html: content }} />;
      case 'image':
        return (
          <div>
            <p>{content}</p>
            {image_url && <img src={image_url} alt="Notification" className="max-w-full h-auto mt-2" />}
          </div>
        );
      case 'link':
        return (
          <div>
            <p>{content}</p>
            {link_url && (
              <a href={link_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mt-2 block">
                {link_url}
              </a>
            )}
          </div>
        );
      case 'mixed':
        return (
          <div>
            <div dangerouslySetInnerHTML={{ __html: content }} />
            {image_url && <img src={image_url} alt="Notification" className="max-w-full h-auto mt-2" />}
            {link_url && (
              <a href={link_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mt-2 block">
                {link_url}
              </a>
            )}
          </div>
        );
      case 'text':
      default:
        return <p>{content}</p>;
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading notifications...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">通知中心</h2>

      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setStatusFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === 'unread' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            未读
          </button>
          <button
            onClick={() => setStatusFilter('read')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === 'read' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            已读
          </button>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
        >
          全部标为已读
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无通知</div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border rounded-lg shadow-sm ${
                notification.is_read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className={`text-lg font-semibold ${notification.is_read ? 'text-gray-800' : 'text-blue-800'}`}>
                  {notification.title}
                </h3>
                <span className="text-sm text-gray-500">
                  {format(new Date(notification.created_at), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>
              <div className="text-gray-700 text-sm mb-3">
                {renderNotificationContent(notification)}
              </div>
              <div className="flex justify-end space-x-2">
                {!notification.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600"
                  >
                    标为已读
                  </button>
                )}
                <button
                  onClick={() => handleDeleteNotification(notification.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-l-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2 border-t border-b bg-gray-50">
            页 {page} / {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(Math.ceil(total / pageSize), prev + 1))}
            disabled={page === Math.ceil(total / pageSize)}
            className="px-4 py-2 border rounded-r-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;