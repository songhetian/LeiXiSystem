import React, { useState, useEffect, useRef } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import qualityAPI from '../api/qualityAPI.js'
import Modal from './Modal'
import ImportSessionModal from './ImportSessionModal'
import PlatformShopManagement from './PlatformShopManagement'
import SessionDetailModal from './SessionDetailModal'
import ConfirmDialog from './ConfirmDialog'
import '../pages/Messaging/WeChatPage.css'

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
          <div className="flex gap-3">
            <input
              type="text"
              name="search"
              placeholder="搜索会话编号/客户信息..."
              value={filters.search}
              onChange={handleFilterChange}
              className="business-input w-64"
            />
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="business-select w-40"
            >
              <option value="">全部状态</option>
              <option value="pending">待质检</option>
              <option value="completed">已完成</option>
            </select>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="business-input w-40"
            />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="business-input w-40"
            />
            <button
              onClick={() => setIsPlatformShopModalOpen(true)}
              className="business-btn business-btn-secondary"
            >
              平台店铺管理
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="business-btn business-btn-success"
            >
              导入会话
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="business-table">
            <thead>
              <tr>
                <th className="text-center">会话ID</th>
                <th className="text-center">客服</th>
                <th className="text-center">沟通渠道</th>
                <th className="text-center">平台</th>
                <th className="text-center">店铺</th>
                <th className="text-center">评分</th>
                <th className="text-center">状态</th>
                <th className="text-center">日期</th>
                <th className="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td className="font-medium">#{inspection.session_code}</td>
                    <td>{inspection.customer_service_name || inspection.agent_name || '-'}</td>
                    <td>{inspection.communication_channel || '-'}</td>
                    <td>{inspection.platform_name || '-'}</td>
                    <td>{inspection.shop_name || '-'}</td>
                    <td>
                      {inspection.score ? (
                        <span className={`font-semibold ${inspection.score >= 90 ? 'text-green-600' :
                          inspection.score >= 80 ? 'text-blue-600' :
                            inspection.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                          {inspection.score}分
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`business-badge ${inspection.quality_status === 'completed'
                        ? 'business-badge-success'
                        : 'business-badge-warning'
                        }`}>
                        {inspection.quality_status === 'completed' ? '已完成' : '待质检'}
                      </span>
                    </td>
                    <td>{formatDate(inspection.created_at)}</td>
                    <td className="text-center">
                      <div className="flex gap-2 justify-center">
                        {inspection.quality_status === 'pending' ? (
                          <button
                            onClick={() => handleInspect(inspection)}
                            className="business-btn business-btn-primary business-btn-sm"
                          >
                            开始质检
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInspect(inspection)}
                            className="business-btn business-btn-secondary business-btn-sm"
                          >
                            查看详情
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inspection.id)}
                          className="business-btn business-btn-danger business-btn-sm"
                        >
                          删除
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
