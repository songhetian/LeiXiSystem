import React, { useState, useEffect, useMemo, memo } from 'react';
import { toast } from 'sonner';
import api from '@/api';
import { getAttachmentUrl } from '../utils/fileUtils';
import { formatDate } from '../utils/date';
import Win11ContextMenu from './Win11ContextMenu';
import FilePreviewModal from './FilePreviewModal';
import logger from '@/utils/logger';
import { 
    ChevronLeft, 
    ChevronRight, 
    FolderPlus, 
    FilePlus, 
    Globe, 
    Lock, 
    Trash2, 
    Move, 
    CheckCircle2,
    X,
    Search,
    Download,
    Star,
    AlertCircle,
    Archive,
    FolderTree,
    FolderCheck,
    Clock,
    Users,
    ShieldCheck,
    TrendingUp
} from 'lucide-react';
import { Select, ConfigProvider, Empty, Button, Spin } from 'antd';

// --- 辅助工具：稳健提取文件后缀 (过滤 OSS 参数) ---
const getFileExt = (path) => {
  if (!path) return '';
  const cleanPath = path.split('?')[0].split('#')[0];
  const parts = cleanPath.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

// --- 1. 高清图标组件 ---
const FolderIcon = ({ isUncat, isPublic, mode }) => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 14C6 11.7909 7.79086 10 10 10H24.5858C25.6467 10 26.6641 10.4214 27.4142 11.1716L32.8284 16.5858C33.5786 17.3359 34.5959 17.7574 35.6569 17.7574H54C56.2091 17.7574 58 19.5665 58 21.7756V50C58 52.2091 56.2091 54 54 54H10C7.79086 54 6 52.2091 6 50V14Z" fill={`url(#f_grad_${isUncat?'uncat':(mode==='personal'?'priv':'pub')})`} />
    {isUncat && <path d="M32 25V40M25 32H39" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.6" />}
    {mode === 'personal' && !isUncat && <path d="M44 30c-2.2 0-4 1.8-4 4v4h-2v10h12V38h-2v-4c0-2.2-1.8-4-4-4zm2 8h-4v-4c0-1.1.9-2 2-2s2 .9 2 2v4z" fill="white" opacity="0.9" />}
    <defs>
      <linearGradient id="f_grad_pub" x1="6" y1="10" x2="58" y2="54"><stop offset="0" stopColor="#4FACFE" /><stop offset="1" stopColor="#0052D4" /></linearGradient>
      <linearGradient id="f_grad_priv" x1="6" y1="10" x2="58" y2="54"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
      <linearGradient id="f_grad_uncat" x1="6" y1="10" x2="58" y2="54"><stop offset="0" stopColor="#A1C4FD" /><stop offset="1" stopColor="#C2E9FB" /></linearGradient>
    </defs>
  </svg>
);

const FileIcon = ({ ext, isNote }) => {
  if (isNote) {
    return (
      <div className="relative w-10 h-12 bg-amber-50 border-2 border-amber-200 rounded-lg flex items-center justify-center shadow-sm">
        <div className="absolute top-0 right-0 w-3 h-3 bg-amber-200" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}></div>
        <span className="text-[10px] font-black text-amber-600">NOTE</span>
      </div>
    );
  }
  const typeConfigs = {
    pdf: { color: '#FF5252', label: 'PDF' },
    doc: { color: '#2B579A', label: 'DOC' }, docx: { color: '#2B579A', label: 'DOCX' },
    xls: { color: '#217346', label: 'XLS' }, xlsx: { color: '#217346', label: 'XLSX' },
    ppt: { color: '#D24726', label: 'PPT' }, pptx: { color: '#D24726', label: 'PPTX' },
    txt: { color: '#607D8B', label: 'TXT' }, md: { color: '#000', label: 'MD' },
    jpg: { color: '#FF9800', label: 'JPG' }, jpeg: { color: '#FF9800', label: 'JPEG' },
    png: { color: '#E91E63', label: 'PNG' }, gif: { color: '#9C27B0', label: 'GIF' },
    mp4: { color: '#673AB7', label: 'MP4' }, zip: { color: '#FBBC05', label: 'ZIP' },
    rar: { color: '#FBBC05', label: 'RAR' }
  };
  const conf = typeConfigs[ext] || { color: '#4FACFE', label: ext ? ext.toUpperCase() : 'FILE' };
  return (
    <div className="relative w-10 h-12 bg-white border-2 rounded-lg flex items-center justify-center shadow-sm" style={{ borderColor: conf.color }}>
      <div className="absolute top-0 right-0 w-3 h-3" style={{ background: `linear-gradient(225deg, transparent 50%, ${conf.color} 50%)` }}></div>
      <span className="text-[7px] font-black" style={{ color: conf.color }}>{conf.label}</span>
    </div>
  );
};

const parseAttachments = (raw) => {
  if (!raw) return [];
  let current = raw;
  try {
    while (typeof current === 'string' && current.length > 2) {
      const parsed = JSON.parse(current);
      if (typeof parsed === 'string' && parsed === current) break;
      current = parsed;
    }
  } catch (e) {
    if (typeof current === 'string' && (current.startsWith('http') || current.startsWith('/upload'))) {
      return [{ url: current, name: current.split('/').pop() || 'file' }];
    }
  }
  if (Array.isArray(current)) {
    return current.map(item => {
      if (typeof item === 'string') return { url: item, name: item.split('/').pop() };
      const url = item.url || item.path || item.file_url || '';
      return { url: url, name: item.name || item.filename || url.split('?')[0].split('/').pop() || '未命名附件' };
    }).filter(i => i.url);
  }
  if (current && typeof current === 'object') {
    const url = current.url || current.path || current.file_url || '';
    if (url) return [{ url, name: current.name || current.filename || url.split('?')[0].split('/').pop() || '附件' }];
  }
  return [];
};

const ArticleCard = memo(({ article, isSelected, onToggle, onContextMenu, onPreview, index, mode, isSavedToPersonal }) => {
  const rawAttachments = article.attachments || article.attachment || article.file_url || '[]';
  const attachments = useMemo(() => parseAttachments(rawAttachments), [rawAttachments]);
  const isNote = attachments.length === 0;
  const fileName = attachments[0]?.name || '';
  const ext = getFileExt(fileName || attachments[0]?.url);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onPreview(article); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, 'file', article); }}
      className={`relative bg-white p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center group z-10 ${isSelected ? 'border-blue-500 bg-blue-50/30 shadow-lg scale-[0.98]' : 'border-transparent shadow-sm hover:border-slate-200'}`}
    >
      <div 
        onClick={(e) => { e.stopPropagation(); onToggle(e, article.id, index); }}
        className={`absolute top-3 left-3 w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center z-20 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 opacity-0 group-hover:opacity-100'}`}
      >
        {isSelected && '✓'}
      </div>
      
      {mode === 'public' && isSavedToPersonal && (
        <div className="absolute top-3 right-3 bg-amber-400 text-white p-1 rounded-full shadow-lg z-30 scale-90">
            <Star size={10} fill="currentColor" />
        </div>
      )}

      {mode === 'management' && (
        <div className={`absolute top-3 right-3 text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${article.is_public ? 'bg-emerald-500 text-white':'bg-blue-500 text-white'}`}>
          {!article.is_public && <span className="scale-75">🔒</span>}{article.is_public ? '公开':'草稿'}
        </div>
      )}

      <div className="mt-4 mb-3 transform transition-transform group-hover:scale-105">
        {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) && attachments[0]?.url ? (
          <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border-2 border-white bg-slate-50">
            <img src={getAttachmentUrl(attachments[0].url)} className="w-full h-full object-cover" alt="" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '🖼️'; }} />
          </div>
        ) : (
          <FileIcon ext={ext} isNote={isNote} />
        )}
      </div>
      <h3 className="text-[11px] font-bold text-slate-800 line-clamp-2 h-8 leading-tight mb-1 text-center">{article.title}</h3>
    </div>
  );
});

const Win11KnowledgeFolderView = ({ viewMode = 'public' }) => {
  const [articles, setArticles] = useState([]);
  const [personalArticles, setPersonalArticles] = useState([]);
  const [personalCategories, setPersonalCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolderCategory, setCurrentFolderCategory] = useState(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [saveToModal, setSaveToModal] = useState({ visible: false, targets: [], selectedCatId: undefined, availableCategories: [] });
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [articleFormData, setArticleFormData] = useState({ title: '', content: '', attachments: [], mode: 'file' });
  const [editingArticle, setEditingArticle] = useState(null);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: '', data: null });
  const [uploading, setUploading] = useState(false);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || currentUser?.userId || currentUser?.ID;
  const canManage = viewMode === 'personal' || viewMode === 'management';

  const config = useMemo(() => {
    const modeConfigs = {
        public: { title: '公共知识库', icon: '🌐', theme: 'emerald', label: '全员共享·只读' },
        personal: { title: '我的知识库', icon: '⭐', theme: 'blue', label: '个人专属·私密' },
        management: { title: '知识库管理', icon: '🛠️', theme: 'indigo', label: '知识维护·创作' }
    };
    return modeConfigs[viewMode] || modeConfigs.public;
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(debouncedSearchTerm); setCurrentPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearchTerm]);

  const fetchPersonalResources = async () => {
    if (!currentUserId) return { articles: [], categories: [] };
    try {
        const [resA, resC] = await Promise.all([
            api.get(`/my-knowledge/articles?userId=${currentUserId}`),
            api.get(`/my-knowledge/categories?userId=${currentUserId}`)
        ]);
        const allA = Array.isArray(resA.data) ? resA.data : (resA.data?.data || []);
        const allC = Array.isArray(resC.data) ? resC.data : (resC.data?.data || []);
        setPersonalArticles(allA);
        setPersonalCategories(allC);
        return { articles: allA, categories: allC };
    } catch(e) { return { articles: [], categories: [] }; }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/knowledge/categories`);
      const rawData = res.data?.data || res.data || [];
      const allCats = Array.isArray(rawData) ? rawData : [];
      setCategories(allCats.filter(c => {
        if (!c || parseInt(c.is_deleted) === 1) return false;
        const ownerMatch = parseInt(c.owner_id || 0) === parseInt(currentUserId || 0);
        const type = c.type || 'common';
        if (viewMode === 'public') return type === 'common' && parseInt(c.is_public) === 1;
        if (viewMode === 'management') return type === 'common' && ownerMatch;
        if (viewMode === 'personal') return type === 'personal' && ownerMatch;
        return false;
      }));
    } catch(e) { setCategories([]); }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/knowledge/articles');
      const rawData = res.data?.data || res.data || [];
      const allArticles = Array.isArray(rawData) ? rawData : [];
      setArticles(allArticles.filter(a => {
        if (!a || parseInt(a.is_deleted) === 1) return false;
        const ownerMatch = parseInt(a.owner_id || a.userId || 0) === parseInt(currentUserId || 0);
        const type = a.type || 'common';
        if (viewMode === 'public') return type === 'common' && parseInt(a.is_public) === 1;
        if (viewMode === 'management') return type === 'common' && ownerMatch;
        if (viewMode === 'personal') return type === 'personal' && ownerMatch;
        return false;
      }));
    } catch(e) { setArticles([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    const loadAll = async () => {
        setCurrentFolderCategory(null);
        setSelectedArticleIds([]);
        await Promise.all([fetchCategories(), fetchArticles(), fetchPersonalResources()]);
    };
    loadAll();
  }, [viewMode, currentUserId]);

  const handleOpenSaveToModal = async (targets) => {
    const latest = await fetchPersonalResources();
    setSaveToModal({ visible: true, targets, selectedCatId: undefined, availableCategories: latest.categories });
  };

  const handleExecuteSaveToPersonal = async () => {
    const { targets, selectedCatId } = saveToModal;
    if (targets.length === 0) return;
    try {
        setLoading(true);
        await Promise.all(targets.map(item => api.post('/knowledge/articles', {
            title: item.title, content: item.content, 
            attachments: typeof item.attachments === 'string' ? item.attachments : JSON.stringify(item.attachments || []),
            type: 'personal', owner_id: currentUserId, is_public: 0, status: 'published',
            category_id: selectedCatId || null
        })));
        toast.success(`成功存入“我的知识库” ${targets.length} 篇文档`);
        setSaveToModal({visible:false, targets:[], selectedCatId: undefined, availableCategories: []});
        setSelectedArticleIds([]);
        fetchPersonalResources();
    } catch(e) { toast.error('转存失败'); }
    finally { setLoading(false); }
  };

  const handleMoveArticles = async (tid) => {
    try {
      setLoading(true);
      await Promise.all(selectedArticleIds.map(id => api.put(`/knowledge/articles/${id}`, { ...articles.find(a => a.id === id), category_id: tid })));
      toast.success('移动成功');
      setSelectedArticleIds([]);
      setIsMoveMenuOpen(false);
      fetchArticles();
    } catch(e) { toast.error('移动失败'); }
    finally { setLoading(false); }
  };

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (currentFolderCategory) {
      if (currentFolderCategory.id === 'uncategorized') result = result.filter(a => !a.category_id);
      else result = result.filter(a => parseInt(a.category_id) === parseInt(currentFolderCategory.id));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(a => (a.title || '').toLowerCase().includes(lower) || (a.content || '').toLowerCase().includes(lower));
    }
    return result;
  }, [articles, currentFolderCategory, searchTerm]);

  const totalPages = Math.ceil(filteredArticles.length / pageSize);
  const currentArticles = useMemo(() => filteredArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredArticles, currentPage, pageSize]);

  const handlePreview = (article) => {
    if (!article) return;
    const raw = article.attachments || article.attachment || article.file_url || '[]';
    const atts = parseAttachments(raw);
    if (atts.length > 0) {
      const f = atts[0];
      const url = f.url || f.path || '';
      const ext = getFileExt(f.name || f.filename || url);
      const finalUrl = getAttachmentUrl(url);
      const directly = ['pdf','jpg','jpeg','png','gif','webp','mp4','webm','ogg','mp3','wav','txt','md'];
      if (directly.includes(ext)) setPreviewData({ ...article, url: finalUrl, ext, mode: 'direct' });
      else { toast.info('正在下载...'); window.open(finalUrl); }
    } else { setPreviewData({ ...article, url: null, ext: 'md', mode: 'note' }); }
  };

  const handleContextMenu = (e, type, data) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, data }); };

  const handleUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/upload?bizType=knowledge', formData);
        if (res.data.url) uploaded.push({ name: file.name, url: res.data.url, type: file.type, size: file.size });
      }
      setArticleFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
      toast.success('上传成功');
    } catch(e) { toast.error('上传失败'); }
    finally { setUploading(false); }
  };

  const handleSaveArticle = async () => {
    if (!articleFormData.title.trim()) return toast.error('标题必填');
    setLoading(true);
    try {
      const payload = { 
        title: articleFormData.title, content: articleFormData.content || '',
        category_id: currentFolderCategory?.id === 'uncategorized' ? null : (currentFolderCategory?.id || null),
        type: viewMode === 'personal' ? 'personal' : 'common',
        is_public: 0, owner_id: currentUserId, status: 'published',
        attachments: JSON.stringify(articleFormData.attachments || [])
      };
      if (editingArticle) await api.put(`/knowledge/articles/${editingArticle.id}`, payload);
      else await api.post('/knowledge/articles', payload);
      setShowArticleModal(false); fetchArticles(); fetchPersonalResources(); toast.success('保存成功');
    } finally { setLoading(false); }
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none text-left" onContextMenu={e => handleContextMenu(e, 'background', null)}>
      {/* 顶部工具栏 */}
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            {currentFolderCategory && <button onClick={() => setCurrentFolderCategory(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 font-bold transition-all">←</button>}
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-gray-800 flex items-center gap-2"><span>{config.icon}</span>{currentFolderCategory ? currentFolderCategory.name : config.title}</h1>
              {!currentFolderCategory && <span className={`text-[8px] font-black uppercase tracking-tighter text-blue-500`}>{config.label}</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative group"><input type="text" placeholder="快速检索..." value={debouncedSearchTerm} onChange={e => setDebouncedSearchTerm(e.target.value)} className="w-40 px-8 py-1.5 bg-slate-100 border-none rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-bold transition-all" /><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" /></div>
            {canManage && (
              <>
                {!currentFolderCategory ? <button onClick={() => { setEditingCategory(null); setNewCategoryName(''); setShowCreateCategoryModal(true); }} className="bg-white border border-slate-200 text-slate-600 text-[10px] font-black px-4 py-1.5 rounded-xl hover:bg-slate-50 transition-all active:scale-95">+ 创建分类</button>
                : <button onClick={() => { setEditingArticle(null); setArticleFormData({title:'', content:'', attachments:[], mode:'file'}); setShowArticleModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-4 py-1.5 rounded-xl shadow-md active:scale-95 transition-all">+ 新建文档</button>}
              </>
            )}
          </div>
        </div>

        {selectedArticleIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 flex items-center gap-2"><CheckCircle2 size={12} /> 已选 {selectedArticleIds.length} 篇文档</span><button onClick={() => setSelectedArticleIds([])} className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-2 transition-colors">取消选择</button></div>
            <div className="flex gap-2 relative">
              {viewMode === 'public' && <button onClick={() => handleOpenSaveToModal(articles.filter(a => selectedArticleIds.includes(a.id)))} className="text-[10px] font-black px-4 py-1.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 border border-amber-100 flex items-center gap-1.5 shadow-sm"><Star size={12} fill="currentColor" /> 批量存入我的库</button>}
              {canManage && (
                <div className="flex gap-2 relative">
                    <div className="relative"><button onClick={() => setIsMoveMenuOpen(!isMoveMenuOpen)} className="text-[10px] font-black px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex items-center gap-1.5 shadow-sm"><Move size={12} /> 批量移动 ▾</button>
                    {isMoveMenuOpen && <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-[100] max-h-60 overflow-y-auto">{categories.map(c => <button key={c.id} onClick={() => handleMoveArticles(c.id)} className="w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 text-slate-600 flex items-center gap-2 truncate">📁 {c.name}</button>)}</div>}</div>
                    <button onClick={async () => { if(confirm('确认批量删除选中内容？')){ await Promise.all(selectedArticleIds.map(id=>api.delete(`/knowledge/articles/${id}`))); fetchArticles(); fetchPersonalResources(); setSelectedArticleIds([]); } }} className="text-[10px] font-black px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center gap-1.5"><Trash2 size={12} /> 批量删除</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 内容网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 px-2">
        {!currentFolderCategory ? (
          <>
            {categories.map(cat => (<div key={cat.id} onClick={() => setCurrentFolderCategory(cat)} onContextMenu={e => handleContextMenu(e, 'folder', cat)} className="bg-white p-6 rounded-2xl border border-transparent shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer flex flex-col items-center group relative z-10"><FolderIcon isPublic={cat.is_public} mode={viewMode} /><h3 className="text-xs font-black text-slate-700 truncate w-full text-center mt-3">{cat.name}</h3><div className={`mt-2 text-[8px] font-black px-2 py-0.5 rounded-full ${viewMode === 'personal' ? 'text-indigo-600 bg-indigo-50/50' : (cat.is_public?'text-emerald-500 bg-emerald-50':'text-indigo-500 bg-indigo-50')}`}>{viewMode === 'personal' ? '个人专属' : (cat.is_public ? '全员公开':'内部存证')}</div></div>))}
            <div onClick={() => setCurrentFolderCategory({id:'uncategorized', name:'未分类区域'})} className="bg-white p-6 rounded-2xl border border-transparent shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col items-center group opacity-80 z-10"><FolderIcon isUncat={true} /><h3 className="text-xs font-black text-slate-500 truncate w-full text-center mt-3">未分类区域</h3></div>
          </>
        ) : (
          currentArticles.map((a, i) => (<ArticleCard key={a.id} article={a} index={i} mode={viewMode} isSelected={selectedArticleIds.includes(a.id)} isSavedToPersonal={personalArticles.some(p => p.title === a.title)} onToggle={(e, id, idx)=>{e.stopPropagation(); setSelectedArticleIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev, id]); }} onContextMenu={handleContextMenu} onPreview={handlePreview} />))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-4 py-4"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-20 transition-all hover:bg-slate-50">←</button><span className="text-[10px] font-black text-slate-400">{currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-20 transition-all hover:bg-slate-50">→</button></div>
      )}

      {/* 弹窗组件 */}
      {saveToModal.visible && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined, availableCategories: []})}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-lg"><Archive size={20} /></div>
                        <div><h3 className="text-sm font-black text-slate-800">转存到个人库</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">选中 {saveToModal.targets.length} 篇文档</p></div>
                    </div>
                    <button onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined, availableCategories: []})} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><FolderTree size={10} /> 目标分类位置</label>
                        <Select showSearch allowClear placeholder="搜索个人库分类（留空存入根目录）" className="w-full h-11 font-bold text-slate-700 flagship-select" value={saveToModal.selectedCatId} onChange={val => setSaveToModal(prev => ({...prev, selectedCatId: val}))}
                            options={[ { label: '📁 [ 存入根目录 / 未分类 ]', value: null }, ...saveToModal.availableCategories.map(c => ({ label: `📁 ${c.name}`, value: c.id, searchName: c.name })) ]}
                            filterOption={(input, option) => (option?.searchName || option?.label || '').toLowerCase().includes(input.toLowerCase())}
                        />
                    </div>
                </div>
                <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3"><button onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined, availableCategories: []})} className="px-6 py-2.5 text-xs font-black text-slate-400">取消</button><button onClick={handleExecuteSaveToPersonal} className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2">{loading ? <Spin size="small" /> : <CheckCircle2 size={14} />} 确认转存</button></div>
            </div>
        </div>
      )}

      {showArticleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={()=>setShowArticleModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FilePlus size={18} /></div><div><h3 className="font-black text-slate-800">{editingArticle?'修改内容':'新建文档'}</h3><p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">雷犀内容创作中心</p></div></div>
                <button onClick={()=>setShowArticleModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit mx-auto mb-4"><button onClick={() => setArticleFormData(p => ({...p, mode: 'text'}))} className={`px-6 py-2 rounded-lg text-[11px] font-black transition-all ${articleFormData.mode === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>📝 笔记</button><button onClick={() => setArticleFormData(p => ({...p, mode: 'file'}))} className={`px-6 py-2 rounded-lg text-[11px] font-black transition-all ${articleFormData.mode === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>📎 附件</button></div>
                <input type="text" value={articleFormData.title} onChange={e=>setArticleFormData({...articleFormData, title:e.target.value})} placeholder="标题..." className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl font-bold focus:ring-2 focus:ring-blue-500 text-lg shadow-inner" />
                {articleFormData.mode === 'text' ? (<textarea rows={8} value={articleFormData.content} onChange={e=>setArticleFormData({...articleFormData, content:e.target.value})} placeholder="内容..." className="w-full px-5 py-4 bg-slate-50 border-none rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-medium shadow-inner" />) : (<div className="space-y-4"><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); handleUpload(e.dataTransfer.files);}} className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-blue-400 cursor-pointer relative bg-slate-50/50 transition-colors shadow-inner"><input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>handleUpload(e.target.files)} /><div className="text-4xl mb-3">☁️</div><p className="text-xs font-black text-slate-500">{uploading?'正在上传...':'拖拽文件到此处'}</p></div>{articleFormData.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {articleFormData.attachments.map((f, i) => (
                            <div key={i} className="bg-blue-50 p-2 rounded-lg text-[10px] font-black text-blue-600 flex items-center gap-3 border border-blue-100 shadow-sm">
                              <span className="max-w-[120px] truncate">{f.name}</span>
                              <button onClick={()=>setArticleFormData({...articleFormData, attachments: articleFormData.attachments.filter((_,idx)=>idx!==i)})} className="hover:text-red-500 transition-colors">✕</button>
                            </div>
                        ))}
                      </div>
                    )}</div>)}
            </div>
            <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3"><button onClick={handleSaveArticle} className="px-12 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg transition-all active:scale-95">确认保存</button></div>
          </div>
        </div>
      )}

      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={()=>setShowCreateCategoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-black text-gray-800 mb-4">{editingCategory?'重命名分类':'新建分类'}</h3>
            <input autoFocus type="text" value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="名称..." className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-bold" />
            <div className="flex gap-4 mt-6"><button onClick={()=>setShowCreateCategoryModal(false)} className="flex-1 py-2.5 text-xs font-black text-slate-400">取消</button><button 
                onClick={async () => { 
                  try { 
                    if (editingCategory) await api.put(`/knowledge/categories/${editingCategory.id}`, { name: newCategoryName }); 
                    else await api.post('/knowledge/categories', { name: newCategoryName, icon: '📁', type: viewMode === 'personal' ? 'personal' : 'common', is_public: 0, owner_id: currentUserId }); 
                    toast.success('操作成功'); setShowCreateCategoryModal(false); fetchCategories();
                  } catch(e){ toast.error('失败'); } 
                }} 
                className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg active:scale-95">确认</button></div>
          </div>
        </div>
      )}

      {previewData && <FilePreviewModal file={previewData} onClose={()=>setPreviewData(null)} />}
      <Win11ContextMenu x={contextMenu.x} y={contextMenu.y} visible={contextMenu.visible} onClose={()=>setContextMenu({...contextMenu, visible:false})} items={contextMenu.type==='folder' ? [{ icon: '📂', label: '打开目录', action: () => setCurrentFolderCategory(contextMenu.data) },{ icon: '✏️', label: '重命名', action: () => { setEditingCategory(contextMenu.data); setNewCategoryName(contextMenu.data.name); setShowCreateCategoryModal(true); } },{ icon: '🗑️', label: '彻底删除', action: () => { if(confirm('确认删除分类吗？')) { api.delete(`/knowledge/categories/${contextMenu.data.id}`).then(()=>fetchCategories()); setContextMenu({ ...contextMenu, visible: false }); } } }] : [{ icon: '👁️', label: '查看详情', action: () => handlePreview(contextMenu.data) },{ icon: '✏️', label: '修改内容', action: () => { setEditingArticle(contextMenu.data); const atts = parseAttachments(contextMenu.data.attachments); setArticleFormData({title:contextMenu.data.title, content:contextMenu.data.content, attachments:atts, mode: atts.length > 0 ? 'file' : 'text'}); setShowArticleModal(true); } },{ icon: '⭐', label: '存入个人库', action: () => handleOpenSaveToModal([contextMenu.data]) },{ icon: '🗑️', label: viewMode === 'personal' ? '取消收藏' : '彻底删除', action: () => { if(confirm('确认执行此操作？')) { api.delete(`/knowledge/articles/${contextMenu.data.id}`).then(()=>{ fetchArticles(); fetchPersonalResources(); }); setContextMenu({ ...contextMenu, visible: false }); } } }]} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .flagship-select .ant-select-selector { border-radius: 12px !important; border: none !important; background: #f8fafc !important; height: 44px !important; padding: 0 16px !important; font-weight: 900 !important; }
        .flagship-select .ant-select-selection-placeholder { line-height: 44px !important; font-weight: bold !important; color: #94a3b8 !important; }
        .flagship-select .ant-select-selection-item { line-height: 44px !important; font-weight: 900 !important; color: #1e293b !important; }
      `}} />
    </div>
    </ConfigProvider>
  );
};

export default Win11KnowledgeFolderView;
