import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CalendarIcon,
  DocumentTextIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function MyNotifications({ unreadCount: propUnreadCount, setUnreadCount: propSetUnreadCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // 使用传入的unreadCount或本地状态
  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : localUnreadCount;
  const setUnreadCount = propSetUnreadCount || setLocalUnreadCount;


  // 筛选状态
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    isRead: '',
    startDate: '',
    endDate: ''
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const userId = JSON.parse(localStorage.getItem('user') || '{}').id;

  // Tab配置
  const tabs = [
    { id: 'all', label: '全部通知', icon: BellIcon },
    { id: 'unread', label: '未读消息', icon: ExclamationCircleIcon, badge: unreadCount },
    { id: 'broadcast', label: '系统广播', icon: MegaphoneIcon },
    { id: 'approval', label: '审批通知', icon: DocumentTextIcon },
    { id: 'exam', label: '考试通知', icon: CheckCircleIcon }
  ];

  // 根据Tab获取类型筛选
  const getTypeFilterByTab = (tab) => {
    switch (tab) {
      case 'unread':
        return { isRead: 'false' };
      case 'broadcast':
        return { type: 'broadcast' };
      case 'approval':
        return { type: 'leave_approval,overtime_approval,makeup_approval' };
      case 'exam':
        return { type: 'exam_notification,exam_result' };
      default:
        return {};
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const tabFilters = getTypeFilterByTab(activeTab);
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        userId,
        search: filters.search || undefined,
        type: filters.type || tabFilters.type || undefined,
        isRead: filters.isRead || tabFilters.isRead || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await axios.get(getApiUrl('/api/notifications'), { params });

      if (response.data && response.data.success) {
        const notificationData = (response.data.data || []).map(item => ({
          ...item,
          is_read: item.is_read === 1 || item.is_read === true
        }));

        setNotifications(notificationData);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      }
    } catch (error) {
      console.error('加载通知失败:', error);
      toast.error('加载通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadNotifications();
      loadUnreadCount();
    }
  }, [userId, pagination.page, filters, activeTab]);

  const loadUnreadCount = async () => {
    try {
      const response = await axios.get(getApiUrl(`/api/notifications/unread-count?userId=${userId}`));
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('加载未读数量失败:', error);
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
      loadUnreadCount();
      if (selectedNotification?.id === notification.id) {
        setSelectedNotification(prev => ({ ...prev, is_read: true }));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(getApiUrl('/api/notifications/read-all'), { userId });
      loadNotifications();
      loadUnreadCount();
      toast.success('全部已读');
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      // 简化处理，由于后端接口限制，循环调用或等待后端支持批量
      await Promise.all(selectedIds.map(id => {
        const n = notifications.find(notif => notif.id === id);
        const url = n?.category === 'broadcast' 
          ? getApiUrl(`/api/broadcasts/${id}/read`)
          : getApiUrl(`/api/notifications/${id}/read`);
        return axios.put(url);
      }));
      loadNotifications();
      loadUnreadCount();
      setSelectedIds([]);
      toast.success('操作成功');
    } catch (error) {}
  };

  const deleteNotification = async (id, category, e) => {
    e?.stopPropagation();
    if (category === 'broadcast') {
      toast.error('系统广播暂不支持删除');
      return;
    }
    if (!window.confirm('确定要删除这条通知吗？')) return;

    try {
      await axios.delete(getApiUrl(`/api/notifications/${id}`));
      loadNotifications();
      loadUnreadCount();
      toast.success('删除成功');
      if (selectedNotification?.id === id) {
        setShowModal(false);
      }
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.length} 条通知吗？`)) return;

    try {
      await Promise.all(selectedIds.map(id =>
        axios.delete(getApiUrl(`/api/notifications/${id}`))
      ));
      loadNotifications();
      loadUnreadCount();
      setSelectedIds([]);
      toast.success('操作成功');
    } catch (error) {}
  };

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setShowModal(true);
    markAsRead(notification);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const setQuickDateFilter = (type) => {
    const today = new Date();
    const startDate = new Date();

    switch (type) {
      case 'today':
        setFilters(prev => ({
          ...prev,
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }));
        break;
      case 'week':
        startDate.setDate(today.getDate() - 7);
        setFilters(prev => ({
          ...prev,
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }));
        break;
      default:
        break;
    }
    setPagination(prev => ({ ...prev, page: 1 }));
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
      case 'system': return <BellIcon className="w-5 h-5" />;
      default: return <BellIcon className="w-5 h-5" />;
    }
  };

  const getColorClass = (type, category) => {
    if (category === 'broadcast') return 'bg-yellow-100 text-yellow-600';
    switch (type) {
      case 'clock_reminder': return 'bg-orange-100 text-orange-600';
      case 'leave_approval': return 'bg-green-100 text-green-600';
      case 'exam_notification': return 'bg-indigo-100 text-indigo-600';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  const getTypeName = (type, category) => {
    if (category === 'broadcast') return '系统广播';
    const names = {
      'clock_reminder': '打卡提醒',
      'leave_approval': '请假审批',
      'overtime_approval': '加班审批',
      'makeup_approval': '补卡审批',
      'schedule_change': '排班变更',
      'attendance_abnormal': '考勤异常',
      'exam_notification': '考试通知',
      'exam_result': '考试成绩',
      'system': '系统通知'
    };
    return names[type] || '系统通知';
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      isRead: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* 1. Header & Tabs */}
      <div className="bg-white border-b border-gray-100 shadow-sm z-20 sticky top-0 backdrop-blur-xl bg-white/90">
        <div className="max-w-6xl mx-auto w-full">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
                <BellIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">通知中心</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  您有 <span className="font-bold text-blue-600">{unreadCount}</span> 条未读消息
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <>
                  <button onClick={markSelectedAsRead} className="px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors text-sm font-semibold">标记已读 ({selectedIds.length})</button>
                  <button onClick={deleteSelected} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-semibold">删除 ({selectedIds.length})</button>
                </>
              )}
              <button onClick={markAllAsRead} disabled={unreadCount === 0} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 text-sm font-medium">全部已读</button>
              <button onClick={loadNotifications} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-md shadow-gray-900/10">刷新</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pb-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPagination(prev => ({ ...prev, page: 1 }));
                      setSelectedIds([]);
                    }}
                    className={`
                      relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap border-b-2
                      ${isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'stroke-2' : ''}`} />
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className={`
                        ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center leading-tight
                        ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-red-500 text-white'}
                      `}>
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-6xl mx-auto w-full px-6 py-6 pb-24">
          {/* Filters Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索通知..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setQuickDateFilter('today')} className="px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-sm font-bold">今天</button>
                <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold ${showFilters ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                   <FunnelIcon className="w-4 h-4" /> 筛选 {showFilters ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                <select className="px-3 py-2.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-blue-500 text-sm font-bold outline-none" value={filters.type} onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}>
                   <option value="">全部类型</option>
                   <option value="leave_approval">请假审批</option>
                   <option value="makeup_approval">补卡审批</option>
                   <option value="exam_notification">考试通知</option>
                   <option value="system">系统通知</option>
                </select>
                <select className="px-3 py-2.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-blue-500 text-sm font-bold outline-none" value={filters.isRead} onChange={(e) => setFilters(prev => ({ ...prev, isRead: e.target.value }))}>
                   <option value="">全部状态</option>
                   <option value="false">未读</option>
                   <option value="true">已读</option>
                </select>
                <input type="date" className="px-3 py-2.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-blue-500 text-sm outline-none" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} />
                <input type="date" className="px-3 py-2.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-blue-500 text-sm outline-none" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} />
              </div>
            )}
          </div>

          {/* Selection Info */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between mb-4 px-2">
               <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={selectedIds.length === notifications.length && notifications.length > 0} onChange={handleSelectAll} className="w-5 h-5 text-blue-600 border-gray-300 rounded-lg focus:ring-blue-500 transition-all cursor-pointer" />
                  <span className="text-sm font-bold text-gray-500 group-hover:text-gray-900 uppercase tracking-widest">Select All</span>
               </label>
               {selectedIds.length > 0 && (
                 <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{selectedIds.length} ITEMS SELECTED</span>
               )}
            </div>
          )}

          {/* List Area */}
          <div className="space-y-3 min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-20 opacity-50">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100 opacity-40">
                <div className="text-center">
                  <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest">No Notifications Found</h3>
                </div>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={`${notification.category}-${notification.id}`}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    group relative bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer
                    ${notification.is_read
                      ? 'border-gray-100 hover:shadow-md hover:border-gray-200'
                      : 'border-blue-100 shadow-sm shadow-blue-500/5 hover:border-blue-200 bg-blue-50/10'
                    }
                  `}
                >
                  <div className="flex items-start gap-5">
                    <div className={`pt-1 ${selectedIds.length > 0 || selectedIds.includes(notification.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(notification.id)} onChange={(e) => handleSelectOne(notification.id, e)} className="w-5 h-5 text-blue-600 border-gray-300 rounded-lg focus:ring-blue-500 cursor-pointer" />
                    </div>

                    <div className={`p-3 rounded-2xl shrink-0 ${getColorClass(notification.type, notification.category)} border border-transparent group-hover:border-current transition-all`}>
                      {getIcon(notification.type, notification.category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                         <div className="flex items-center gap-3 flex-wrap min-w-0">
                           {!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-pulse"></span>}
                           <h3 className={`font-black text-base truncate ${notification.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                             {notification.title}
                           </h3>
                           <span className={`px-2 py-0.5 text-[9px] rounded-md font-black tracking-widest uppercase border ${notification.is_read ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                             {getTypeName(notification.type, notification.category)}
                           </span>
                         </div>
                         <div className="flex items-center gap-3 shrink-0">
                           <span className="text-[10px] text-gray-400 font-black uppercase bg-gray-50 px-2 py-1 rounded">
                             {new Date(notification.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                           </span>
                           <button onClick={(e) => deleteNotification(notification.id, notification.category, e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                             <TrashIcon className="w-4 h-4" />
                           </button>
                         </div>
                      </div>
                      <p className={`text-sm leading-relaxed line-clamp-2 font-medium ${notification.is_read ? 'text-gray-400' : 'text-gray-600'}`}>{notification.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
             <div className="mt-10 flex items-center justify-center gap-2">
                <button onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))} disabled={pagination.page === 1} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-900 disabled:opacity-20 transition-all shadow-sm"><ChevronLeftIcon className="w-5 h-5" /></button>
                <div className="flex gap-1">
                   {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => (
                     <button key={i} onClick={() => setPagination(p => ({ ...p, page: i + 1 }))} className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${pagination.page === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}>{i + 1}</button>
                   ))}
                </div>
                <button onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))} disabled={pagination.page === pagination.totalPages} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-900 disabled:opacity-20 transition-all shadow-sm"><ChevronRightIcon className="w-5 h-5" /></button>
             </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selectedNotification && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden transform transition-all scale-100 border border-white/20">
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50 bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${getColorClass(selectedNotification.type, selectedNotification.category)} border border-current/10`}>
                  {getIcon(selectedNotification.type, selectedNotification.category)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{getTypeName(selectedNotification.type, selectedNotification.category)}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{new Date(selectedNotification.created_at).toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-100"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="p-10">
              <h2 className="text-2xl font-black text-gray-900 mb-6 leading-tight tracking-tight">{selectedNotification.title}</h2>
              <div className="bg-gray-50/50 p-8 rounded-3xl text-gray-600 leading-loose text-base border border-gray-100 font-medium">
                {selectedNotification.content}
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-50 flex justify-between items-center">
              <button onClick={() => deleteNotification(selectedNotification.id, selectedNotification.category)} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">Delete Message</button>
              <button onClick={() => setShowModal(false)} className="px-10 py-3 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/20 text-xs font-black uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
