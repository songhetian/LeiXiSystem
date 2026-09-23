import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
    Search, 
    Filter, 
    ArrowUpDown, 
    Trash2, 
    Undo2, 
    Download, 
    Star, 
    MoreHorizontal,
    FolderOpen,
    Tag,
    Clock,
    X,
    ChevronLeft,
    ChevronRight,
    Library
} from 'lucide-react';
import qualityAPI from '../api/qualityAPI.js';
import Modal from '../components/Modal';
import SessionDetailModal from '../components/SessionDetailModal';
import { Select, ConfigProvider } from 'antd';

const CaseLibraryPage = () => {
  const [cases, setCases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    caseId: null,
    caseTitle: '',
    type: 'soft' 
  });

  const [viewMode, setViewMode] = useState('active'); 
  const [recycleBinPagination, setRecycleBinPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const currentUserId = 1;

  useEffect(() => {
    if (viewMode === 'active') {
      loadCases();
    } else {
      loadRecycleBin();
    }
    loadCategories();
  }, [filters, pagination.page, viewMode, recycleBinPagination.page]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getAllCases({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: filters.search,
        category: filters.category,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });
      setCases(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('加载案例库失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRecycleBin = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getRecycleBinCases({
        page: recycleBinPagination.page,
        pageSize: recycleBinPagination.pageSize,
        search: filters.search,
        category: filters.category,
      });
      setCases(response.data.data || []);
      setRecycleBinPagination(response.data.pagination);
    } catch (error) {
      toast.error('加载回收站失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await qualityAPI.getCaseCategories();
      setCategories(response.data.data || []);
    } catch (error) {}
  };

  const handleFavoriteToggle = async (caseId, isFavorited) => {
    try {
      if (isFavorited) {
        await qualityAPI.removeFavoriteCase(caseId, currentUserId);
        toast.success('已取消收藏');
      } else {
        await qualityAPI.addFavoriteCase(caseId, currentUserId);
        toast.success('收藏成功');
      }
      loadCases();
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleExportCases = async () => {
    try {
      const response = await qualityAPI.exportCases();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `案例库_${new Date().toLocaleDateString()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('导出成功');
    } catch (error) {
      toast.error('导出失败');
    }
  };

  const handleViewCaseSession = async (caseItem) => {
    if (!caseItem.session_id) {
      toast.warning('该案例没有关联会话');
      return;
    }
    try {
      const sessionResponse = await qualityAPI.getSessionDetail(caseItem.session_id);
      const messagesResponse = await qualityAPI.getSessionMessages(caseItem.session_id);
      setSelectedSession(sessionResponse.data.data);
      setSessionMessages(messagesResponse.data.data || []);
      setShowSessionDetail(true);
    } catch (error) {
      toast.error('加载会话详情失败');
    }
  };

  const handleRestoreCase = async (caseId) => {
    try {
      await qualityAPI.restoreCase(caseId);
      toast.success('案例已恢复');
      loadRecycleBin();
    } catch (error) {
      toast.error('恢复失败');
    }
  };

  const confirmDelete = async () => {
    try {
      if (deleteModal.type === 'soft') {
        await qualityAPI.deleteCase(deleteModal.caseId);
        toast.success('案例已移至回收站');
        loadCases();
      } else {
        await qualityAPI.permanentDeleteCase(deleteModal.caseId);
        toast.success('案例已永久删除');
        loadRecycleBin();
      }
      setDeleteModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      toast.error('操作失败');
    }
  };

  return (
    <ConfigProvider theme={{
        token: {
            colorPrimary: '#2563eb',
            borderRadius: 8,
        }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none">
      {/* 极简单行顶栏 */}
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <Library size={18} />
            </div>
            <div className="flex flex-col">
                <h1 className="text-sm font-black text-slate-800">{viewMode === 'active' ? '案例库' : '案例回收站'}</h1>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {viewMode === 'active' ? `共计 ${pagination.total} 项案例` : `回收站管理`}
                </span>
            </div>
            
            <div className="h-6 w-px bg-slate-100 mx-2" />

            <div className="relative group">
              <input
                type="text"
                placeholder="搜索标题或内容..."
                value={filters.search}
                onChange={e => { setFilters({...filters, search: e.target.value}); setPagination({...pagination, page:1}); }}
                className="pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-xl text-xs font-bold w-48 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            <Select
                placeholder="全部分类"
                variant="borderless"
                className="bg-slate-100 rounded-xl text-xs font-bold h-8 min-w-[120px]"
                value={filters.category || undefined}
                onChange={val => { setFilters({...filters, category: val || ''}); setPagination({...pagination, page:1}); }}
                allowClear
                options={categories.filter(c => c.is_active).map(c => ({ label: c.name, value: c.name }))}
            />

            <Select
                placeholder="排序规则"
                variant="borderless"
                className="bg-slate-100 rounded-xl text-xs font-bold h-8 min-w-[100px]"
                value={filters.sortBy}
                onChange={val => setFilters({...filters, sortBy: val})}
                options={[
                    { label: '最新发布', value: 'created_at' },
                    { label: '最高热度', value: 'view_count' },
                    { label: '最多点赞', value: 'like_count' }
                ]}
            />
          </div>

          <div className="flex gap-2 pr-1">
            <button
              onClick={() => setViewMode(viewMode === 'active' ? 'recycle' : 'active')}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 ${viewMode === 'recycle' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {viewMode === 'recycle' ? <Undo2 size={14} /> : <Trash2 size={14} />}
              {viewMode === 'recycle' ? '返回案例库' : '回收站'}
            </button>
            <button
              onClick={handleExportCases}
              className="bg-white border border-slate-200 text-slate-600 font-black py-1.5 px-4 rounded-xl text-[10px] hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <Download size={14} /> 导出数据
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse space-y-3">
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-12 w-full bg-slate-50 rounded-lg" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
            </div>
          ))
        ) : cases.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-slate-100 flex flex-col items-center gap-4 text-slate-300">
            <FolderOpen size={64} strokeWidth={1} className="opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest">暂无案例数据</p>
          </div>
        ) : (
          cases.map((item) => (
            <div
              key={item.id}
              onClick={() => viewMode === 'active' && handleViewCaseSession(item)}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-xl hover:border-blue-500/30 transition-all group cursor-pointer flex flex-col h-full relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
                {viewMode === 'active' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleFavoriteToggle(item.id, item.isFavorited); }}
                        className={`p-1.5 rounded-lg transition-all ${item.isFavorited ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                    >
                        <Star size={16} fill={item.isFavorited ? "currentColor" : "none"} />
                    </button>
                )}
              </div>

              <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed mb-4 flex-grow font-medium">
                {item.problem || item.description || '暂无详细描述'}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black uppercase">
                    <FolderOpen size={10} /> {item.category}
                </div>
                {item.tags && Array.isArray(item.tags) && item.tags.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md text-[9px] font-black uppercase border border-slate-100">
                        <Tag size={10} /> {t.name || t}
                    </div>
                ))}
              </div>

              {/* 操作浮层 */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 duration-300">
                {viewMode === 'active' ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, caseId: item.id, caseTitle: item.title, type: 'soft' }); }}
                        className="p-1.5 bg-white shadow-lg rounded-lg text-slate-400 hover:text-red-500 border border-slate-50 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                ) : (
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRestoreCase(item.id); }}
                            className="p-1.5 bg-white shadow-lg rounded-lg text-emerald-500 hover:bg-emerald-50 border border-slate-50"
                        >
                            <Undo2 size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, caseId: item.id, caseTitle: item.title, type: 'permanent' }); }}
                            className="p-1.5 bg-white shadow-lg rounded-lg text-red-500 hover:bg-red-50 border border-slate-50"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {((viewMode === 'active' && pagination.totalPages > 1) || (viewMode === 'recycle' && recycleBinPagination.totalPages > 1)) && (
        <div className="mt-10 flex justify-center items-center gap-6">
          <button
            onClick={() => viewMode === 'active' ? setPagination({...pagination, page: pagination.page - 1}) : setRecycleBinPagination({...recycleBinPagination, page: recycleBinPagination.page - 1})}
            disabled={viewMode === 'active' ? pagination.page === 1 : recycleBinPagination.page === 1}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-slate-600">
                页码 {viewMode === 'active' ? pagination.page : recycleBinPagination.page} / {viewMode === 'active' ? pagination.totalPages : recycleBinPagination.totalPages}
            </span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                共发现 {viewMode === 'active' ? pagination.total : recycleBinPagination.total} 项匹配案例
            </span>
          </div>

          <button
            onClick={() => viewMode === 'active' ? setPagination({...pagination, page: pagination.page + 1}) : setRecycleBinPagination({...recycleBinPagination, page: recycleBinPagination.page + 1})}
            disabled={viewMode === 'active' ? pagination.page === pagination.totalPages : recycleBinPagination.page === recycleBinPagination.totalPages}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm disabled:opacity-20 transition-all"
          >
            <ChevronRight size={20} className="text-slate-600" />
          </button>
        </div>
      )}

      {/* Session Detail Modal */}
      {showSessionDetail && selectedSession && (
        <SessionDetailModal
          isOpen={showSessionDetail}
          onClose={() => setShowSessionDetail(false)}
          session={selectedSession}
          initialMessages={sessionMessages}
          readOnly={true}
        />
      )}

      {/* 修正后的确认弹窗 */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setDeleteModal({...deleteModal, isOpen: false})}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-50">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        {deleteModal.type === 'soft' ? <Trash2 size={16} className="text-slate-400" /> : <X size={16} className="text-red-500" />}
                        {deleteModal.type === 'soft' ? '移至回收站' : '永久彻底删除'}
                    </h3>
                </div>
                <div className="p-6">
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                        您确定要{deleteModal.type === 'soft' ? '将该案例移至回收站' : '永久删除该案例及其所有数据'}吗？
                    </p>
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl text-[11px] font-black text-slate-700 border border-slate-100 italic">
                        "{deleteModal.caseTitle}"
                    </div>
                </div>
                <div className="p-4 bg-slate-50/50 flex justify-end gap-2">
                    <button onClick={() => setDeleteModal({...deleteModal, isOpen: false})} className="px-4 py-2 text-xs font-black text-slate-400 hover:text-slate-600">取消操作</button>
                    <button onClick={confirmDelete} className={`px-6 py-2 rounded-xl text-xs font-black text-white shadow-lg ${deleteModal.type === 'soft' ? 'bg-slate-800' : 'bg-red-600'}`}>确认执行</button>
                </div>
            </div>
        </div>
      )}
    </div>
    </ConfigProvider>
  );
};

export default CaseLibraryPage;
