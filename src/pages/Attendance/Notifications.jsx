import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../utils/apiConfig';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 分页和搜索状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRead, setFilterRead] = useState('');

  const userId = localStorage.getItem('userId') || 1;

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
    // 每30秒刷新一次
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [currentPage, searchText, filterType, filterRead]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        page: currentPage,
        pageSize,
        search: searchText,
        type: filterType,
        isRead: filterRead
      });

      const response = await axios.get(getApiUrl(`/api/notifications?${params}`));
      setNotifications(response.data.data);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('加载通知失败:', error);
      alert('加载通知失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await axios.get(getApiUrl(`/api/notifications/unread-count?userId=${userId}`));
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.put(getApiUrl(`/api/notifications/${id}/read`));
      loadNotifications();
      loadUnreadCount();

      // 如果模态框打开，更新当前通知状态
      if (selectedNotification && selectedNotification.id === id) {
        setSelectedNotification({ ...selectedNotification, is_read: true });
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setShowModal(true);

    // 如果是未读消息，自动标记为已读
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedNotification(null);
  };

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  const handleTypeFilter = (e) => {
    setFilterType(e.target.value);
    setCurrentPage(1);
  };

  const handleReadFilter = (e) => {
    setFilterRead(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(getApiUrl('/api/notifications/read-all'), { userId });
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  const deleteNotification = async (id) => {
    if (!window.confirm('确定要删除这条通知吗？')) return;

    try {
      await axios.delete(getApiUrl(`/api/notifications/${id}`));
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      'clock_reminder': '⏰',
      'leave_approval': '📝',
      'overtime_approval': '⏱️',
      'makeup_approval': '🔄',
      'schedule_change': '📅',
      'attendance_abnormal': '⚠️'
    };
    return icons[type] || '📢';
  };

  const getTypeColor = (type) => {
    const colors = {
      'clock_reminder': '#FF9800',
      'leave_approval': '#4CAF50',
      'overtime_approval': '#2196F3',
      'makeup_approval': '#9C27B0',
      'schedule_change': '#00BCD4',
      'attendance_abnormal': '#F44336'
    };
    return colors[type] || '#757575';
  };

  const getTypeName = (type) => {
    const names = {
      'clock_reminder': '打卡提醒',
      'leave_approval': '请假审批',
      'overtime_approval': '加班审批',
      'makeup_approval': '补卡审批',
      'schedule_change': '排班变更',
      'attendance_abnormal': '考勤异常'
    };
    return names[type] || '系统通知';
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>消息通知</h2>
        <div className="header-actions">
          <span className="unread-badge">
            未读: {unreadCount}
          </span>
          <button onClick={markAllAsRead} className="btn-mark-all">
            全部已读
          </button>
          <button onClick={loadNotifications} className="btn-refresh">
            刷新
          </button>
        </div>
      </div>

      {/* 搜索和筛选区域 */}
      <div className="notifications-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索通知标题或内容..."
            value={searchText}
            onChange={handleSearch}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-group">
          <select value={filterType} onChange={handleTypeFilter} className="filter-select">
            <option value="">全部类型</option>
            <option value="clock_reminder">打卡提醒</option>
            <option value="leave_approval">请假审批</option>
            <option value="overtime_approval">加班审批</option>
            <option value="makeup_approval">补卡审批</option>
            <option value="schedule_change">排班变更</option>
            <option value="attendance_abnormal">考勤异常</option>
          </select>

          <select value={filterRead} onChange={handleReadFilter} className="filter-select">
            <option value="">全部状态</option>
            <option value="false">未读</option>
            <option value="true">已读</option>
          </select>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="notifications-stats">
        共 {total} 条通知
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <p>暂无通知</p>
        </div>
      ) : (
        <>
          <div className="notifications-list">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div
                  className="notification-icon"
                  style={{ backgroundColor: getTypeColor(notification.type) }}
                >
                  {getTypeIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-title">
                    {notification.title}
                    {!notification.is_read && <span className="new-badge">新</span>}
                  </div>
                  <div className="notification-text">
                    {notification.content}
                  </div>
                  <div className="notification-time">
                    {new Date(notification.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="btn-read"
                    >
                      标记已读
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="btn-delete"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页组件 */}
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              上一页
            </button>

            <div className="pagination-info">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              下一页
            </button>
          </div>
        </>
      )}

      {/* 消息详情模态框 */}
      {showModal && selectedNotification && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon"
                  style={{ backgroundColor: getTypeColor(selectedNotification.type) }}
                >
                  {getTypeIcon(selectedNotification.type)}
                </div>
                <div>
                  <h3>{selectedNotification.title}</h3>
                  <span className="modal-type">{getTypeName(selectedNotification.type)}</span>
                </div>
              </div>
              <button onClick={closeModal} className="modal-close">×</button>
            </div>

            <div className="modal-body">
              <div className="modal-info-row">
                <span className="modal-label">状态：</span>
                <span className={`modal-status ${selectedNotification.is_read ? 'read' : 'unread'}`}>
                  {selectedNotification.is_read ? '已读' : '未读'}
                </span>
              </div>

              <div className="modal-info-row">
                <span className="modal-label">时间：</span>
                <span>{new Date(selectedNotification.created_at).toLocaleString('zh-CN')}</span>
              </div>

              <div className="modal-content-section">
                <div className="modal-label">内容：</div>
                <div className="modal-text">{selectedNotification.content}</div>
              </div>

              {selectedNotification.related_id && (
                <div className="modal-info-row">
                  <span className="modal-label">关联ID：</span>
                  <span>{selectedNotification.related_id}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!selectedNotification.is_read && (
                <button
                  onClick={() => markAsRead(selectedNotification.id)}
                  className="btn-modal-read"
                >
                  标记已读
                </button>
              )}
              <button
                onClick={() => {
                  deleteNotification(selectedNotification.id);
                  closeModal();
                }}
                className="btn-modal-delete"
              >
                删除
              </button>
              <button onClick={closeModal} className="btn-modal-close">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
