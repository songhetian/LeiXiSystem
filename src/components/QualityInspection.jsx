import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
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

  const [platforms, setPlatforms] = useState([]);
  const [shops, setShops] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    customerServiceId: '',
    status: '',
    channel: '',
    startDate: '',
    endDate: '',
    platformId: '',
    shopId: '',
  });

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: debouncedSearch }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  useEffect(() => {
    loadInspections();
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await qualityAPI.getPlatforms();
        setPlatforms(response.data.data);
      } catch (error) {
        logger.error('Error fetching platforms:', error);
      }
    };
    fetchPlatforms();
  }, []);

  useEffect(() => {
    const fetchShops = async () => {
      if (!filters.platformId) {
        setShops([]);
        return;
      }
      try {
        const response = await qualityAPI.getShopsByPlatform(filters.platformId);
        setShops(response.data.data);
      } catch (error) {
        logger.error('Error fetching shops:', error);
      }
    };
    fetchShops();
  }, [filters.platformId]);

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
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'search') {
      setDebouncedSearch(value);
    } else if (name === 'platformId') {
      setFilters({ ...filters, [name]: value, shopId: '' });
      setPagination({ ...pagination, page: 1 });
    } else {
      setFilters({ ...filters, [name]: value });
      setPagination({ ...pagination, page: 1 });
    }
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleExport = async () => {
    try {
      toast.info('正在准备导出数据...');
      const response = await qualityAPI.exportSessions(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `质检导出_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('导出成功');
    } catch (error) {
      toast.error('导出失败');
    }
  };

  const handleInspect = async (inspection) => {
    setSelectedInspection(inspection)
    try {
      const messagesResponse = await qualityAPI.getSessionMessages(inspection.id);
      setSessionMessages(messagesResponse.data.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      toast.error('加载会话消息失败');
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
      loadInspections();
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setSessionToDelete(null);
    }
  }

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none">
      {/* 极简单行顶栏 */}
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 pl-2">
            <h1 className="text-sm font-black text-gray-800 mr-2">质检中心</h1>
            <div className="relative group">
              <input
                type="text"
                name="search"
                placeholder="搜索编号/客服..."
                value={debouncedSearch}
                onChange={handleFilterChange}
                className="pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold w-44 transition-all"
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="px-3 py-1.5 bg-slate-100 border-none rounded-xl text-xs font-black text-slate-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none"
            >
              <option value="">状态: 全部</option>
              <option value="pending">待质检</option>
              <option value="completed">已完成</option>
            </select>

            <select
              name="platformId"
              value={filters.platformId}
              onChange={handleFilterChange}
              className="px-3 py-1.5 bg-slate-100 border-none rounded-xl text-xs font-black text-slate-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none"
            >
              <option value="">平台: 全部</option>
              {platforms.map(platform => (
                <option key={platform.id} value={platform.id}>{platform.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-3 py-1.5 ml-1">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="bg-transparent border-none text-[10px] focus:ring-0 p-0 cursor-pointer text-slate-500 font-black w-24"
              />
              <span className="text-slate-300 mx-1">→</span>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="bg-transparent border-none text-[10px] focus:ring-0 p-0 cursor-pointer text-slate-500 font-black w-24"
              />
            </div>
          </div>

          <div className="flex gap-2 pr-1">
            <button
              onClick={() => setIsPlatformShopModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-600 font-black py-1.5 px-4 rounded-xl text-[10px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
            >
              🏪 店铺管理
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-1.5 px-4 rounded-xl text-[10px] shadow-md shadow-indigo-100 active:scale-95 transition-all flex items-center gap-1.5"
            >
              📥 导入数据
            </button>
            <button
              onClick={handleExport}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-1.5 px-4 rounded-xl text-[10px] shadow-md shadow-emerald-100 active:scale-95 transition-all flex items-center gap-1.5"
            >
              📤 导出报表
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="py-4 px-6 text-left font-black text-slate-400 text-[10px] uppercase tracking-widest">会话编号 / 客服人员</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">平台 / 店铺</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">得分 / 等级</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">质检状态</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">日期</th>
                <th className="py-4 px-6 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-6 px-6"><div className="h-4 w-32 bg-slate-100 rounded-lg"></div></td>
                    <td className="py-6 px-4"><div className="h-4 w-24 bg-slate-100 rounded-lg mx-auto"></div></td>
                    <td className="py-6 px-4"><div className="h-6 w-10 bg-slate-100 rounded-lg mx-auto"></div></td>
                    <td className="py-6 px-4"><div className="h-4 w-16 bg-slate-100 rounded-full mx-auto"></div></td>
                    <td className="py-6 px-4"><div className="h-4 w-20 bg-slate-100 rounded-lg mx-auto"></div></td>
                    <td className="py-6 px-6"><div className="h-8 w-20 bg-slate-100 rounded-xl mx-auto"></div></td>
                  </tr>
                ))
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-20 bg-slate-50/10">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl opacity-20 grayscale">📭</span>
                      <p className="text-xs font-black tracking-tight text-slate-300 uppercase">暂无相关会话记录</p>
                    </div>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] font-black text-slate-400 uppercase tracking-tighter">#{inspection.session_code}</span>
                        <span className="font-black text-slate-700 text-xs tracking-tight">{inspection.customer_service_name || inspection.agent_name || '未分配'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase border border-indigo-100/50">
                          {inspection.platform_name || '未知平台'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 italic tracking-tight">{inspection.shop_name || '-'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {inspection.score ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-black leading-none ${inspection.score >= 90 ? 'text-emerald-500' :
                            inspection.score >= 80 ? 'text-sky-500' :
                              inspection.score >= 70 ? 'text-amber-500' : 'text-rose-500'
                            }`}>
                            {Math.round(inspection.score)}
                          </span>
                          <span className="text-[8px] font-black text-slate-300 uppercase mt-1">Grade {inspection.grade || '-'}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-200">--</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 ${inspection.quality_status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-white text-indigo-500 border-indigo-100 shadow-sm'
                        }`}>
                        {inspection.quality_status === 'completed' ? '✓ 已质检' : '○ 待处理'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-slate-400 text-[10px] font-black tabular-nums">{formatDate(inspection.created_at)}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleInspect(inspection)}
                          className={`text-[10px] font-black px-5 py-2 rounded-xl transition-all active:scale-95 uppercase tracking-wider ${
                            inspection.quality_status === 'pending'
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {inspection.quality_status === 'pending' ? '开始质检' : '查看记录'}
                        </button>
                        <button
                          onClick={() => handleDelete(inspection.id)}
                          className="text-slate-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all active:scale-90"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

        {/* 分页控制 */}
        <div className="py-4 px-8 border-t border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            共计 <span className="text-indigo-600">{pagination.total}</span> 条会话记录
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 disabled:opacity-20 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-[11px] font-black text-slate-600 min-w-[4rem] text-center tracking-tighter">
              第 {pagination.page} 页 / 共 {pagination.totalPages || 1} 页
            </div>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 disabled:opacity-20 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
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
          loadInspections();
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
