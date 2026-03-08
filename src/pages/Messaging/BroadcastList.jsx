import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import api from '@/api';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import { formatDate, getBeijingDate } from '../../utils/date';
import Breadcrumb from '../../components/Breadcrumb';
import {
  SpeakerWaveIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  ArrowPathIcon,
  BellAlertIcon,
  InformationCircleIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

export default function BroadcastList() {
  const [broadcasts, setBroadcasts] = useState([]);
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

  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadBroadcasts();
  }, [pagination.page, pagination.pageSize, filters, quickFilter]);

  const setQuickDateFilter = (days) => {
    setQuickFilter(days);
    setFilters({
      type: '',
      isRead: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('未登录');
        return;
      }

      let startDate, endDate;

      // Get current Beijing date base
      // Helper to format date string to "YYYY-MM-DD" using project util (handles timezone)
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
      } else if (quickFilter === 'last3days') {
        const start = getBeijingDate();
        start.setDate(start.getDate() - 2);
        const end = getBeijingDate();

        startDate = `${getFormattedDate(start)} 00:00:00`;
        endDate = `${getFormattedDate(end)} 23:59:59`;
      } else if (quickFilter === 'last7days') {
        const start = getBeijingDate();
        start.setDate(start.getDate() - 6);
        const end = getBeijingDate();

        startDate = `${getFormattedDate(start)} 00:00:00`;
        endDate = `${getFormattedDate(end)} 23:59:59`;
      }

      const params = {
        page: pagination.page,
        limit: pagination.pageSize,
        type: filters.type || undefined,
        // Convert string "true"/"false" to boolean, or undefined if empty
        isRead: filters.isRead === 'true' ? true : (filters.isRead === 'false' ? false : undefined),
        startDate,
        endDate
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await api.get(getApiUrl('/api/broadcasts/my-broadcasts'), {
        params
      });

      if (response.data && response.data.success) {
        let broadcastData = (response.data.data || []).map(item => ({
          ...item,
          is_read: item.is_read === 1 || item.is_read === true
        }));

        broadcastData.sort((a, b) => {
          if (a.is_read !== b.is_read) {
            return a.is_read ? 1 : -1;
          }
          return new Date(b.created_at) - new Date(a.created_at);
        });

        setBroadcasts(broadcastData);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      }
    } catch (error) {
      logger.error('加载广播失败:', error);
      toast.error('加载广播失败');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await api.put(getApiUrl(`/api/broadcasts/${id}/read`), {});

      setBroadcasts(prev => prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));

      if (selectedBroadcast?.id === id) {
        setSelectedBroadcast(prev => ({ ...prev, is_read: true }));
      }
    } catch (error) {
      logger.error('标记已读失败:', error);
      toast.error('操作失败');
    }
  };

  const handleBroadcastClick = (broadcast) => {
    setSelectedBroadcast(broadcast);
    setShowModal(true);
    if (!broadcast.is_read) {
      markAsRead(broadcast.id);
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      isRead: ''
    });
    setQuickFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  /* --- Helper Functions --- */

  const getIcon = (type) => {
    switch (type) {
      case 'info': return <InformationCircleIcon className="w-5 h-5" />;
      case 'warning': return <ExclamationCircleIcon className="w-5 h-5" />;
      case 'error': return <BellAlertIcon className="w-5 h-5" />;
      case 'announcement': return <MegaphoneIcon className="w-5 h-5" />;
      case 'success': return <CheckCircleIcon className="w-5 h-5" />;
      default: return <SpeakerWaveIcon className="w-5 h-5" />;
    }
  };

  const getColorClass = (type, variant = 'bg') => {
    // variant: 'bg' (background), 'text' (text color), 'border' (border color), 'ring' (ring color)
    const colors = {
      info: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', ring: 'ring-blue-500/20' },
      warning: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', ring: 'ring-amber-500/20' },
      error: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', ring: 'ring-rose-500/20' },
      announcement: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', ring: 'ring-violet-500/20' },
      success: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', ring: 'ring-emerald-500/20' },
      default: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', ring: 'ring-gray-500/20' },
    };

    const style = colors[type] || colors.default;

    if (variant === 'all') return `${style.bg} ${style.text} ${style.border}`;
    return style[variant];
  };

  const getTypeName = (type) => {
    const names = {
      'info': '系统通知',
      'warning': '重要提醒',
      'error': '紧急警报',
      'announcement': '公司公告',
      'success': '操作成功'
    };
    return names[type] || '通用广播';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 顶部面包屑和标题 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
             <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <SpeakerWaveIcon className="w-5 h-5" />
             </div>
             <h1 className="text-xl font-bold text-gray-900">系统广播</h1>
          </div>
          <button
              onClick={loadBroadcasts}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="刷新列表"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] z-10">
         <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 左侧：快速筛选和类型 */}
            <div className="flex flex-wrap items-center gap-2">
               <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: '', label: '全部' },
                    { id: 'today', label: '今天' },
                    { id: 'yesterday', label: '昨天' },
                    { id: 'last3days', label: '近三天' },
                    { id: 'last7days', label: '近七天' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setQuickDateFilter(item.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        quickFilter === item.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
               </div>

               <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

               {/* 阅读状态 - 按钮组 */}
               <div className="flex bg-gray-100 p-1 rounded-lg">
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
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        filters.isRead === status.value
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
               </div>

               <div className="relative group">
                  <select
                    className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none focus:outline-none block w-full pl-3 pr-8 py-1.5 cursor-pointer hover:bg-gray-100 transition-colors"
                    value={filters.type}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, type: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  >
                    <option value="">全部类型</option>
                    <option value="info">系统通知</option>
                    <option value="warning">重要提醒</option>
                    <option value="error">紧急警报</option>
                    <option value="announcement">公司公告</option>
                    <option value="success">操作成功</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <FunnelIcon className="h-3 w-3" />
                  </div>
               </div>
            </div>

            {/* 右侧：清除筛选 */}
            {(filters.type || filters.isRead || quickFilter) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1"
              >
                <XMarkIcon className="w-4 h-4" />
                清除
              </button>
            )}
         </div>
      </div>

      {/* 内容列表 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
         {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent mb-3"></div>
              <span className="text-sm">加载数据中...</span>
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="p-4 bg-gray-100 rounded-full mb-3">
                 <SpeakerWaveIcon className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-medium text-gray-500">暂无广播消息</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">优先级</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">接收/已读</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发送时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {broadcasts.map((broadcast) => (
                    <tr
                      key={broadcast.id}
                      onClick={() => handleBroadcastClick(broadcast)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {!broadcast.is_read && (
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                          )}
                          <div className="text-sm font-medium text-gray-900">{broadcast.title}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColorClass(broadcast.type, 'all')}`}>
                          {getIcon(broadcast.type)}
                          <span className="ml-1">{getTypeName(broadcast.type)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-3 py-1 rounded text-sm">
                          {broadcast.priority === 'urgent' ? '紧急' :
                           broadcast.priority === 'high' ? '高' :
                           broadcast.priority === 'normal' ? '普通' :
                           broadcast.priority === 'low' ? '低' :
                           broadcast.priority || '普通'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        全体成员
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={broadcast.is_read ? "text-green-600" : "text-red-600"}>
                          {broadcast.is_read ? '已读' : '未读'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(broadcast.created_at).toLocaleString('zh-CN', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* 分页 */}
      {pagination.total > 0 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 shrink-0 flex items-center justify-between text-sm">
           <span className="text-gray-500">共 {pagination.total} 条</span>
           <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-xs"
              >
                上一页
              </button>
              <span className="text-gray-700">{pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-xs"
              >
                下一页
              </button>
           </div>
        </div>
      )}

      {/* 模态框 */}
      {showModal && selectedBroadcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
           <div
             className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
             onClick={e => e.stopPropagation()}
           >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${getColorClass(selectedBroadcast.type)}`}>
                       {getIcon(selectedBroadcast.type)}
                    </div>
                    <span className="font-semibold text-gray-900">{getTypeName(selectedBroadcast.type)}</span>
                 </div>
                 <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-5 h-5" />
                 </button>
              </div>

              <div className="p-6">
                 <h2 className="text-lg font-bold text-gray-900 mb-2">{selectedBroadcast.title}</h2>
                 <div className="text-xs text-gray-400 mb-4 flex items-center gap-4">
                    <span>{new Date(selectedBroadcast.created_at).toLocaleString('zh-CN')}</span>
                    <span className={selectedBroadcast.is_read ? 'text-green-600' : 'text-red-500'}>
                       {selectedBroadcast.is_read ? '已读' : '未读'}
                    </span>
                 </div>
                 <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {selectedBroadcast.content}
                 </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                 <button
                   onClick={() => setShowModal(false)}
                   className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
                 >
                   关闭
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
