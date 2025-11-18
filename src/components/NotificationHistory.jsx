import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const NotificationHistory = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchNotificationHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found.');
      }

      // This endpoint needs to be created on the backend for administrators
      const response = await fetch(
        getApiUrl(`/api/notifications/history/all?page=${page}&pageSize=${pageSize}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch notification history.');
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
    fetchNotificationHistory();
  }, [page, pageSize]);

  if (loading) {
    return <div className="p-6 text-center">Loading history...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 mt-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">通知发送历史</h2>
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无历史记录</div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="p-4 border rounded-lg shadow-sm bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-800">{notification.title}</h3>
                <span className="text-sm text-gray-500">
                  {format(new Date(notification.created_at), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>
              <p className="text-gray-600 text-sm">Type: {notification.type}</p>
              <p className="text-gray-600 text-sm">Priority: {notification.priority}</p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-blue-500">查看详情</summary>
                <div className="mt-2 p-2 bg-gray-100 rounded">
                  <p><strong>Content:</strong> {notification.content}</p>
                  {notification.link_url && <p><strong>Link:</strong> <a href={notification.link_url} target="_blank" rel="noopener noreferrer">{notification.link_url}</a></p>}
                  {notification.image_url && <p><strong>Image:</strong> <a href={notification.image_url} target="_blank" rel="noopener noreferrer">{notification.image_url}</a></p>}
                  <p><strong>Recipients:</strong> {notification.recipient_count} users</p>
                  <p><strong>Read Count:</strong> {notification.read_count}</p>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

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

export default NotificationHistory;
