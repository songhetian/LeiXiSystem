import React, { useState, useEffect, useMemo, memo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { getAttachmentUrl } from '../utils/fileUtils';
import { formatDate } from '../utils/date';
import Win11ContextMenu from './Win11ContextMenu';
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
  // --- 深度脱壳逻辑 ---
  // 如果是字符串，不断尝试解析，直到它不再是字符串或解析失败
  try {
    while (typeof current === 'string' && current.length > 2) {
      const parsed = JSON.parse(current);
      if (typeof parsed === 'string' && parsed === current) break; // 防止死循环
      current = parsed;
    }
  } catch (e) {
    // 如果解析失败，检查是否是原始 URL
    if (typeof current === 'string' && (current.startsWith('http') || current.startsWith('/upload'))) {
      return [{ url: current, name: current.split('/').pop() || 'file' }];
    }
  }

  // --- 统一转为标准数组格式 ---
  if (Array.isArray(current)) {
    return current.map(item => {
      if (typeof item === 'string') return { url: item, name: item.split('/').pop() };
      const url = item.url || item.path || item.file_url || '';
      return {
        url: url,
        name: item.name || item.filename || url.split('/').pop() || '未命名附件'
      };
    }).filter(i => i.url);
  }
  
  if (current && typeof current === 'object') {
    const url = current.url || current.path || current.file_url || '';
    if (url) return [{ url, name: current.name || current.filename || url.split('/').pop() || '附件' }];
  }

  return [];
};

const ArticleCard = memo(({ article, isSelected, onToggle, onContextMenu, onPreview, index, mode, isSavedToPersonal }) => {
  // 探测所有可能的附件字段名
  const rawAttachments = article.attachments || article.attachment || article.file_url || article.path || article.files || article.url || '[]';
  const attachments = useMemo(() => parseAttachments(rawAttachments), [rawAttachments]);
  const isNote = attachments.length === 0;
  const fileName = attachments[0]?.name || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onPreview(article); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, 'file', article); }}
      className={`relative bg-white p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center group z-10 ${isSelected ? 'border-blue-500 bg-blue-50/30 shadow-lg scale-[0.98]' : 'border-transparent shadow-sm hover:border-slate-200'}`}
    >
      {/* 只有点击勾选框才触发选择，增加 e.stopPropagation() 防止触发预览 */}
      <div 
        onClick={(e) => { e.stopPropagation(); onToggle(e, article.id, index); }}
        className={`absolute top-3 left-3 w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center z-20 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 opacity-0 group-hover:opacity-100'}`}
      >
        {isSelected && '✓'}
      </div>
      
      {isSavedToPersonal && (
        <div className="absolute top-3 right-3 bg-amber-400 text-white p-1 rounded-full shadow-lg z-30 scale-90">
            <Star size={10} fill="currentColor" />
        </div>
      )}

      {mode !== 'personal' && !isSavedToPersonal && (
        <div className={`absolute top-3 right-3 text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${article.is_public ? 'bg-emerald-500 text-white':'bg-blue-500 text-white'}`}>
          {!article.is_public && <span className="scale-75">🔒</span>}{article.is_public ? '公开':'草稿'}
        </div>
      )}

      <div className="mt-4 mb-3 transform transition-transform group-hover:scale-105">
        {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) && attachments[0]?.url ? (
          <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border-2 border-white bg-slate-50">
            <img 
              src={getAttachmentUrl(attachments[0].url)} 
              className="w-full h-full object-cover" 
              alt=""
              onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '🖼️'; }}
            />
          </div>
        ) : (
          <FileIcon ext={ext} isNote={isNote} />
        )}
      </div>
      <h3 className="text-[11px] font-bold text-slate-800 line-clamp-2 h-8 leading-tight mb-1 text-center">{article.title}</h3>
    </div>
  );
});

// --- 4. 主视图组件 ---
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
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);

  // --- 分页与过滤逻辑 ---
  const filteredArticles = useMemo(() => {
    let result = articles;
    if (currentFolderCategory) {
      if (currentFolderCategory.id === 'uncategorized') {
        result = result.filter(a => !a.category_id);
      } else {
        result = result.filter(a => a.category_id === currentFolderCategory.id);
      }
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.title?.toLowerCase().includes(lower) || 
        (a.content && a.content.toLowerCase().includes(lower))
      );
    }
    return result;
  }, [articles, currentFolderCategory, searchTerm]);

  const totalPages = Math.ceil(filteredArticles.length / pageSize);
  
  const currentArticles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredArticles.slice(start, start + pageSize);
  }, [filteredArticles, currentPage, pageSize]);

  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null, isDanger: false });
  // 收藏弹窗增强：增加 selectedCatId 状态
  const [saveToModal, setSaveToModal] = useState({ visible: false, targets: [], selectedCatId: undefined });

  const config = useMemo(() => {
    const modeConfigs = {
        public: { title: '公共知识库', icon: '🌐', theme: 'emerald', label: '全员共享·只读' },
        personal: { title: '我的知识库', icon: '⭐', theme: 'blue', label: '个人专属·私密' },
        management: { title: '知识库管理', icon: '🛠️', theme: 'indigo', label: '知识维护·创作' }
    };
    return modeConfigs[viewMode] || modeConfigs.public;
  }, [viewMode]);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const canManage = viewMode === 'personal' || viewMode === 'management';

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

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(debouncedSearchTerm); setCurrentPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearchTerm]);

  useEffect(() => { 
    const loadAllData = async () => {
        setCurrentFolderCategory(null);
        setSelectedArticleIds([]);
        try {
            await Promise.all([
                fetchCategories(), 
                fetchArticles(), 
                fetchPersonalResources()
            ]);
        } catch (e) {
            console.error('Initial data load failed:', e);
        }
    };
    loadAllData();
  }, [viewMode]);

  const fetchPersonalResources = async () => {
    if (!currentUser?.id) {
        console.warn('No currentUser.id found, skipping personal resources fetch');
        return;
    }
    try {
        const [resA, resC] = await Promise.all([
            axios.get(getApiUrl(`/api/my-knowledge/articles?userId=${currentUser.id}`)),
            axios.get(getApiUrl(`/api/my-knowledge/categories?userId=${currentUser.id}`))
        ]);
        
        const allA = resA.data.data || resA.data || [];
        const allC = resC.data.data || resC.data || [];
        
        setPersonalArticles(allA);
        setPersonalCategories(allC);
        
        // 如果当前是个人模式，同步到主列表
        if (viewMode === 'personal') {
            setArticles(allA);
            setCategories(allC);
        }
    } catch(e) {
        console.error('Failed to fetch personal resources:', e);
    }
  };

  const fetchCategories = async () => {
    if (viewMode === 'personal') return; // 由 fetchPersonalResources 处理
    try {
      const res = await axios.get(getApiUrl(`/api/knowledge/categories`));
      const allCats = res.data.data || res.data || [];
      setCategories(allCats.filter(c => {
        if (c.is_deleted == 1 || c.deleted_at != null) return false;
        const ownerMatch = parseInt(c.owner_id) === parseInt(currentUser?.id);
        if (viewMode === 'public') return c.type === 'common' && parseInt(c.is_public) === 1;
        if (viewMode === 'management') return c.type === 'common' && ownerMatch;
        return false;
      }));
    } catch(e) { toast.error('分类加载失败'); }
  };

  const fetchArticles = async () => {
    if (viewMode === 'personal') return; // 由 fetchPersonalResources 处理
    setLoading(true);
    try {
      const res = await axios.get(getApiUrl('/api/knowledge/articles'));
      const allArticles = res.data.data || res.data || [];
      setArticles(allArticles.filter(a => {
        if (a.is_deleted == 1 || a.deleted_at != null) return false;
        const ownerMatch = parseInt(a.owner_id) === parseInt(currentUser?.id);
        if (viewMode === 'public') return a.type === 'common' && parseInt(a.is_public) === 1;
        if (viewMode === 'management') return a.type === 'common' && ownerMatch;
        return false;
      }));
    } catch(e) { toast.error('文档加载失败'); }
    finally { setLoading(false); }
  };

  // --- 收藏到个人库逻辑 (加固排重) ---
  const handleOpenSaveToModal = async (targets) => {
    await fetchPersonalResources(); // 实时同步个人分类列表
    
    // 排重检查
    const alreadySaved = targets.filter(t => personalArticles.some(p => p.title === t.title));
    if (alreadySaved.length === targets.length) {
        return toast.info('所选文档均已在个人知识库中，无需重复收藏');
    }
    const filteredTargets = targets.filter(t => !personalArticles.some(p => p.title === t.title));
    if (alreadySaved.length > 0) {
        toast.info(`已自动过滤 ${alreadySaved.length} 篇已收藏文档`);
    }
    setSaveToModal({ visible: true, targets: filteredTargets, selectedCatId: undefined });
  };

  const handleExecuteSaveToPersonal = async () => {
    const { targets, selectedCatId } = saveToModal;
    if (targets.length === 0) return;
    try {
        setLoading(true);
        await Promise.all(targets.map(item => {
            return axios.post(getApiUrl('/api/knowledge/articles'), {
                title: item.title, content: item.content, attachments: item.attachments,
                type: 'personal', owner_id: currentUser?.id, is_public: 0, status: 'published',
                category_id: selectedCatId || null
            });
        }));
        toast.success(`成功存入“我的知识库” ${targets.length} 篇文档`);
        setSaveToModal({ visible: false, targets: [], selectedCatId: undefined });
        setSelectedArticleIds([]);
        fetchPersonalResources();
    } catch(e) { toast.error('转存失败'); }
    finally { setLoading(false); }
  };

  const handleBatchVisibility = async (isPub) => {
    try {
      setLoading(true);
      await Promise.all(selectedArticleIds.map(id => axios.put(getApiUrl(`/api/knowledge/articles/${id}`), { ...articles.find(a=>a.id===id), is_public: isPub })));
      toast.success('批量更新成功');
      setSelectedArticleIds([]);
      await fetchArticles();
    } catch(e) { toast.error('失败'); }
    finally { setLoading(false); }
  };

  const handleBatchDelete = async () => {
    const isPersonalMode = viewMode === 'personal';
    setConfirmModal({
        visible: true,
        title: isPersonalMode ? '批量取消收藏' : '批量删除确认',
        message: isPersonalMode ? `确定从您的个人库中移除选中的 ${selectedArticleIds.length} 篇文档吗？` : `确定彻底删除选中的 ${selectedArticleIds.length} 篇文档吗？此操作无法撤销。`,
        isDanger: true,
        onConfirm: async () => {
            try {
                setLoading(true);
                await Promise.all(selectedArticleIds.map(id => axios.delete(getApiUrl(`/api/knowledge/articles/${id}`))));
                toast.success(isPersonalMode ? '批量取消成功' : '批量删除成功');
                setSelectedArticleIds([]);
                await fetchArticles();
                await fetchPersonalResources();
            } catch(e) { toast.error('操作失败'); }
            finally { setLoading(false); setConfirmModal(prev => ({ ...prev, visible: false })); }
        }
    });
  };

  const handleMoveArticles = async (tid) => {
    try {
      setLoading(true);
      await Promise.all(selectedArticleIds.map(id => axios.put(getApiUrl(`/api/knowledge/articles/${id}`), { ...articles.find(a=>a.id===id), category_id: tid })));
      toast.success('移动成功');
      setSelectedArticleIds([]);
      setIsMoveMenuOpen(false);
      await fetchArticles();
    } catch(e) { toast.error('失败'); }
    finally { setLoading(false); }
  };

  const handleUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(getApiUrl('/upload?bizType=knowledge'), formData, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (res.data.url) uploaded.push({ name: file.name, url: res.data.url, type: file.type, size: file.size });
      }
      setArticleFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
      toast.success('上传成功');
    } catch(e) { toast.error('失败'); }
    finally { setUploading(false); }
  };

  const handleSaveArticle = async () => {
    if (!articleFormData.title.trim()) return toast.error('标题必填');
    setLoading(true);
    try {
      const payload = { 
        title: articleFormData.title,
        // 修改点：不再强行清空，如果上传了附件也保留描述，或者如果写了笔记也保留附件
        content: articleFormData.content || '',
        category_id: currentFolderCategory?.id === 'uncategorized' ? null : (currentFolderCategory?.id || null),
        type: viewMode === 'personal' ? 'personal' : 'common',
        is_public: 0, owner_id: currentUser?.id, status: 'published',
        // 修改点：无论当前是哪个 mode，只要 attachments 数组里有东西就存进去
        attachments: JSON.stringify(articleFormData.attachments || [])
      };
      if (editingArticle) await axios.put(getApiUrl(`/api/knowledge/articles/${editingArticle.id}`), payload);
      else await axios.post(getApiUrl('/api/knowledge/articles'), payload);
      setShowArticleModal(false); await fetchArticles(); await fetchPersonalResources(); toast.success('保存成功');
    } finally { setLoading(false); }
  };

  const handlePreview = (article) => {
    const rawAttachments = article.attachments || article.attachment || article.file_url || article.path || article.files || article.url || '[]';
    const atts = parseAttachments(rawAttachments);

    if (atts.length > 0) {
      const f = atts[0]; 
      const fileName = f.name || '';
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      const finalUrl = getAttachmentUrl(f.url);
      
      // 仅保留浏览器能直接显示的格式
      const directlyPreviewable = ['pdf','jpg','jpeg','png','gif','webp','mp4','webm','ogg','mp3','wav','txt','md'];
      
      if (directlyPreviewable.includes(ext)) {
        setPreviewData({ ...article, url: finalUrl, ext, mode: 'direct' });
      } else {
        // 其他所有格式（Office, Zip 等）点击直接下载
        const link = document.createElement('a');
        link.href = finalUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.info(`正在下载: ${fileName}`);
      }
    } else {
      // 笔记模式：没有附件，直接显示正文内容
      setPreviewData({ ...article, url: null, ext: 'md', mode: 'note' });
    }
  };

  const handleContextMenu = (e, type, data) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, data }); };

  const deleteSingleArticle = async (id) => {
    try {
        setLoading(true);
        await axios.delete(getApiUrl(`/api/knowledge/articles/${id}`));
        toast.success(viewMode === 'personal' ? '已取消收藏' : '已彻底删除');
        await fetchArticles();
        await fetchPersonalResources();
    } catch(e) { toast.error('操作失败'); }
    finally { setLoading(false); setConfirmModal(prev => ({ ...prev, visible: false })); }
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 8 } }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none" onContextMenu={e => handleContextMenu(e, 'background', null)}>
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            {currentFolderCategory && <button onClick={(e) => { e.stopPropagation(); setCurrentFolderCategory(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 font-bold transition-all">←</button>}
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-gray-800 flex items-center gap-2"><span>{config.icon}</span>{currentFolderCategory ? currentFolderCategory.name : config.title}</h1>
              {!currentFolderCategory && <span className={`text-[8px] font-black uppercase tracking-tighter text-${config.theme}-500`}>{config.label}</span>}
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
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between px-2 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 flex items-center gap-2"><CheckCircle2 size={12} /> 已选 {selectedArticleIds.length} 篇文档</span><button onClick={() => setSelectedArticleIds([])} className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-2 transition-colors">取消选择</button></div>
            <div className="flex gap-2 relative">
              {viewMode === 'public' && <button onClick={() => handleOpenSaveToModal(articles.filter(a => selectedArticleIds.includes(a.id)))} className="text-[10px] font-black px-4 py-1.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 border border-amber-100 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"><Star size={12} fill="currentColor" /> 批量存入我的库</button>}
              {canManage && (
                <>
                    {viewMode === 'management' && <><button onClick={() => handleBatchVisibility(1)} className="text-[10px] font-black px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-all active:scale-95 flex items-center gap-1.5"><Globe size={12} /> 一键公开</button><button onClick={() => handleBatchVisibility(0)} className="text-[10px] font-black px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5"><Lock size={12} /> 设为私密</button></>}
                    <div className="relative"><button onClick={() => setIsMoveMenuOpen(!isMoveMenuOpen)} className="text-[10px] font-black px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-100 transition-all active:scale-95 flex items-center gap-1.5"><Move size={12} /> 批量移动 ▾</button>
                    {isMoveMenuOpen && <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-[100] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95"><button onClick={() => handleMoveArticles(null)} className="w-full text-left px-4 py-2 text-[11px] hover:bg-blue-50 font-bold text-blue-600 border-b border-slate-50 flex items-center gap-2">📁 移至根目录</button>{categories.map(c => <button key={c.id} onClick={() => handleMoveArticles(c.id)} className="w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 text-slate-600 flex items-center gap-2 truncate">{c.is_public?'🌐':'🔒'} {c.name}</button>)}</div>}</div>
                    <button onClick={handleBatchDelete} className="text-[10px] font-black px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 border border-rose-100 transition-all active:scale-95 flex items-center gap-1.5"><Trash2 size={12} /> {viewMode === 'personal' ? '一键取消' : '一键删除'}</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 px-2">
        {!currentFolderCategory ? (
          <>
            {categories.map(cat => (<div key={cat.id} onClick={(e) => { e.stopPropagation(); setCurrentFolderCategory(cat); }} onContextMenu={e => handleContextMenu(e, 'folder', cat)} className="bg-white p-6 rounded-2xl border border-transparent shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer flex flex-col items-center group relative z-10"><FolderIcon isUncat={false} isPublic={cat.is_public} mode={viewMode} /><h3 className="text-xs font-black text-slate-700 truncate w-full text-center mt-3">{cat.name}</h3><div className={`mt-2 text-[8px] font-black px-2 py-0.5 rounded-full ${viewMode === 'personal' ? 'text-indigo-600 bg-indigo-50/50' : (cat.is_public?'text-emerald-500 bg-emerald-50':'text-indigo-500 bg-indigo-50')}`}>{viewMode === 'personal' ? '个人专属' : (cat.is_public ? '全员公开':'内部草稿')}</div></div>))}
            <div onClick={(e) => { e.stopPropagation(); setCurrentFolderCategory({id:'uncategorized', name:'未分类'}); }} className="bg-white p-6 rounded-2xl border border-transparent shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col items-center group opacity-80 z-10"><FolderIcon isUncat={true} /><h3 className="text-xs font-black text-slate-500 truncate w-full text-center mt-3">未分类区域</h3></div>
          </>
        ) : (
          currentArticles.map((a, i) => (<ArticleCard key={a.id} article={a} index={i} mode={viewMode} isSelected={selectedArticleIds.includes(a.id)} isSavedToPersonal={personalArticles.some(p => p.title === a.title)} onToggle={(e, id, idx)=>{e.stopPropagation(); if(e.shiftKey && lastSelectedIndex!==null){const start=Math.min(lastSelectedIndex, idx); const end=Math.max(lastSelectedIndex, idx); setSelectedArticleIds([...new Set([...selectedArticleIds, ...currentArticles.slice(start, end+1).map(x=>x.id)])]);} else { setSelectedArticleIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev, id]); setLastSelectedIndex(idx); }}} onContextMenu={handleContextMenu} onPreview={handlePreview} />))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-4 py-4"><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-20 transition-all hover:bg-slate-50">←</button><span className="text-[10px] font-black text-slate-400">{currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm disabled:opacity-20 transition-all hover:bg-slate-50">→</button></div>
      )}

      <Win11ContextMenu x={contextMenu.x} y={contextMenu.y} visible={contextMenu.visible} onClose={()=>setContextMenu({...contextMenu, visible:false})}
        items={contextMenu.type==='folder' ? (canManage ? [{ icon: '📂', label: '打开目录', action: () => setCurrentFolderCategory(contextMenu.data) },{ icon: '✏️', label: '重命名', action: () => { setEditingCategory(contextMenu.data); setNewCategoryName(contextMenu.data.name); setShowCreateCategoryModal(true); } },...(viewMode === 'management' ? [{ icon: '🌐', label: contextMenu.data?.is_public?'设为私有':'设为公开', action: async () => { await axios.put(getApiUrl(`/api/knowledge/categories/${contextMenu.data.id}`), { is_public: contextMenu.data.is_public?0:1 }); fetchCategories(); } }] : []),{ icon: '🗑️', label: '彻底删除', action: () => setConfirmModal({ visible: true, title: '删除分类确认', message: '确认彻底删除该分类及其所有文档吗？', isDanger: true, onConfirm: async () => { await axios.delete(getApiUrl(`/api/knowledge/categories/${contextMenu.data.id}`)); fetchCategories(); setConfirmModal(prev => ({ ...prev, visible: false })); } }) }] : [{ icon: '📂', label: '打开内容', action: () => setCurrentFolderCategory(contextMenu.data) }]) : contextMenu.type==='file' ? (viewMode === 'public' ? [{ icon: '👁️', label: '极速预览', action: () => handlePreview(contextMenu.data) },{ icon: '⭐', label: '存入个人库', action: () => handleOpenSaveToModal([contextMenu.data]) }] : [{ icon: '👁️', label: '详情预览', action: () => handlePreview(contextMenu.data) },{ icon: '✏️', label: '修改内容', action: () => { setEditingArticle(contextMenu.data); const atts = parseAttachments(contextMenu.data.attachments); setArticleFormData({title:contextMenu.data.title, content:contextMenu.data.content, attachments:atts, mode: atts.length > 0 ? 'file' : 'text'}); setShowArticleModal(true); } },...(viewMode === 'management' ? [{ icon: '🌐', label: contextMenu.data?.is_public?'撤回私密':'设为公开', action: async () => { await axios.put(getApiUrl(`/api/knowledge/articles/${contextMenu.data.id}`), { ...contextMenu.data, is_public: contextMenu.data.is_public?0:1, status:'published' }); fetchArticles(); } }] : []),{ icon: '🗑️', label: viewMode === 'personal' ? '取消收藏' : '彻底删除', action: () => setConfirmModal({ visible: true, title: viewMode === 'personal' ? '取消收藏确认' : '彻底删除确认', message: viewMode === 'personal' ? '确认从您的个人收藏库中移除此文档吗？' : '确认彻底删除该文档吗？此操作无法撤销。', isDanger: true, onConfirm: () => deleteSingleArticle(contextMenu.data.id) }) }]) : (canManage ? [{ icon: '📁', label: '新建分类', action: () => setShowCreateCategoryModal(true) },{ icon: '📄', label: '新建文档', action: () => setShowArticleModal(true) }] : [])}
      />

      {confirmModal.visible && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={()=>setConfirmModal({...confirmModal, visible:false})}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e=>e.stopPropagation()}>
                <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmModal.isDanger?'bg-rose-50 text-rose-600':'bg-blue-50 text-blue-600'}`}><AlertCircle size={20} /></div>
                    <h3 className="text-sm font-black text-slate-800">{confirmModal.title}</h3>
                </div>
                <div className="p-6"><p className="text-xs font-bold text-slate-500 leading-relaxed">{confirmModal.message}</p></div>
                <div className="p-4 bg-slate-50/50 flex justify-end gap-2">
                    <button onClick={()=>setConfirmModal({...confirmModal, visible:false})} className="px-4 py-2 text-xs font-black text-slate-400 hover:text-slate-600">放弃</button>
                    <button onClick={confirmModal.onConfirm} className={`px-6 py-2 rounded-xl text-xs font-black text-white shadow-lg transition-all active:scale-95 ${confirmModal.isDanger?'bg-rose-600 shadow-rose-100':'bg-blue-600 shadow-blue-100'}`}>确认执行</button>
                </div>
            </div>
        </div>
      )}

      {/* 收藏分类选择弹窗 - 重构为搜索下拉框模式 */}
      {saveToModal.visible && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined})}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-lg shadow-amber-100"><Archive size={20} /></div>
                        <div className="flex flex-col">
                            <h3 className="text-sm font-black text-slate-800">收藏到个人档案库</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">选中 {saveToModal.targets.length} 篇文档</p>
                        </div>
                    </div>
                    <button onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined})} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <FolderTree size={10} /> 目标分类位置
                        </label>
                        <Select 
                            showSearch
                            allowClear
                            placeholder="搜索或选择存放分类（留空存入未分类）"
                            className="w-full h-11 font-bold text-slate-700 custom-win11-select"
                            value={saveToModal.selectedCatId}
                            onChange={val => setSaveToModal(prev => ({...prev, selectedCatId: val}))}
                            options={[
                                { label: '📁 [ 存入根目录 / 未分类 ]', value: null },
                                ...personalCategories.map(c => ({ label: `📁 ${c.name}`, value: c.id }))
                            ]}
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        />
                    </div>

                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3 animate-in slide-in-from-bottom-1">
                        <FolderCheck size={16} className="text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-[11px] font-black text-blue-700 leading-none mb-1">自动同步就绪</p>
                            <p className="text-[9px] font-bold text-blue-600/70 leading-relaxed">系统将自动保持文档内容同步，您可以随时在个人库中取消收藏。</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3">
                    <button onClick={()=>setSaveToModal({visible:false, targets:[], selectedCatId: undefined})} className="px-6 py-2.5 text-xs font-black text-slate-400">取消</button>
                    <button 
                        onClick={handleExecuteSaveToPersonal}
                        className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? <Spin size="small" /> : <CheckCircle2 size={14} />} 确认转存
                    </button>
                </div>
            </div>
        </div>
      )}

      {showArticleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={()=>setShowArticleModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e=>e.stopPropagation()}>
            <div className="p-6 border-b border-slate-50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FilePlus size={18} /></div><div><h3 className="font-black text-slate-800">{editingArticle?'修改内容':'新建文档'}</h3><p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">雷犀生产力内容创作中心</p></div></div><button onClick={()=>setShowArticleModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-all"><X size={20} /></button></div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]"><div className="flex bg-slate-100 p-1 rounded-xl w-fit mx-auto mb-4"><button onClick={() => setArticleFormData(p => ({...p, mode: 'text'}))} className={`px-6 py-2 rounded-lg text-[11px] font-black transition-all ${articleFormData.mode === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>📝 笔记</button><button onClick={() => setArticleFormData(p => ({...p, mode: 'file'}))} className={`px-6 py-2 rounded-lg text-[11px] font-black transition-all ${articleFormData.mode === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>📎 附件</button></div><input type="text" value={articleFormData.title} onChange={e=>setArticleFormData({...articleFormData, title:e.target.value})} placeholder="在此输入标题..." className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl font-bold focus:ring-2 focus:ring-blue-500 text-lg" />{articleFormData.mode === 'text' ? (<textarea rows={8} value={articleFormData.content} onChange={e=>setArticleFormData({...articleFormData, content:e.target.value})} placeholder="在此编写正文内容..." className="w-full px-5 py-4 bg-slate-50 border-none rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-medium" />) : (<div className="space-y-4"><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); handleUpload(e.dataTransfer.files);}} className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-blue-400 cursor-pointer relative bg-slate-50/50 transition-colors"><input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>handleUpload(e.target.files)} /><div className="text-4xl mb-3">☁️</div><p className="text-xs font-black text-slate-500">{uploading?'正在上传...':'拖拽文件到此处'}</p></div>{articleFormData.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {articleFormData.attachments.map((f, i) => {
                          const isImg = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
                          return (
                            <div key={i} className="bg-blue-50 p-2 rounded-lg text-[10px] font-black text-blue-600 flex items-center gap-3 border border-blue-100 shadow-sm group">
                              {isImg && f.url && (
                                <img src={getAttachmentUrl(f.url)} className="w-8 h-8 object-cover rounded-md shadow-sm border border-white" alt="" />
                              )}
                              <span className="max-w-[120px] truncate">{f.name}</span>
                              <button onClick={()=>setArticleFormData({...articleFormData, attachments: articleFormData.attachments.filter((_,idx)=>idx!==i)})} className="hover:text-red-500 transition-colors w-5 h-5 flex items-center justify-center bg-white/50 rounded-full">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}</div>)}</div>
            <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3"><button onClick={handleSaveArticle} className="px-12 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95">确认保存</button></div>
          </div>
        </div>
      )}

      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={()=>setShowCreateCategoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-black text-gray-800 mb-4">{editingCategory?'重命名分类':'新建分类'}</h3>
            <input autoFocus type="text" value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="名称..." className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-bold" />
            <div className="flex gap-2 mt-6"><button onClick={()=>setShowCreateCategoryModal(false)} className="flex-1 py-2.5 text-xs font-black text-slate-400">取消</button><button onClick={async () => { try { if (editingCategory) await axios.put(getApiUrl(`/api/knowledge/categories/${editingCategory.id}`), { name: newCategoryName }); else await axios.post(getApiUrl('/api/knowledge/categories'), { name: newCategoryName, icon: '📁', type: viewMode === 'personal' ? 'personal' : 'common', is_public: 0, owner_id: currentUser?.id }); toast.success('操作成功'); setShowCreateCategoryModal(false); fetchCategories(); } catch(e){ toast.error('失败'); } }} className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg active:scale-95">确认</button></div>
          </div>
        </div>
      )}

      {previewData && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[5000] flex flex-col animate-in fade-in duration-500" onClick={() => setPreviewData(null)}>
          {/* --- 旗舰级玻璃拟态顶栏 --- */}
          <header className="px-8 py-6 flex justify-between items-center bg-white/5 border-b border-white/10 backdrop-blur-md sticky top-0 z-[5001]">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                {previewData.ext === 'pdf' ? <FilePlus className="text-white" size={28} /> : <Archive className="text-white" size={28} />}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {previewData.title}
                </h2>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.1em]">
                  <span className="px-2 py-0.5 bg-blue-500 text-white rounded-md">{previewData.ext || 'NOTE'}</span>
                  <span className="text-white/40 flex items-center gap-1.5"><Clock size={12} /> {formatDate(previewData.created_at)}</span>
                  <span className="text-white/40 flex items-center gap-1.5"><Users size={12} /> {previewData.owner_name || '雷犀系统'}</span>
                  <span className="text-emerald-400 flex items-center gap-1.5"><ShieldCheck size={12} /> 安全预览中</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {previewData.url && (
                <a 
                  href={previewData.url} 
                  download 
                  onClick={e => e.stopPropagation()}
                  className="h-12 px-6 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center gap-2 font-black text-xs transition-all border border-white/10 active:scale-95 shadow-xl"
                >
                  <Download size={16} /> 极速下载原件
                </a>
              )}
              <button 
                onClick={()=>setPreviewData(null)} 
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-lg shadow-rose-500/20 active:scale-90"
              >
                <X size={24} />
              </button>
            </div>
          </header>

          {/* --- 内容渲染核心区 --- */}
          <main className="flex-1 overflow-hidden flex items-center justify-center p-8" onClick={e => e.stopPropagation()}>
            <div className="w-full h-full max-w-7xl bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center relative group">
              {previewData.mode === 'office' ? (
                <div className="w-full h-full flex flex-col">
                  <div className="bg-emerald-500/20 px-4 py-2 text-[10px] text-emerald-200 font-bold flex justify-between items-center backdrop-blur-md">
                    <span className="flex items-center gap-2"><TrendingUp size={12} /> 正在通过雷犀高性能云引擎加载 Office 文档...</span>
                  </div>
                  <iframe src={previewData.url} className="w-full h-full border-none bg-white shadow-inner" />
                </div>
              ) : previewData.url ? (
                previewData.ext === 'pdf' ? (
                  <iframe src={previewData.url} className="w-full h-full border-none bg-white rounded-2xl shadow-2xl" title="PDF预览" />
                ) : ['jpg','jpeg','png','gif','webp'].includes(previewData.ext) ? (
                  <div className="relative w-full h-full flex items-center justify-center p-4">
                    <img src={previewData.url} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-700" alt={previewData.title} />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full text-white text-[10px] font-black border border-white/10">
                          滚动滚轮可缩放查看细节 · 点击背景退出
                       </div>
                    </div>
                  </div>
                ) : ['mp4', 'webm', 'ogg'].includes(previewData.ext) ? (
                  <video src={previewData.url} controls className="max-w-full max-h-full rounded-2xl shadow-2xl shadow-blue-500/10" />
                ) : ['mp3', 'wav'].includes(previewData.ext) ? (
                  <div className="bg-white/10 p-12 rounded-3xl backdrop-blur-2xl border border-white/20 flex flex-col items-center gap-6">
                    <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center animate-pulse"><Users className="text-white" size={40} /></div>
                    <audio src={previewData.url} controls className="w-80" />
                  </div>
                ) : (
                  <div className="text-white text-center p-20">
                    <div className="text-8xl mb-8 opacity-50 drop-shadow-2xl">📦</div>
                    <p className="font-black mb-8 text-3xl tracking-tight">该文件类型不支持在线预览</p>
                    <a href={previewData.url} download className="px-12 py-4 bg-blue-600 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/30 inline-flex items-center gap-3 active:scale-95 transition-all hover:bg-blue-700">
                      <Download size={24} /> 下载原始文件
                    </a>
                  </div>
                )
              ) : (
                <div className="w-full h-full p-16 overflow-y-auto bg-slate-900/50 custom-scrollbar">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-12 pb-8 border-b border-white/10">
                       <h1 className="text-4xl font-black text-white mb-4 leading-tight">{previewData.title}</h1>
                       <div className="flex items-center gap-4 text-white/40 text-xs font-bold">
                          <span>知识库笔记</span>
                          <span className="w-1 h-1 rounded-full bg-white/20"></span>
                          <span>{previewData.owner_name}</span>
                       </div>
                    </div>
                    <div className="text-white/90 whitespace-pre-wrap leading-loose text-lg font-medium selection:bg-blue-500 selection:text-white">
                      {previewData.content || '暂无正文内容'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* --- 底部控制条 --- */}
          <footer className="px-8 py-4 flex justify-center bg-transparent border-t border-white/5">
             <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">LeiXi Flagship Preview Engine v3.2 Premium Edition</p>
          </footer>
        </div>
      )}
    </div>
    </ConfigProvider>
  );
};

export default Win11KnowledgeFolderView;
