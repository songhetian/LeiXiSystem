import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { toast } from 'sonner';
import {
  BellIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

const NotificationDropdown = ({ onClose, onNavigate, onUpdateUnread }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const dropdownRef = useRef(null);
  const userId = JSON.parse(localStorage.getItem('user') || '{}').id;

  // ... (existing useEffects and load functions remain same)

  // Need to ensure existing load functions are preserved or I should just replace the component logic carefully.
  // To avoid huge replacement, I will stick to adding the modal and existing logic.
  // Actually, I should use replace_file_content on specific parts or verify I have the whole file.
  // I have viewed the whole file in Step 95.

  // Rerendering the whole component with updates is safer for structure changes.

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();

    // Click outside handler
    const handleClickOutside = (event) => {
      // If modal is open, don't close dropdown logic might interfere, but modal is usually a portal or top layer.
      // However, if dropdown closes, this component unmounts?
      // ERROR RISK: NotificationDropdown is likely conditionally rendered by parent.
      // If I close it, I can't show the modal if the modal is INSIDE it.
      // CHECK PARENT: TopNavbar.jsx

      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !showConfirmModal) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfirmModal]); // Added dependency

  const loadNotifications = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/notifications'), {
        params: {
          userId,
          page: 1,
          pageSize: 10, // 增加显示条数
          isRead: 'false', // 仅获取未读消息
        }
      });

      if (response.data && response.data.success) {
        setNotifications(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await axios.get(getApiUrl(`/api/notifications/unread-count?userId=${userId}`));
      setUnreadCount(response.data.count);
      if (onUpdateUnread) {
        onUpdateUnread(response.data.count);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(getApiUrl('/api/notifications/read-all'), { userId });
      // 清空本地列表，因为我们只显示未读
      setNotifications([]);
      setUnreadCount(0);
      if (onUpdateUnread) {
        onUpdateUnread(0);
      }
      toast.success('全部已读');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('操作失败');
    }
  };

  const markAsRead = async (id, category) => {
    try {
      const url = category === 'broadcast' 
        ? getApiUrl(`/api/broadcasts/${id}/read`)
        : getApiUrl(`/api/notifications/${id}/read`);
      await axios.put(url);
      // 从本地列表中移除该项
      setNotifications(prev => prev.filter(n => !(n.id === id && n.category === category)));
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // 立即标记为已读并从列表中移除
    markAsRead(notification.id, notification.category);

    // Handle broadcast type
    if (notification.category === 'broadcast' || notification.related_type === 'broadcast') {
      onNavigate('messaging-broadcast');
      onClose();
      return;
    }

    // Check if it is an exam notification
    if (
      notification.type === 'exam_notification' ||
      notification.type === 'assessment_plan' ||
      notification.title?.includes('考核') ||
      notification.title?.includes('考试')
    ) {
       setSelectedNotification(notification);
       setShowConfirmModal(true);
       return;
    }

    // Check if it is a payslip notification
    if (notification.type === 'payslip' || notification.title?.includes('工资条')) {
      onNavigate('my-payslips');
      onClose();
      return;
    }

    onNavigate('my-notifications');
    onClose();
  };

  const handleConfirmJump = () => {
    setShowConfirmModal(false);
    onNavigate('my-exams'); // Jump to My Exams
    onClose();
  };

  const getIcon = (type, category) => {
    if (category === 'broadcast') return <MegaphoneIcon className="w-5 h-5" />;
    
    switch (type) {
      case 'clock_reminder': return <ClockIcon className="w-5 h-5" />;
      case 'leave_approval': return <DocumentTextIcon className="w-5 h-5" />;
      case 'overtime_approval': return <ClockIcon className="w-5 h-5" />;
      case 'makeup_approval': return <ClockIcon className="w-5 h-5" />;
      case 'schedule_change': return <CalendarIcon className="w-5 h-5" />;
      case 'attendance_abnormal': return <ExclamationCircleIcon className="w-5 h-5" />;
      case 'exam_notification': return <DocumentTextIcon className="w-5 h-5" />;
      case 'exam_result': return <CheckCircleIcon className="w-5 h-5" />;
      case 'payslip': return <CheckCircleIcon className="w-5 h-5" />;
      case 'system': return <BellIcon className="w-5 h-5" />;
      default: return <BellIcon className="w-5 h-5" />;
    }
  };

  const getColorClass = (type, category) => {
    if (category === 'broadcast') return 'bg-violet-50 text-violet-600';

    switch (type) {
      case 'clock_reminder': return 'bg-orange-50 text-orange-600';
      case 'leave_approval': return 'bg-green-50 text-green-600';
      case 'overtime_approval': return 'bg-purple-50 text-purple-600';
      case 'makeup_approval': return 'bg-cyan-50 text-cyan-600';
      case 'schedule_change': return 'bg-blue-50 text-blue-600';
      case 'attendance_abnormal': return 'bg-red-50 text-red-600';
      case 'exam_notification': return 'bg-indigo-50 text-indigo-600';
      case 'exam_result': return 'bg-teal-50 text-teal-600';
      case 'payslip': return 'bg-green-50 text-green-600';
      case 'system': return 'bg-gray-50 text-gray-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <>
    <div
      ref={dropdownRef}
      className="absolute top-10 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-down"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-800">未读通知</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={markAllAsRead}
          className="text-[10px] text-blue-600 hover:text-blue-700 font-bold disabled:opacity-50"
          disabled={unreadCount === 0}
        >
          全部已读
        </button>
      </div>

      {/* List */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 text-center text-gray-400 text-[10px]">
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <BellIcon className="w-8 h-8 text-gray-200 mx-auto mb-1" />
            <p className="text-gray-400 text-xs">暂无未读消息</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map(notification => (
              <div
                key={`${notification.category}-${notification.id}`}
                onClick={() => handleNotificationClick(notification)}
                className="p-2.5 hover:bg-gray-50 transition-colors cursor-pointer flex gap-2.5 bg-blue-50/10"
              >
                <div className={`p-1.5 rounded-md h-fit shrink-0 ${getColorClass(notification.type, notification.category)}`}>
                  {React.cloneElement(getIcon(notification.type, notification.category), { className: 'w-4 h-4' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="text-xs font-bold truncate pr-1 text-gray-900">
                      {notification.title}
                    </h4>
                    <span className="text-[9px] text-gray-400 shrink-0 font-medium">
                      {new Date(notification.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-1 leading-tight">
                    {notification.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 bg-gray-50/30">
        <button
          onClick={() => {
            onNavigate('my-notifications');
            onClose();
          }}
          className="w-full py-2 text-center text-[11px] text-gray-500 hover:text-blue-600 hover:bg-gray-100 font-bold transition-colors"
        >
          查看全部通知
        </button>
      </div>
    </div>

    {/* Jump Confirmation Modal */}
    {showConfirmModal && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="新考核通知"
          size="small"
          zIndex={2000} // Ensure it is above everything
        >
          <div className="space-y-4">
             <div className="flex items-start gap-3">
                <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                   <DocumentTextIcon className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-lg font-medium text-gray-900">新的考核计划</h3>
                   <p className="text-gray-600 mt-1">您收到一个新的考核计划：<span className="font-semibold">{selectedNotification?.title}</span></p>
                   <p className="text-gray-500 text-sm mt-2">是否立即前往参加考试？</p>
                </div>
             </div>

             <div className="flex justify-end gap-3 mt-4">
               <button
                 onClick={() => setShowConfirmModal(false)}
                 className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
               >
                 稍后再说
               </button>
               <button
                 onClick={handleConfirmJump}
                 className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md"
               >
                 立即前往
               </button>
             </div>
          </div>
        </Modal>
    )}
    </>
  );
};

export default NotificationDropdown;
