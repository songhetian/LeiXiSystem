import React, { useState, useEffect, useRef } from 'react'
// --- 性能优化巡检标识 ---
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI.js'
import Modal from './Modal'
import ImportSessionModal from './ImportSessionModal'
import PlatformShopManagement from './PlatformShopManagement'
import SessionDetailModal from './SessionDetailModal'
import ConfirmDialog from './ConfirmDialog'

const QualityInspection = () => {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPlatformShopModalOpen, setIsPlatformShopModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [sessionMessages, setSessionMessages] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const chatHistoryRef = useRef(null);
  const [filters, setFilters] = useState({
    search: '',
    customerServiceId: '',
    status: '',
    channel: '',
    startDate: '',
    endDate: '',
  });

  const shouldShowTimestamp = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentTime = new Date(currentMsg.sent_at).getTime();
    const prevTime = new Date(prevMsg.sent_at).getTime();
    return (currentTime - prevTime) / 1000 / 60 > 5;
  };

  useEffect(() => {
    loadInspections();
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [sessionMessages]);

  const loadInspections = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getAllSessions({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
      });
      setInspections(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('加载质检列表失败');
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPagination({ ...pagination, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleInspect = async (inspection) => {
    setSelectedInspection(inspection)
    try {
      const messagesResponse = await qualityAPI.getSessionMessages(inspection.id);
      setSessionMessages(messagesResponse.data.data);
      setIsDetailModalOpen(true); // Open the new modal
    } catch (error) {
      toast.error('加载会话消息失败');
      console.error('Error loading session messages:', error);
      setSessionMessages([]);
    }
  }

  const handleDelete = (sessionId) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  }

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await qualityAPI.deleteSession(sessionToDelete);
      toast.success('删除成功');
      loadInspections(); // Refresh the list
    } catch (error) {
      toast.error('删除失败: ' + (error.response?.data?.message || error.message));
      console.error('Error deleting session:', error);
    } finally {
      setSessionToDelete(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header">
          <div>
            <h2 className="business-card-title">质检管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {pagination.total} 条质检记录</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative group">
              <input
                type="text"
                name="search"
                placeholder="搜索编号/客服/客户..."
                value={filters.search}
                onChange={handleFilterChange}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64 shadow-sm group-hover:border-gray-300"
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-40 shadow-sm hover:border-gray-300 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
            >
              <option value="">全部质检状态</option>
              <option value="pending">⏳ 待处理</option>
              <option value="completed">✅ 已完成</option>
            </select>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 shadow-sm hover:border-gray-300 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">From</span>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="bg-transparent border-none text-xs focus:ring-0 p-1 cursor-pointer text-gray-600 font-bold"
              />
              <span className="text-gray-300">|</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To</span>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="bg-transparent border-none text-xs focus:ring-0 p-1 cursor-pointer text-gray-600 font-bold"
              />
            </div>

            <button
              onClick={() => setIsPlatformShopModalOpen(true)}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-2 px-4 rounded-xl text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <span>🏪 平台店铺</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center gap-2"
            >
              <span>📥 导入会话</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="business-table w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50/80">
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">会话编号</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">客服人员</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">渠道</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">所属平台</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">店铺信息</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">质检得分</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">当前状态</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">导入日期</th>
                <th style={{ textAlign: 'center' }} className="py-4 px-4 font-black text-gray-500 text-[10px] uppercase tracking-widest border-b border-gray-100">操作</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-20 text-gray-400 bg-gray-50/10">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl opacity-10">📭</span>
                      <p className="text-sm font-bold tracking-tight text-gray-300">暂无质检记录</p>
                    </div>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} className="group hover:bg-indigo-50/20 transition-all duration-300">
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      <span className="font-mono text-[10px] font-black text-gray-400 bg-white border border-gray-100 px-2 py-1 rounded shadow-sm">
                        #{inspection.session_code}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-800 text-sm">
                          {inspection.customer_service_name || inspection.agent_name || '-'}
                        </span>
                        {inspection.external_agent_id && (
                          <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                            外部客服
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50 text-gray-500 font-medium text-xs">
                      {inspection.communication_channel || '聊天'}
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase">
                        {inspection.platform_name || '-'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50 text-gray-400 text-xs italic">
                      {inspection.shop_name || '-'}
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      {inspection.score ? (
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-xl font-black leading-none drop-shadow-sm ${inspection.score >= 90 ? 'text-emerald-500' :
                            inspection.score >= 80 ? 'text-sky-500' :
                              inspection.score >= 70 ? 'text-amber-500' : 'text-rose-500'
                            }`}>
                            {inspection.score}
                          </span>
                          <span className="text-[9px] font-black text-gray-300 mt-1 uppercase tracking-widest">分</span>
                        </div>
                      ) : (
                        <div className="w-8 h-1 bg-gray-100 rounded-full mx-auto" />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${inspection.quality_status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                        }`}>
                        {inspection.quality_status === 'completed' ? '已质检' : '待处理'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50 text-gray-400 text-[10px] font-bold">
                      {formatDate(inspection.created_at)}
                    </td>
                    <td style={{ textAlign: 'center' }} className="py-5 px-4 border-b border-gray-50">
                      <div className="flex gap-2 justify-center">
                        {inspection.quality_status === 'pending' ? (
                          <button
                            onClick={() => handleInspect(inspection)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 uppercase tracking-wider"
                          >
                            开始质检
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInspect(inspection)}
                            className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 uppercase tracking-wider"
                          >
                            详情
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inspection.id)}
                          className="text-rose-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-all active:scale-90"
                          title="删除记录"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  显示第 <span className="font-medium">{(pagination.page - 1) * pagination.pageSize + 1}</span> 到{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> 条，
                  共 <span className="font-medium">{pagination.total}</span> 条记录
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">上一页</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {(() => {
                    const pages = [];
                    const maxVisible = 7;
                    let startPage = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
                    let endPage = Math.min(pagination.totalPages, startPage + maxVisible - 1);

                    if (endPage - startPage < maxVisible - 1) {
                      startPage = Math.max(1, endPage - maxVisible + 1);
                    }

                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => handlePageChange(1)}
                          className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                        >
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pages.push(
                          <span key="ellipsis1" className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                            ...
                          </span>
                        );
                      }
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${pagination.page === i
                            ? 'z-10 bg-primary-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                            }`}
                        >
                          {i}
                        </button>
                      );
                    }

                    if (endPage < pagination.totalPages) {
                      if (endPage < pagination.totalPages - 1) {
                        pages.push(
                          <span key="ellipsis2" className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                            ...
                          </span>
                        );
                      }
                      pages.push(
                        <button
                          key={pagination.totalPages}
                          onClick={() => handlePageChange(pagination.totalPages)}
                          className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                        >
                          {pagination.totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">下一页</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImportSessionModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadInspections}
      />

      <Modal isOpen={isPlatformShopModalOpen} onClose={() => setIsPlatformShopModalOpen(false)} title="平台店铺管理" size="large">
        <PlatformShopManagement />
      </Modal>

      <SessionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          loadInspections(); // Refresh list after closing in case of changes
        }}
        session={selectedInspection}
        initialMessages={sessionMessages}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="确认删除"
        message="确定要删除这条质检记录吗？此操作不可恢复。"
        confirmText="删除"
        cancelText="取消"
        type="danger"
      />
    </div>
  )
}

export default QualityInspection
