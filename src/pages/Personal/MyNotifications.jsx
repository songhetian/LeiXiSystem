import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import { formatDate, getBeijingDate } from '../../utils/date';
import Breadcrumb from '../../components/Breadcrumb';
import {
  BellIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  ClockIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

export default function MyNotifications({ unreadCount: propUnreadCount, setUnreadCount: propSetUnreadCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    type: '',
    isRead: ''
  });

  const [quickFilter, setQuickFilter] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : 0;
  const setUnreadCount = propSetUnreadCount || (() => {});

  const userId = JSON.parse(localStorage.getItem('user') || '{}').id;

  useEffect(() => {
    if (userId) {
      loadNotifications();
    }
  }, [pagination.page, pagination.pageSize, filters, quickFilter, userId]);

  const setQuickDateFilter = (days) => {
    setQuickFilter(days);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      const getFormattedDate = (date) => formatDate(date, false);

      if (quickFilter === 'today') {
        const d = getBeijingDate();
        const dateStr = getFormattedDate(d);
        startDate = `${dateStr} 00:00:00`;
        endDate = `${dateStr} 23:59:59`;
      } else if (quickFilter === 'yesterday') {
        const d = getBeijingDate();
        d.setDate(d.getDate() - 1);
        const dateStr = getFormattedDate(d);
        startDate = `${dateStr} 00:00:00`;
        endDate = `${dateStr} 23:59:59`;
      } else if (quickFilter === 'last7days') {
        const start = getBeijingDate();
        start.setDate(start.getDate() - 6);
        const end = getBeijingDate();
        startDate = `${getFormattedDate(start)} 00:00:00`;
        endDate = `${getFormattedDate(end)} 23:59:59`;
      }

      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        userId,
        type: filters.type || undefined,
        isRead: filters.isRead === 'true' ? true : (filters.isRead === 'false' ? false : undefined),
        startDate,
        endDate
      };

      const response = await axios.get(getApiUrl('/api/notifications'), { params });

      if (response.data && response.data.success) {
        setNotifications(response.data.data.map(item => ({
          ...item,
          is_read: item.is_read === 1 || item.is_read === true
        })));
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      }
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notification) => {
    if (notification.is_read) return;
    try {
      const url = notification.category === 'broadcast' 
        ? getApiUrl(`/api/broadcasts/${notification.id}/read`)
        : getApiUrl(`/api/notifications/${notification.id}/read`);
      await axios.put(url);
      setNotifications(prev => prev.map(n =>
        (n.id === notification.id && n.category === notification.category) ? { ...n, is_read: true } : n
      ));
      // 刷新全局未读数
      const countRes = await axios.get(getApiUrl(`/api/notifications/unread-count?userId=${userId}`));
      setUnreadCount(countRes.data.count);
    } catch (error) {}
  };

  const deleteNotification = async (id, category, e) => {
    e?.stopPropagation();
    if (category === 'broadcast') {
      toast.error('系统广播无法删除');
      return;
    }
    if (!window.confirm('确定要删除这条通知吗？')) return;
    try {
      await axios.delete(getApiUrl(`/api/notifications/${id}`));
      loadNotifications();
      toast.success('删除成功');
    } catch (error) {}
  };

  const clearFilters = () => {
    setFilters({ type: '', isRead: '' });
    setQuickFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getIcon = (type, category) => {
    if (category === 'broadcast') return <MegaphoneIcon className="w-5 h-5" />;
    switch (type) {
      case 'clock_reminder': return <ClockIcon className="w-5 h-5" />;
      case 'leave_approval': return <CheckCircleIcon className="w-5 h-5" />;
      case 'exam_notification': return <DocumentTextIcon className="w-5 h-5" />;
      default: return <BellIcon className="w-5 h-5" />;
    }
  };

  const getColorClass = (type, category) => {
    if (category === 'broadcast') return 'bg-purple-50 text-purple-600 border-purple-200';
    switch (type) {
      case 'clock_reminder': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'leave_approval': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'exam_notification': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
      default: return 'bg-blue-50 text-blue-600 border-blue-200';
    }
  };

  const getTypeName = (type, category) => {
    if (category === 'broadcast') return '系统广播';
    const names = {
      'clock_reminder': '打卡提醒',
      'leave_approval': '审批通知',
      'exam_notification': '考核通知',
      'system': '系统通知'
    };
    return names[type] || '通用消息';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 标题栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <BellIcon className="w-5 h-5" />
           </div>
           <div>
              <h1 className="text-xl font-bold text-gray-900">通知中心</h1>
              <p className="text-xs text-gray-500">您有 {unreadCount} 条未读消息</p>
           </div>
        </div>
        <button onClick={loadNotifications} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 筛选工具栏 (参考广播列表样式) */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
           <div className="flex bg-gray-100 p-1 rounded-lg">
              {[
                { id: '', label: '全部时间' },
                { id: 'today', label: '今天' },
                { id: 'yesterday', label: '昨天' },
                { id: 'last7days', label: '近七天' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setQuickDateFilter(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${quickFilter === item.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {item.label}
                </button>
              ))}
           </div>

           <div className="flex bg-gray-100 p-1 rounded-lg ml-2">
              {[
                { value: '', label: '全部状态' },
                { value: 'false', label: '未读' },
                { value: 'true', label: '已读' }
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => {
                     setFilters(prev => ({ ...prev, isRead: status.value }));
                     setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filters.isRead === status.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {status.label}
                </button>
              ))}
           </div>

           <select
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none hover:bg-gray-100 transition-colors ml-2"
              value={filters.type}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, type: e.target.value }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <option value="">全部类型</option>
              <option value="system">系统通知</option>
              <option value="leave_approval">审批通知</option>
              <option value="exam_notification">考核通知</option>
              <option value="clock_reminder">打卡提醒</option>
            </select>
        </div>

        {(filters.type || filters.isRead || quickFilter) && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors">
            <XMarkIcon className="w-4 h-4" />清除条件
          </button>
        )}
      </div>

      {/* 列表区域 (参考广播列表样式) */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent mb-3"></div>
            <span className="text-sm font-medium">加载中...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <BellIcon className="w-12 h-12 opacity-20 mb-4" />
            <p className="text-sm font-medium">暂无通知消息</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">标题内容</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">分类类型</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">发送时间</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {notifications.map((n) => (
                  <tr 
                    key={`${n.category}-${n.id}`} 
                    onClick={() => { setSelectedNotification(n); setShowModal(true); markAsRead(n); }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3">
                        {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 animate-pulse" />}
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${n.is_read ? 'text-gray-500' : 'text-gray-900'}`}>{n.title}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{n.content}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getColorClass(n.type, n.category)}`}>
                        {getTypeName(n.type, n.category)}
                      </span>
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`text-xs font-medium ${n.is_read ? 'text-gray-400' : 'text-blue-600'}`}>
                        {n.is_read ? '已读' : '未读'}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-xs text-gray-500 font-medium">
                      {new Date(n.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页栏 */}
      {pagination.total > 0 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
           <span className="text-xs font-bold text-gray-400 uppercase">Total {pagination.total}</span>
           <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <ChevronDownIcon className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-xs font-bold text-gray-700 mx-2">{pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}

      {/* 详情模态框 (参考广播列表样式) */}
      {showModal && selectedNotification && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
           <div
             className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
             onClick={e => e.stopPropagation()}
           >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${getColorClass(selectedNotification.type, selectedNotification.category)}`}>
                       {getIcon(selectedNotification.type, selectedNotification.category)}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{getTypeName(selectedNotification.type, selectedNotification.category)}</span>
                 </div>
                 <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                 </button>
              </div>

              <div className="p-8">
                 <h2 className="text-xl font-black text-gray-900 mb-2 leading-tight">{selectedNotification.title}</h2>
                 <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                    <span>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                    <span className={selectedNotification.is_read ? 'text-emerald-600' : 'text-blue-600'}>
                       {selectedNotification.is_read ? '● 已阅' : '● 未读'}
                    </span>
                 </div>
                 <div className="text-sm text-gray-600 leading-loose bg-gray-50 p-6 rounded-2xl border border-gray-100 font-medium">
                    {selectedNotification.content}
                 </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-50 flex justify-end">
                 <button
                   onClick={() => setShowModal(false)}
                   className="px-8 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20"
                 >
                   我知道了
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
