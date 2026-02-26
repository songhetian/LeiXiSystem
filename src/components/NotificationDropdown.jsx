import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
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
      className="absolute top-12 right-0 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white z-[3000] overflow-hidden animate-in slide-in-from-top-2 duration-300"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white/50">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">通知中心</h3>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-lg shadow-rose-100 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={markAllAsRead}
          className="text-[10px] text-blue-600 hover:text-blue-700 font-black disabled:opacity-50 transition-colors uppercase tracking-tighter"
          disabled={unreadCount === 0}
        >
          一键清除
        </button>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/20">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
            🔍 正在同步云端通知...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <BellIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">名册尚无未读消息</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map(notification => (
              <div
                key={`${notification.category}-${notification.id}`}
                onClick={() => handleNotificationClick(notification)}
                className="p-4 hover:bg-white transition-all cursor-pointer flex gap-3 group relative overflow-hidden"
              >
                {/* 悬浮装饰 */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transform -translate-x-full group-hover:translate-x-0 transition-transform" />
                
                <div className={`p-2 rounded-xl h-fit shrink-0 shadow-sm transition-transform group-hover:scale-110 ${getColorClass(notification.type, notification.category)}`}>
                  {React.cloneElement(getIcon(notification.type, notification.category), { className: 'w-4 h-4' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[12px] font-black text-slate-800 truncate pr-2 group-hover:text-blue-600 transition-colors">
                      {notification.title}
                    </h4>
                    <span className="text-[9px] font-bold text-slate-300 shrink-0 uppercase">
                      {new Date(notification.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
                    {notification.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white">
        <button
          onClick={() => {
            onNavigate('my-notifications');
            onClose();
          }}
          className="w-full py-3 text-center text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest"
        >
          进入全局通知中心 <ChevronRight size={10} className="inline ml-1" />
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
