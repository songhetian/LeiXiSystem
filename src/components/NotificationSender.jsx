import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { toast } from 'react-toastify';
import axios from 'axios';

const NotificationSender = () => {
  const [type, setType] = useState('system'); // system, department, user
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState('text'); // text, rich_text, image, link, mixed
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [priority, setPriority] = useState('medium'); // low, medium, high, urgent
  const [departmentId, setDepartmentId] = useState('');
  const [userIds, setUserIds] = useState(''); // Comma separated user IDs
  const [expiresAt, setExpiresAt] = useState('');

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, []);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(getApiUrl('/api/departments?forManagement=true'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartments(response.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments.');
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(getApiUrl('/api/users-with-roles'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const payload = {
        type,
        title,
        content,
        content_type: contentType,
        image_url: imageUrl || null,
        link_url: linkUrl || null,
        priority,
        expires_at: expiresAt || null,
      };

      if (type === 'department') {
        payload.department_id = parseInt(departmentId);
      } else if (type === 'user') {
        payload.user_ids = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      const response = await axios.post(getApiUrl('/api/notifications'), payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        toast.success('Notification sent successfully!');
        // Clear form
        setTitle('');
        setContent('');
        setImageUrl('');
        setLinkUrl('');
        setDepartmentId('');
        setUserIds('');
        setExpiresAt('');
      } else {
        toast.error(response.data.message || 'Failed to send notification.');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification.');
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">发送通知</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">通知类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="system">系统通知 (全员)</option>
            <option value="department">部门通知</option>
            <option value="user">人员通知</option>
          </select>
        </div>

        {type === 'department' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">选择部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              required={type === 'department'}
            >
              <option value="">请选择部门</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'user' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              指定用户ID (逗号分隔)
            </label>
            <input
              type="text"
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="例如: 1, 2, 3"
              required={type === 'user'}
            />
            <p className="mt-1 text-xs text-gray-500">
              可用用户: {users.map(u => `${u.real_name}(${u.id})`).join(', ')}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">内容类型</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="text">纯文本</option>
            <option value="rich_text">富文本 (HTML)</option>
            <option value="image">图片</option>
            <option value="link">超链接</option>
            <option value="mixed">混合内容</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="5"
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            required
          ></textarea>
        </div>

        {(contentType === 'image' || contentType === 'mixed') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">图片URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="例如: https://example.com/image.jpg"
            />
          </div>
        )}

        {(contentType === 'link' || contentType === 'mixed') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">链接URL</label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="例如: https://example.com"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">优先级</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">过期时间 (可选)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
          />
        </div>

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          发送通知
        </button>
      </form>
    </div>
  );
};

export default NotificationSender;