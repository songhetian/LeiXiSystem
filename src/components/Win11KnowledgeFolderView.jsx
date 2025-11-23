import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import Win11ContextMenu from './Win11ContextMenu';

const Win11KnowledgeFolderView = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [currentFolderCategory, setCurrentFolderCategory] = useState(null);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1); // For articles
  const [pageSize, setPageSize] = useState(30); // For articles
  const [articleTotalPages, setArticleTotalPages] = useState(1); // New state for article total pages
  const [totalArticleItems, setTotalArticleItems] = useState(0); // New state for total article items

  const [sortBy, setSortBy] = useState('asc');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('card'); // For articles
  const [categoryViewMode, setCategoryViewMode] = useState('card'); // For categories

  // Category Pagination
  const [categoryCurrentPage, setCategoryCurrentPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10); // Default page size for categories
  const [categoryTotalPages, setCategoryTotalPages] = useState(1);
  const [totalCategoryItems, setTotalCategoryItems] = useState(0); // New state for total items

  // 新建分类状态
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 分类重命名状态
  const [showRenameCategoryModal, setShowRenameCategoryModal] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [renameCategoryName, setRenameCategoryName] = useState('');

  // 新建/编辑文档状态
  const [showCreateArticleModal, setShowCreateArticleModal] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(null); // 右键的所属分类
  const [editingArticle, setEditingArticle] = useState(null);
  const [articleFormData, setArticleFormData] = useState({
    title: '',
    category_id: '',
    summary: '',
    content: '',
    type: 'personal',
    status: 'published',
    icon: '📄',
    attachments: []
  });
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // 删除确认模态框
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteCategoryArticleCount, setDeleteCategoryArticleCount] = useState(0);

  const [showDeleteArticleModal, setShowDeleteArticleModal] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState(null);

  // 预览文档
  const [previewFile, setPreviewFile] = useState(null);
  const [showSaveToMyKnowledgeModal, setShowSaveToMyKnowledgeModal] = useState(false);
  const [selectedArticleToSave, setSelectedArticleToSave] = useState(null);
  const [targetCategory, setTargetCategory] = useState('');
  const [myKnowledgeCategories, setMyKnowledgeCategories] = useState([]);
  const [showMoveArticleModal, setShowMoveArticleModal] = useState(false);
  const [articleToMove, setArticleToMove] = useState(null);
  const [moveTargetCategory, setMoveTargetCategory] = useState('');

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '', // 'folder', 'file' or 'background'
    data: null
  });

  // 添加调整弹出框宽高的状态
  const [previewModalWidth, setPreviewModalWidth] = useState('max-w-4xl');
  const [previewModalHeight, setPreviewModalHeight] = useState('max-h-[95vh]');
  const [attachmentToPreview, setAttachmentToPreview] = useState(null);
  const [nonPreviewableFile, setNonPreviewableFile] = useState(null);


  // 回收站
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleCategories, setRecycleCategories] = useState([]);
  const [recycleArticles, setRecycleArticles] = useState([]);
  const [recycleLoading, setRecycleLoading] = useState(false);
  const [recycleTab, setRecycleTab] = useState('categories'); // 'categories' | 'articles'
  const [recycleContextMenu, setRecycleContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '', // 'category' | 'article'
    data: null
  });

  useEffect(() => {
    fetchCategories();
    fetchArticles();
  }, [categoryCurrentPage, categoryPageSize]);

  const getToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  };

  // 不再需要单独的公共分类列表，文档类型直接跟所属分类/固定规则走

  const getCurrentUserId = () => {
    try {
      const token = getToken();
      if (!token) return null;
      const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.userId || payload.user_id || payload.sub || payload.id || null;
    } catch {
      return null;
    }
  };

  const isPublished = (item) => {
    const s = (item?.status || '').toLowerCase();
    if (s) return ['published', 'publish', 'active'].includes(s);
    if (typeof item?.is_published !== 'undefined') return item.is_published === 1;
    return true;
  };

  const isNotDeleted = (item) => {
    if (typeof item?.is_deleted !== 'undefined') return item.is_deleted === 0;
    if (typeof item?.deleted !== 'undefined') return item.deleted === 0;
    if (Object.prototype.hasOwnProperty.call(item || {}, 'deleted_at')) return !item.deleted_at;
    return true;
  };

  const isPublic = (item) => {
    if (item?.is_public === 1) return true;
    const t = (item?.type || '').toLowerCase();
    if (t && ['common', 'public', 'global'].includes(t)) return true;
    const v = (item?.visibility || '').toLowerCase();
    if (v === 'public') return true;
    return false;
  };

  const isOwnedBy = (item, userId) => {
    const owner = item?.user_id || item?.owner_id || item?.uid || item?.created_by;
    return userId ? String(owner) === String(userId) : false;
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl(`/api/knowledge/categories?page=${categoryCurrentPage}&pageSize=${categoryPageSize}`));
      console.log('Folder Categories API Response:', response.data); // 调试信息
      // 确保返回的是数组
      let categoriesData = response.data || [];
      let totalItems = 0;

      if (response.data && Array.isArray(response.data.data)) {
        // If it's a paginated structure { data: [...], total: ..., page: ... }
        categoriesData = response.data.data;
        totalItems = response.data.total || categoriesData.length; // Ensure totalItems is set
      } else if (Array.isArray(response.data)) {
        // If it's a direct array (non-paginated from API, but we'll paginate client-side)
        categoriesData = response.data;
        totalItems = categoriesData.length;
      }

      const uid = getCurrentUserId();
      const filtered = (categoriesData || []).filter(c => {
        const t = String(c?.type || '').toLowerCase();
        const notDeleted = !c.deleted_at && c.status !== 'deleted' && c.is_deleted !== 1;
        // 逻辑: 用户ID匹配 + common + 未删除
        return isOwnedBy(c, uid) && t === 'common' && notDeleted;
      });

      setCategories(filtered);
      // 使用过滤后的数据长度计算分页
      const filteredTotalItems = filtered.length;
      setTotalCategoryItems(filteredTotalItems);
      const calculatedTotalPages = Math.ceil(filteredTotalItems / categoryPageSize);
      setCategoryTotalPages(calculatedTotalPages);
      console.log('Pagination Debug: filteredTotalItems =', filteredTotalItems, 'categoryPageSize =', categoryPageSize, 'calculatedTotalPages =', calculatedTotalPages);

    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/articles'));
      console.log('Folder Articles API Response:', response.data); // 调试信息
      // 确保返回的是数组
      let articlesData = response.data || [];
      const filtered = (articlesData || []).filter(a => {
        // 这里只过滤掉已删除的文档，其余全部交给前端视图按分类/搜索再筛选
        return !a.deleted_at && a.status !== 'deleted' && a.is_deleted !== 1;
      });
      setArticles(filtered);
    } catch (error) {
      console.error('获取文档失败:', error);
      toast.error('获取文档失败');
    } finally {
      setLoading(false);
    }
  };

  const parseAttachments = (attachments) => {
    if (!attachments) return [];
    if (Array.isArray(attachments)) return attachments;
    if (typeof attachments === 'string') {
      try {
        return JSON.parse(attachments);
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const fetchMyKnowledgeCategories = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/my-knowledge/categories'));
      setMyKnowledgeCategories(response.data || []);
    } catch (error) {
      console.error('获取我的知识库分类失败:', error);
    }
  };

  useEffect(() => {
    if (showSaveToMyKnowledgeModal) {
      (async () => {
        await fetchMyKnowledgeCategories();
        const list = myKnowledgeCategories || [];
        if (!list.length) {
          try {
            const resp = await axios.post(getApiUrl('/api/knowledge/categories'), {
              name: '默认分类',
              description: '',
              icon: '📁',
              owner_id: getCurrentUserId(),
              type: 'personal',
              is_public: 1
            });
            const newId = resp.data?.id;
            await fetchMyKnowledgeCategories();
            if (newId) setTargetCategory(newId);
          } catch (e) {
          }
        }
      })();
    }
  }, [showSaveToMyKnowledgeModal]);

  const handleSaveToMyKnowledge = async () => {
    if (!selectedArticleToSave) return;
    try {
      setLoading(true);
      let categoryId = targetCategory;
      if (targetCategory === 'new' && newCategoryName.trim()) {
        const categoryResponse = await axios.post(getApiUrl('/api/knowledge/categories'), {
          name: newCategoryName.trim(),
          description: '',
          icon: '📁',
          owner_id: getCurrentUserId(),
          type: 'personal',
          is_public: 1
        });
        categoryId = categoryResponse.data.id;
        toast.success(`分类 "${newCategoryName.trim()}" 创建成功`);
        fetchMyKnowledgeCategories();
      }
      const response = await axios.post(getApiUrl('/api/my-knowledge/articles/save'), {
        articleId: selectedArticleToSave.id,
        categoryId: categoryId !== 'new' ? categoryId : null,
        notes: ''
      });
      if (response.data?.success) {
        toast.success(`文档 "${selectedArticleToSave.title}" 已保存到我的知识库`);
        await fetchCategories();
        await fetchArticles();
      }
      setShowSaveToMyKnowledgeModal(false);
      setSelectedArticleToSave(null);
      setTargetCategory('');
      setNewCategoryName('');
    } catch (error) {
      console.error('保存到我的知识库失败:', error);
      toast.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveArticle = async () => {
    if (!articleToMove) return;
    try {
      setLoading(true);
      // 先获取最新文章数据以确保字段完整
      const articleRes = await axios.get(getApiUrl(`/api/knowledge/articles/${articleToMove.id}`));
      const articleData = articleRes.data;

      const updated = {
        ...articleData,
        category_id: moveTargetCategory || null,
        // 确保关键字段不丢失
        owner_id: articleData.owner_id || articleData.user_id || getCurrentUserId(),
        is_public: articleData.is_public
      };
      await axios.put(getApiUrl(`/api/knowledge/articles/${articleToMove.id}`), updated);
      toast.success('文档已移动到目标分类');
      setShowMoveArticleModal(false);
      setArticleToMove(null);
      setMoveTargetCategory('');
      fetchArticles();
    } catch (error) {
      console.error('移动文档失败:', error);
      toast.error('移动失败');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type) => {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '📷';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎧';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📈';
    if (type.includes('powerpoint') || type.includes('presentation')) return '🖥️';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    if (type.includes('text') || type.includes('plain')) return '🗒️';
    if (type.includes('json')) return '📋';
    if (type.includes('xml')) return '📊';
    if (type.includes('html')) return '🌐';
    if (type.includes('css')) return '🎨';
    if (type.includes('javascript') || type.includes('js')) return '📜';
    return '📄';
  };

  const getFileTypeName = (type) => {
    if (!type) return '未知文件';
    if (type.startsWith('image/')) return '图片文件';
    if (type.startsWith('video/')) return '视频文件';
    if (type.startsWith('audio/')) return '音频文件';
    if (type.includes('pdf')) return 'PDF文档';
    if (type.includes('word') || type.includes('document')) return 'Word文档';
    if (type.includes('excel') || type.includes('sheet')) return 'Excel表格';
    if (type.includes('powerpoint') || type.includes('presentation')) return '演示文稿';
    if (type.includes('zip') || type.includes('compressed')) return '压缩文件';
    if (type.includes('text') || type.includes('plain')) return '文本文件';
    if (type.includes('json')) return 'JSON文件';
    if (type.includes('xml')) return 'XML文件';
    if (type.includes('html')) return 'HTML文件';
    if (type.includes('css')) return 'CSS文件';
    if (type.includes('javascript') || type.includes('js')) return 'JS文件';
    return '文件';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 确保附件 URL 格式正确
  const getAttachmentUrl = (url) => {
    if (!url) return '';
    // 如果已经是完整 URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // 如果是相对路径，补全为完整 URL
    if (url.startsWith('/')) {
      const host = getApiUrl('').replace('/api', '');
      return `${host}${url}`;
    }
    // 其他情况，假设是文件名，补全完整路径
    const host = getApiUrl('').replace('/api', '');
    return `${host}/uploads/${url}`;
  };

  const inferFileType = (file) => {
    if (!file) return '';
    const t = (file.type || '').toLowerCase();
    // If backend returns a generic type, still try to infer by extension
    if (t && t !== 'application/octet-stream') return t;
    const src = String(file.url || file.path || file.name || '').toLowerCase();
    const ext = src.split('?')[0].split('#')[0].split('.').pop();
    if (!ext || ext === src) return '';
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp': return 'image/*';
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv': return 'video/*';
      case 'mp3':
      case 'wav':
      case 'aac': return 'audio/*';
      case 'doc':
      case 'docx': return 'application/word';
      case 'xls':
      case 'xlsx': return 'application/excel';
      case 'ppt':
      case 'pptx': return 'application/presentation';
      case 'zip':
      case 'rar':
      case '7z': return 'application/zip';
      case 'txt': return 'text/plain';
      case 'json': return 'application/json';
      case 'xml': return 'application/xml';
      case 'html': return 'text/html';
      case 'css': return 'text/css';
      case 'js': return 'application/javascript';
      default: return '';
    }
  };

  // 打开文件夹
  const handleOpenFolder = (category) => {
    setCurrentFolderCategory(category);
    setFolderSearchTerm('');
    setCurrentPage(1);
  };

  // 获取当前文件夹的文档
  const getCurrentFolderArticles = () => {
    if (!currentFolderCategory) return [];

    const categoryArticles = currentFolderCategory.id === 'uncategorized'
      ? articles.filter(a => !a.category_id)
      : articles.filter(a => a.category_id == currentFolderCategory.id);

    // 过滤（支持中文，不改变大小写也可，但统一转小写不影响中文）
    let filtered = categoryArticles.filter(article => {
      const t = String(article.title || '').toLowerCase();
      const s = String(article.summary || '').toLowerCase();
      const q = String(folderSearchTerm || '').toLowerCase();
      return t.includes(q) || s.includes(q);
    });

    // 排序
    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'name':
          aValue = String(a.title || '').toLowerCase();
          bValue = String(b.title || '').toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'views':
          aValue = a.view_count || 0;
          bValue = b.view_count || 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  // 分页计算
  const getPaginatedArticles = () => {
    const filtered = getCurrentFolderArticles();
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const filtered = getCurrentFolderArticles();
    return Math.ceil(filtered.length / pageSize);
  };

  // 打开重命名分类弹窗
  const openRenameCategoryModal = (category) => {
    setRenamingCategory(category);
    setRenameCategoryName(category?.name || '');
    setShowRenameCategoryModal(true);
  };

  // 提交重命名分类
  const handleRenameCategory = async () => {
    if (!renamingCategory || !renameCategoryName.trim()) {
      toast.error('请输入新的分类名称');
      return;
    }

    try {
      await axios.put(getApiUrl(`/api/knowledge/categories/${renamingCategory.id}`), {
        name: renameCategoryName.trim()
      });
      toast.success('分类名称已更新');
      setShowRenameCategoryModal(false);
      setRenamingCategory(null);
      setRenameCategoryName('');
      fetchCategories();
    } catch (error) {
      console.error('重命名分类失败:', error);
      toast.error('重命名分类失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 打开新建文档弹窗（指定分类）
  const openCreateArticleModalFromCategory = (category) => {
    setCreatingCategory(category || null);
    setEditingArticle(null);

    setArticleFormData({
      title: '',
      category_id: category && category.id !== 'uncategorized' ? category.id : '',
      summary: '',
      content: '',
      // 文档类型简化为固定值，由后端/列表统一处理
      type: 'common',
      status: 'published',
      icon: '📄',
      attachments: []
    });
    setShowCreateArticleModal(true);
  };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const uploadedFiles = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(getApiUrl('/upload'), formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        uploadedFiles.push({
          name: file.name,
          url: response.data.url,
          type: file.type,
          size: file.size
        });
      }

      setArticleFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedFiles]
      }));

      toast.success(`成功上传 ${files.length} 个文件`);
    } catch (error) {
      console.error('文件上传失败:', error);
      toast.error('文件上传失败');
    } finally {
      setUploadingFiles(false);
    }
  };

  // 处理附件上传（点击选择）
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadFiles(files);
    // 允许重复选择同一文件
    e.target.value = '';
  };

  // 处理附件拖拽上传
  const handleFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    await uploadFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleRemoveAttachment = (index) => {
    setArticleFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  // 提交新建/编辑文档
  const handleCreateArticle = async () => {
    if (!articleFormData.title.trim()) {
      toast.error('请输入文档标题');
      return;
    }

    try {
      setLoading(true);
      // 始终优先使用右键点击时的分类作为归属分类，确保新建文档出现在该分类下
      const finalCategoryId = creatingCategory
        ? creatingCategory.id
        : (articleFormData.category_id || null);

      const payload = {
        title: articleFormData.title.trim(),
        category_id: finalCategoryId,
        // 现在不需要摘要和正文内容，后端字段保持为空字符串
        summary: '',
        content: '',
        // 文档类型为common，与当前视图过滤逻辑一致
        type: 'common',
        status: articleFormData.status || 'published',
        // 图标优先使用分类图标，否则使用默认图标
        icon: creatingCategory?.icon || '📄',
        attachments: articleFormData.attachments || [],
        is_public: 0
      };

      const response = await axios.post(getApiUrl('/api/knowledge/articles'), payload);
      if (response.data && response.data.id) {
        toast.success('文档创建成功');
        setShowCreateArticleModal(false);
        setCreatingCategory(null);
        setEditingArticle(null);
        setArticleFormData({
          title: '',
          category_id: '',
          summary: '',
          content: '',
          type: 'personal',
          status: 'published',
          icon: '📄',
          attachments: []
        });
        fetchArticles();
      }
    } catch (error) {
      console.error('创建文档失败:', error);
      toast.error('创建文档失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 新建分类处理函数
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(getApiUrl('/api/knowledge/categories'), {
        name: newCategoryName,
        description: '',
        icon: '\ud83d\udcc1',
        owner_id: getCurrentUserId(),
        type: 'common',
        is_public: 0
      });

      if (response.data && response.data.id) {
        toast.success('分类创建成功');
        setShowCreateCategoryModal(false);
        setNewCategoryName('');
        fetchCategories(); // 重新获取分类列表
      }
    } catch (error) {
      console.error('创建分类失败:', error);
      toast.error('创建分类失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 打开删除分类模态框
  const handleDeleteCategory = (categoryId) => {
    const categoryArticles = articles.filter(a => a.category_id == categoryId);
    const target = categories.find(c => c.id === categoryId) || null;
    setCategoryToDelete(target);
    setDeleteCategoryArticleCount(categoryArticles.length);
    setShowDeleteCategoryModal(true);
  };

  // 确认删除分类（软删除到回收站）
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await axios.post(getApiUrl(`/api/knowledge/categories/${categoryToDelete.id}/soft-delete`));
      toast.success('分类已移至回收站');
      setShowDeleteCategoryModal(false);
      setCategoryToDelete(null);
      setDeleteCategoryArticleCount(0);
      fetchCategories();
      fetchArticles();
    } catch (error) {
      console.error('删除分类失败:', error);
      toast.error('删除分类失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 处理分类显示/隐藏
  const handleToggleCategoryVisibility = async (categoryId, isHidden) => {
    try {
      await axios.post(getApiUrl(`/api/knowledge/categories/${categoryId}/toggle-visibility`), { is_hidden: isHidden });
      toast.success(isHidden === 1 ? '分类已隐藏' : '分类已显示');
      // 重新获取分类列表
      fetchCategories();
    } catch (error) {
      console.error('更新分类可见性失败:', error);
      toast.error('操作失败');
    }
  };

  // 处理分类公开/不公开
  const handleToggleCategoryPublic = async (categoryId, isPublic) => {
    try {
      await axios.put(getApiUrl(`/api/knowledge/categories/${categoryId}`), { is_public: isPublic });
      toast.success(isPublic === 1 ? '分类已公开（含文档）' : '分类已设为不公开');
      // 公开状态影响文章在公共知识库的展示，这里也刷新文章
      fetchCategories();
      fetchArticles();
    } catch (error) {
      console.error('更新分类公开状态失败:', error);
      toast.error('操作失败');
    }
  };

  /// 处理文档公开/不公开
  const handleToggleArticlePublic = async (article, isPublic) => {
    try {
      const articleRes = await axios.get(getApiUrl(`/api/knowledge/articles/${article.id}`));
      const articleData = articleRes.data;

      // 只验证 title,content 可以为空(文档可能只有附件)
      if (!articleData.title) {
        toast.error('文档数据不完整,无法更新');
        return;
      }

      // 确保 content 字段存在(即使为空字符串)
      if (articleData.content === undefined || articleData.content === null) {
        articleData.content = '';
      }

      await axios.put(getApiUrl(`/api/knowledge/articles/${article.id}`), {
        ...articleData,
        is_public: isPublic
      });
      toast.success(isPublic === 1 ? '文档已公开' : '文档已设为不公开');
      fetchArticles();
    } catch (error) {
      console.error('更新文档公开状态失败:', error);
      console.error('Error response:', error.response?.data);
      toast.error('操作失败: ' + (error.response?.data?.error || error.message));
    }
  };
  // 按分类分组文档
  const articlesByCategory = {};
  const uncategorizedArticles = [];
  articles.forEach(article => {
    const t = String(article.title || '').toLowerCase();
    const s = String(article.summary || '').toLowerCase();
    const q = String(searchTerm || '').toLowerCase();
    const matchesSearch = t.includes(q) || s.includes(q);
    if (!matchesSearch) return;
    if (article.category_id) {
      if (!articlesByCategory[article.category_id]) {
        articlesByCategory[article.category_id] = [];
      }
      articlesByCategory[article.category_id].push(article);
    } else {
      uncategorizedArticles.push(article);
    }
  });
  // 右键菜单处理函数
  const handleContextMenu = (e, type, data) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      type: '',
      data: null
    });
  };

  const handleContextMenuAction = (item) => {
    if (contextMenu.type === 'folder') {
      switch (item.actionType) {
        case 'toggleVisibility':
          handleToggleCategoryVisibility(contextMenu.data.id, contextMenu.data.is_hidden === 0 ? 1 : 0);
          break;
        case 'togglePublic':
          handleToggleCategoryPublic(contextMenu.data.id, contextMenu.data.is_public === 1 ? 0 : 1);
          break;
        case 'rename':
          openRenameCategoryModal(contextMenu.data);
          break;
        case 'addArticle':
          openCreateArticleModalFromCategory(contextMenu.data);
          break;
        case 'delete':
          handleDeleteCategory(contextMenu.data.id);
          break;
        default:
          break;
      }
    } else if (contextMenu.type === 'file') {
      switch (item.actionType) {
        case 'preview': {
          const article = contextMenu.data;
          const attachments = parseAttachments(article.attachments);
          if (attachments.length === 1) {
            const file = attachments[0];
            const fileType = inferFileType(file);
            const isPreviewable = fileType.startsWith('image/') || fileType.startsWith('video/') || fileType.includes('pdf');
            if (isPreviewable) {
              setAttachmentToPreview(file);
            } else {
              setNonPreviewableFile(file);
            }
          } else {
            setPreviewFile(article);
          }
          break;
        }
        case 'move': {
          const article = contextMenu.data;
          setArticleToMove(article);
          setMoveTargetCategory(article?.category_id || '');
          setShowMoveArticleModal(true);
          break;
        }
        case 'delete': {
          const article = contextMenu.data;
          if (!article) break;
          setArticleToDelete(article);
          setShowDeleteArticleModal(true);
          break;
        }
        case 'togglePublic': {
          const article = contextMenu.data;
          if (!article) break;
          handleToggleArticlePublic(article, article.is_public === 1 ? 0 : 1);
          break;
        }
        default:
          break;
      }
    } else if (contextMenu.type === 'background') {
      switch (item.actionType) {
        case 'newCategory':
          setShowCreateCategoryModal(true);
          break;
        default:
          break;
      }
    }
  };

  // 确认删除文档（软删除到回收站）
  const confirmDeleteArticle = async () => {
    if (!articleToDelete) return;
    try {
      await axios.post(getApiUrl(`/api/knowledge/articles/${articleToDelete.id}/soft-delete`));
      toast.success('文档已移至回收站');
      setShowDeleteArticleModal(false);
      setArticleToDelete(null);
      fetchArticles();
    } catch (error) {
      console.error('删除文档失败:', error);
      toast.error('删除文档失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 回收站数据加载
  const fetchRecycleBinData = async () => {
    setRecycleLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        axios.get(getApiUrl('/api/knowledge/recycle-bin/categories')),
        axios.get(getApiUrl('/api/knowledge/recycle-bin/articles'))
      ]);
      setRecycleCategories(Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []));
      setRecycleArticles(Array.isArray(artRes.data) ? artRes.data : (artRes.data?.data || []));
    } catch (error) {
      console.error('加载回收站数据失败:', error);
      toast.error('加载回收站数据失败');
    } finally {
      setRecycleLoading(false);
    }
  };

  const openRecycleBin = () => {
    setShowRecycleBin(true);
    fetchRecycleBinData();
  };

  const closeRecycleBin = () => {
    setShowRecycleBin(false);
    setRecycleContextMenu({ visible: false, x: 0, y: 0, type: '', data: null });
  };

  const handleRecycleContextMenu = (e, type, data) => {
    e.preventDefault();
    setRecycleContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  };

  const handleRecycleContextMenuClose = () => {
    setRecycleContextMenu({ visible: false, x: 0, y: 0, type: '', data: null });
  };

  const handleRecycleContextMenuAction = async (item) => {
    const target = recycleContextMenu.data;
    if (!target) return;
    try {
      if (recycleContextMenu.type === 'category') {
        if (item.actionType === 'restore') {
          await axios.post(getApiUrl(`/api/knowledge/recycle-bin/categories/${target.id}/restore`), {
            restoreArticles: true
          });
          toast.success('分类及其文档已还原');
        }
      } else if (recycleContextMenu.type === 'article') {
        if (item.actionType === 'restore') {
          await axios.post(getApiUrl(`/api/knowledge/recycle-bin/articles/${target.id}/restore`));
          toast.success('文档已还原');
        }
      }

      handleRecycleContextMenuClose();
      fetchRecycleBinData();
      // 同步主列表
      fetchCategories();
      fetchArticles();
    } catch (error) {
      console.error('回收站操作失败:', error);
      toast.error('回收站操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 处理背景右键菜单（当前不打开自定义菜单，保留浏览器默认菜单）
  const handleBackgroundContextMenu = (e) => {
    // 只在真正点击背景时才处理；当前需求下不拦截，让浏览器默认菜单生效
    if (e.target !== e.currentTarget) return;
  };

  // 关闭文件夹视图
  const closeFolderView = () => {
    setCurrentFolderCategory(null);
    setCurrentPage(1);
  };

  // 分类排序与过滤（外层）
  const sortedCategories = [...categories].sort((a, b) => {
    if (sortBy === 'name') {
      const aName = String(a.name || '').toLowerCase();
      const bName = String(b.name || '').toLowerCase();
      return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
    }
    return 0;
  });

  const filteredCategories = sortedCategories.filter(category => {
    const q = String(searchTerm || '').toLowerCase();
    if (!q) return true;
    const inName = String(category.name || '').toLowerCase().includes(q);
    const catArticles = articlesByCategory[category.id] || [];
    const inArticles = catArticles.some(article => {
      const t = String(article.title || '').toLowerCase();
      const s = String(article.summary || '').toLowerCase();
      return t.includes(q) || s.includes(q);
    });
    return inName || inArticles;
  });

  return (
    <div className="p-6 h-full flex flex-col bg-gray-100">
      {/* 顶部操作栏 */}
      <div className="mb-6">
        <div className="bg-green-50 rounded-lg shadow-sm p-4">
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-start"> {/* Changed justify-between to justify-start */}
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 flex-shrink-0">
                          <div className="w-12 h-12 flex items-center justify-center rounded-md bg-gray-100 text-gray-700 text-3xl">📂</div>
                          知识文档
                        </h1>

                        {/* 搜索框和操作按钮 */}
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-stretch ml-4"> {/* Added ml-4 for spacing */}
                          {/* 搜索框 */}
                          <div className="relative flex-1 min-w-[250px]">
                            <input
                              type="text"
                              placeholder={currentFolderCategory
                                ? `在 ${currentFolderCategory.name} 中搜索...`
                                : '搜索所有文档...'}
                              value={currentFolderCategory ? folderSearchTerm : searchTerm}
                              onChange={(e) => {
                                if (currentFolderCategory) {
                                  setFolderSearchTerm(e.target.value);
                                } else {
                                  setSearchTerm(e.target.value);
                                }
                              }}
                              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                            />
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                              🔍
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (currentFolderCategory) {
                                  setShowCreateArticleModal(true);
                                  setCreatingCategory(currentFolderCategory);
                                } else {
                                  setShowCreateCategoryModal(true);
                                }
                              }}
                              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm whitespace-nowrap"
                            >
                              {currentFolderCategory ? '添加文档' : '添加分类'}
                            </button>

                            <button
                              onClick={() => {
                                setShowRecycleBin(!showRecycleBin);
                                if (!showRecycleBin) fetchRecycleBinData();
                              }}
                              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${
                                showRecycleBin
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <span>🗑️</span>
                              回收站
                            </button>

                            {/* 视图切换按钮 - 仅在分类视图中显示 */}
                            {!currentFolderCategory && ( // Only show for categories
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setCategoryViewMode('card')}
                                  className={`px-3 py-2 text-sm ${categoryViewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                  卡片视图
                                </button>
                                <button
                                  onClick={() => setCategoryViewMode('list')}
                                  className={`px-3 py-2 text-sm border-l border-gray-200 ${categoryViewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                  列表视图
                                </button>
                              </div>
                            )}

                            {currentFolderCategory && ( // Only show for articles
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setViewMode('card')}
                                  className={`px-3 py-2 text-sm ${viewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                  卡片视图
                                </button>
                                <button
                                  onClick={() => setViewMode('list')}
                                  className={`px-3 py-2 text-sm border-l border-gray-200 ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                  列表视图
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden" onContextMenu={handleBackgroundContextMenu}>
        {showRecycleBin ? (
          // 回收站视图
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🗑️</span>
                回收站
              </h2>
              <button
                onClick={async () => {
                  if (!window.confirm('清空回收站后数据将无法恢复，确定要继续吗？')) return;
                  try {
                    await axios.post(getApiUrl('/api/knowledge/recycle-bin/empty'), { type: 'all' });
                    toast.success('已清空回收站');
                    await fetchRecycleBinData();
                    await fetchCategories();
                    await fetchArticles();
                  } catch (error) {
                    console.error('清空回收站失败:', error);
                    toast.error('清空回收站失败');
                  }
                }}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-sm flex items-center gap-1 border border-red-200 transition-colors"
              >
                🗑️ 清空回收站
              </button>
            </div>

            {recycleLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* 已删除的分类 */}
                {recycleCategories.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">已删除的分类</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {recycleCategories.map(category => (
                        <div key={category.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{category.icon || '📁'}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{category.name}</h4>
                              <p className="text-xs text-gray-500">
                                删除时间: {formatDate(category.deleted_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={async () => {
                                try {
                                  await axios.post(getApiUrl(`/api/knowledge/recycle-bin/categories/${category.id}/restore`), { restoreArticles: true });
                                  toast.success('分类及其文档已还原');
                                  fetchRecycleBinData();
                                  fetchCategories();
                                  fetchArticles();
                                } catch (error) {
                                  console.error('还原失败:', error);
                                  toast.error('还原失败');
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              恢复
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm('确定要永久删除吗？此操作不可撤销！')) return;
                                try {
                                  await axios.delete(getApiUrl(`/api/knowledge/recycle-bin/categories/${category.id}/permanent`));
                                  toast.success('永久删除成功');
                                  fetchRecycleBinData();
                                } catch (error) {
                                  console.error('永久删除失败:', error);
                                  toast.error('永久删除失败');
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                            >
                              彻底删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 已删除的文档 */}
                {recycleArticles.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">已删除的文档</h3>
                    <div className="space-y-2">
                      {recycleArticles.map(article => (
                        <div key={article.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-xl">{article.icon || '📄'}</span>
                            <div className="min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{article.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>原分类: {article.category_name || '未分类'}</span>
                                <span>•</span>
                                <span>删除时间: {formatDate(article.deleted_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={async () => {
                                try {
                                  await axios.post(getApiUrl(`/api/knowledge/recycle-bin/articles/${article.id}/restore`));
                                  toast.success('文档已还原');
                                  fetchRecycleBinData();
                                  fetchCategories();
                                  fetchArticles();
                                } catch (error) {
                                  console.error('还原失败:', error);
                                  toast.error('还原失败');
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              恢复
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm('确定要永久删除吗？此操作不可撤销！')) return;
                                try {
                                  await axios.delete(getApiUrl(`/api/knowledge/recycle-bin/articles/${article.id}/permanent`));
                                  toast.success('永久删除成功');
                                  fetchRecycleBinData();
                                } catch (error) {
                                  console.error('永久删除失败:', error);
                                  toast.error('永久删除失败');
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                            >
                              彻底删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recycleCategories.length === 0 && recycleArticles.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                    <span className="text-6xl block mb-4 opacity-50">🗑️</span>
                    <p className="text-lg">回收站是空的</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : currentFolderCategory ? (
          // 文件夹内容视图
          <div className="flex-1 flex flex-col h-full" onContextMenu={handleBackgroundContextMenu}>
            {/* 文件夹头部 */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeFolderView}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  title="返回上一级"
                >
                  <span className="hidden sm:inline">返回</span>
                </button>
                <div className="w-14 h-14 flex items-center justify-center rounded-md bg-gray-100 text-gray-700 text-4xl flex-shrink-0">📂</div>
                <h2 className="text-xl font-semibold">{currentFolderCategory.name}</h2>
              </div>
            </div>

            {/* 文件列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </div>
                </div>
              ) : getPaginatedArticles().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-500">
                    {folderSearchTerm ? '没有找到匹配的文档' : '此文件夹为空'}
                  </p>
                </div>
              ) : (
                viewMode === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {getPaginatedArticles().map(article => {
                      const firstAttachment = parseAttachments(article.attachments)[0];
                      const resolvedType = inferFileType(firstAttachment);
                      return (
                        <div
                          key={article.id}
                          className={`p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center border rounded-lg shadow-sm ${
                            article.is_public === 1
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-gray-200'
                          }`}
                          onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                          onClick={() => {
                            const attachments = parseAttachments(article.attachments);
                            if (attachments.length === 1) {
                                const file = attachments[0];
                                const fileType = inferFileType(file);
                                const isPreviewable = fileType.startsWith('image/') || fileType.startsWith('video/') || fileType.includes('pdf');
                                if (isPreviewable) {
                                    setAttachmentToPreview(file);
                                } else {
                                    setNonPreviewableFile(file);
                                }
                            } else {
                                setPreviewFile(article);
                            }
                          }}
                        >
                          <div className="text-5xl mb-3 transform hover:scale-110 transition-transform duration-200">
                            {getFileIcon(resolvedType)}
                          </div>
                          <h3 className="font-medium text-gray-900 text-center line-clamp-2 text-base">
                            {article.title}
                          </h3>
                          {firstAttachment && (
                            <div className="text-xs text-gray-500 mt-1">
                              {getFileTypeName(resolvedType)}
                            </div>
                          )}
                          {article.notes && (
                            <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                              💡 有笔记
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getPaginatedArticles().map(article => {
                      const firstAttachment = parseAttachments(article.attachments)[0];
                      const resolvedType = inferFileType(firstAttachment);
                      return (
                        <div
                          key={article.id}
                          className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex items-center gap-4 border border-gray-200 rounded-lg shadow-sm"
                          onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                          onClick={() => {
                            const attachments = parseAttachments(article.attachments);
                            if (attachments.length === 1) {
                                const file = attachments[0];
                                const fileType = inferFileType(file);
                                const isPreviewable = fileType.startsWith('image/') || fileType.startsWith('video/') || fileType.includes('pdf');
                                if (isPreviewable) {
                                    setAttachmentToPreview(file);
                                } else {
                                    setNonPreviewableFile(file);
                                }
                            } else {
                                setPreviewFile(article);
                            }
                          }}
                        >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xl flex-shrink-0">{article.icon || getFileIcon(article.type)}</span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-gray-900 truncate text-sm flex items-center gap-2">
                              {article.title}
                              {article.is_public === 1 ? (
                                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 flex-shrink-0" title="已公开">🌐 公开</span>
                              ) : (
                                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex-shrink-0" title="未公开">🔒 私有</span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>{formatFileSize(article.size || 0)}</span>
                              <span>•</span>
                              <span>{formatDate(article.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* 分页 */}
            {getTotalPages() > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      共 {getCurrentFolderArticles().length} 个文档，第 {currentPage} / {getTotalPages()} 页
                    </div>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    >
                      <option value={10}>10 / 页</option>
                      <option value={20}>20 / 页</option>
                      <option value={30}>30 / 页</option>
                      <option value={50}>50 / 页</option>
                    </select>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>

                    {[...Array(Math.min(5, getTotalPages()))].map((_, i) => {
                      let pageNum;
                      const totalPages = getTotalPages();
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded text-sm ${ currentPage === pageNum
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 hover:bg-gray-100'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(getTotalPages())}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      末页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 主文件夹视图
          <div className="flex-1 flex flex-col" onContextMenu={handleBackgroundContextMenu}>
            {/* 文件夹网格 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </div>
                </div>
              ) : categories.length === 0 && uncategorizedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-gray-500">暂无文件夹</p>
                  <p className="text-sm text-gray-400 mt-2">
                    在浏览知识库中点击"收藏"按钮即可添加到我的知识库
                  </p>
                </div>
              ) : (
                categoryViewMode === 'card' ? ( // Use categoryViewMode here
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {/* 分类文件夹 */}
                    {filteredCategories
                      .filter(cat => cat.status !== 'draft')
                      .map(category => {
                        const categoryArticles = articlesByCategory[category.id] || [];
                        if (searchTerm && categoryArticles.length === 0 && !String(category.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())) return null;
                        return (
                          <div
                            key={category.id}
                            className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center relative border border-gray-100 rounded-lg"
                            onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                            onClick={() => handleOpenFolder(category)}
                          >
                            {category.is_public !== 1 && (
                              <div className="absolute inset-0 bg-white/60 rounded-lg pointer-events-none" />
                            )}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCategoryVisibility(category.id, category.is_hidden === 1 ? 0 : 1);
                              }}
                              className="text-xs p-1 rounded hover:bg-gray-200"
                              title={category.is_hidden === 1 ? '公开分类' : '不公开分类'}
                            >
                              {category.is_hidden === 1 ? '🌐' : '🔒'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(category.id);
                              }}
                              className="text-xs p-1 rounded hover:bg-gray-200 text-red-500"
                              title="删除分类"
                            >
                              🗑️
                            </button>
                          </div>
                          <div className="absolute top-2 left-2 text-xs px-2 py-1 rounded-full border bg-white/70">
                            {category.is_public === 1 ? '🌐 公开' : '🔒 私有'}
                          </div>
                          <div className="w-24 h-24 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 text-6xl mb-3">📂</div>
                          <h3 className="font-medium text-gray-900 text-center line-clamp-2 text-base">{category.name}</h3>
                        </div>
                        );
                      })}

                    {/* 未分类文档 */}
                    {uncategorizedArticles.length > 0 && (
                      <div
                        className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center relative border border-gray-100 rounded-lg"
                        onClick={() => handleOpenFolder({ id: 'uncategorized', name: '未分类', icon: '📂' })}
                        onContextMenu={(e) => handleContextMenu(e, 'folder', { id: 'uncategorized', name: '未分类', icon: '📂' })}
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info('未分类文件夹不能隐藏');
                            }}
                            className="text-xs p-1 rounded hover:bg-gray-200 cursor-not-allowed"
                            title="未分类文件夹不能隐藏"
                          >
                            🔒
                          </button>
                        </div>
                        <div className="text-7xl mb-3">📂</div>
                        <h3 className="font-medium text-gray-900 text-center text-base">未分类</h3>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 分类文件夹 */}
                    {filteredCategories
                      .filter(cat => cat.status !== 'draft')
                      .map(category => {
                        const categoryArticles = articlesByCategory[category.id] || [];
                        if (searchTerm && categoryArticles.length === 0 && !String(category.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())) return null;
                        return (
                          <div
                            key={category.id}
                            className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex items-center gap-4 border border-gray-100 rounded-lg relative"
                            onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                            onClick={() => handleOpenFolder(category)}
                          >
                            {category.is_public !== 1 && (
                              <div className="absolute inset-0 bg-white/60 rounded-lg pointer-events-none" />
                            )}
                            <div className="text-5xl flex-shrink-0">📂</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">{category.name}</h3>
                            </div>
                          </div>
                        );
                      })}

                    {/* 未分类文档 */}
                    {uncategorizedArticles.length > 0 && (
                      <div
                        className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex items-center gap-4 border border-gray-100 rounded-lg"
                        onClick={() => handleOpenFolder({ id: 'uncategorized', name: '未分类', icon: '📂' })}
                        onContextMenu={(e) => handleContextMenu(e, 'folder', { id: 'uncategorized', name: '未分类', icon: '📂' })}
                      >
                        <div className="text-4xl flex-shrink-0">📂</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">未分类</h3>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Category Pagination */}
            {categoryTotalPages > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      共 {totalCategoryItems} 个分类，第 {categoryCurrentPage} / {categoryTotalPages} 页
                    </div>
                    <select
                      value={categoryPageSize}
                      onChange={(e) => setCategoryPageSize(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    >
                      <option value={5}>5 / 页</option>
                      <option value={10}>10 / 页</option>
                      <option value={20}>20 / 页</option>
                      <option value={30}>30 / 页</option>
                    </select>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setCategoryCurrentPage(1)}
                      disabled={categoryCurrentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => setCategoryCurrentPage(p => Math.max(1, p - 1))}
                      disabled={categoryCurrentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>

                    {[...Array(Math.min(5, categoryTotalPages))].map((_, i) => {
                      let pageNum;
                      const totalPages = categoryTotalPages;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (categoryCurrentPage <= 3) {
                        pageNum = i + 1;
                      } else if (categoryCurrentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = categoryCurrentPage - 2 + i;
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCategoryCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded text-sm ${ categoryCurrentPage === pageNum
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 hover:bg-gray-100'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCategoryCurrentPage(p => Math.min(categoryTotalPages, p + 1))}
                      disabled={categoryCurrentPage === categoryTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setCategoryCurrentPage(categoryTotalPages)}
                      disabled={categoryCurrentPage === categoryTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      末页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 文档预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1000] p-4">
          <div className={`bg-white rounded-xl shadow-2xl w-full ${previewModalWidth} ${previewModalHeight} flex flex-col`}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 truncate">{previewFile.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-700">
                  <span className="flex items-center gap-1">📁 {previewFile.category_name || '未分类'}</span>
                  <span className="flex items-center gap-1">📅 {formatDate(previewFile.created_at)}</span>
                  <span className="flex items-center gap-1">👁️ {previewFile.view_count || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedArticleToSave(previewFile);
                    setShowSaveToMyKnowledgeModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white hover:bg-gray-100 text-gray-700 rounded-lg transition-all shadow-md"
                  title="添加到我的知识库"
                >
                  <span>📥</span>
                  <span className="hidden sm:inline">添加到我的知识库</span>
                </button>
                {/* 调整宽高按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const widths = ['max-w-2xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'w-full'];
                      const currentIndex = widths.indexOf(previewModalWidth);
                      const nextIndex = (currentIndex + 1) % widths.length;
                      setPreviewModalWidth(widths[nextIndex]);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-sm"
                    title="调整宽度"
                  >
                    ↔️
                  </button>
                  <button
                    onClick={() => {
                      const heights = ['max-h-[70vh]', 'max-h-[80vh]', 'max-h-[90vh]', 'max-h-[95vh]', 'h-full'];
                      const currentIndex = heights.indexOf(previewModalHeight);
                      const nextIndex = (currentIndex + 1) % heights.length;
                      setPreviewModalHeight(heights[nextIndex]);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-sm"
                    title="调整高度"
                  >
                    ↕️
                  </button>
                  <button
                    onClick={() => {
                      setPreviewModalWidth('w-full');
                      setPreviewModalHeight('h-full');
                    }}
                    className="px-3 py-1 text-sm rounded-lg bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md"
                    title="全屏"
                  >
                    全屏
                  </button>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md ml-2 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewFile.summary && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-2">摘要</h3>
                  <p className="text-gray-800">{previewFile.summary}</p>
                </div>
              )}

              {previewFile.notes && (
                <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span>💡</span> 我的笔记
                  </h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{previewFile.notes}</p>
                </div>
              )}

              <div className="prose max-w-none mb-8">
                {previewFile.content ? (
                  <div
                    className="text-gray-900 whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewFile.content.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <div className="text-gray-600 text-center py-8">
                    <p>暂无内容</p>
                  </div>
                )}
              </div>

              {/* 附件预览区域 */}
              {parseAttachments(previewFile.attachments).length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📎 附件 ({parseAttachments(previewFile.attachments).length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {parseAttachments(previewFile.attachments).map((file, index) => {
                      const fileType = inferFileType(file);
                      const isPreviewable = fileType.startsWith('image/') || fileType.startsWith('video/') || fileType.includes('pdf');

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                          onClick={() => {
                            if (isPreviewable) {
                              setAttachmentToPreview(file);
                            } else {
                              const link = document.createElement('a');
                              link.href = getAttachmentUrl(file.url);
                              link.target = '_blank';
                              link.download = file.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                        >
                          <div className="text-2xl">
                            {getFileIcon(fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{file.name}</div>
                            <div className="text-sm text-gray-600">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                          <div className="text-blue-600">
                            {isPreviewable ? '👁️' : '📥'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end bg-gray-50">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Attachment Preview Modal */}

            {attachmentToPreview && (

              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[1002] p-4" onClick={() => setAttachmentToPreview(null)}>

                <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full h-full" onClick={(e) => e.stopPropagation()}>

                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">

                    <h2 className="text-lg font-bold text-gray-900 truncate">{attachmentToPreview.name}</h2>

                    <button

                      onClick={() => setAttachmentToPreview(null)}

                      className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"

                    >

                      ✕

                    </button>

                  </div>

                  <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center">

                    {inferFileType(attachmentToPreview).startsWith('image/') && (

                      <img src={getAttachmentUrl(attachmentToPreview.url)} alt={attachmentToPreview.name} className="w-full h-full object-contain" />

                    )}

                    {inferFileType(attachmentToPreview).startsWith('video/') && (

                      <video src={getAttachmentUrl(attachmentToPreview.url)} controls autoPlay className="w-full h-full object-contain" />

                    )}

                    {inferFileType(attachmentToPreview).includes('pdf') && (

                      <iframe src={getAttachmentUrl(attachmentToPreview.url)} className="w-full h-full" title={attachmentToPreview.name} />

                    )}

                  </div>

                </div>

              </div>

            )}

      {/* Win11风格右键菜单 */}
      <Win11ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        onClose={handleContextMenuClose}
        onAction={handleContextMenuAction}
        items={
          contextMenu.type === 'folder'
            ? [
                // 公开/不公开（依据 is_public）
                contextMenu.data && contextMenu.data.is_public === 1
                  ? { icon: '🔒', label: '不公开', actionType: 'togglePublic' }
                  : { icon: '🌐', label: '公开', actionType: 'togglePublic' },
                // 显示/隐藏（依据 is_hidden）
                contextMenu.data && contextMenu.data.is_hidden === 1
                  ? { icon: '👁️', label: '显示', actionType: 'toggleVisibility' }
                  : { icon: '🙈', label: '隐藏', actionType: 'toggleVisibility' },
                { icon: '✏️', label: '修改名称', actionType: 'rename' },
                { icon: '➕', label: '添加文档', actionType: 'addArticle' },
                { icon: '🗑️', label: '删除', actionType: 'delete' }
              ]
            : contextMenu.type === 'file'
            ? [
              { icon: '👁️', label: '预览', actionType: 'preview' },
              contextMenu.data && contextMenu.data.is_public === 1
                ? { icon: '🔒', label: '设为不公开', actionType: 'togglePublic' }
                : { icon: '🌐', label: '设为公开', actionType: 'togglePublic' },
              { icon: '📂', label: '移动到', actionType: 'move' },
              { icon: '🗑️', label: '删除', actionType: 'delete' }
            ]
            : []
        }
      />

      {/* 删除分类确认模态框 */}
      {showDeleteCategoryModal && categoryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">删除分类</h2>
              <button
                onClick={() => {
                  setShowDeleteCategoryModal(false);
                  setCategoryToDelete(null);
                  setDeleteCategoryArticleCount(0);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-800">
                确定要删除分类
                <span className="font-semibold mx-1">{categoryToDelete.name}</span>
                吗？
              </p>
              {deleteCategoryArticleCount > 0 && (
                <p className="text-sm text-gray-600">
                  该分类下有 <span className="font-semibold">{deleteCategoryArticleCount}</span> 篇文档，这些文档将随分类一起移至回收站。
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteCategoryModal(false);
                    setCategoryToDelete(null);
                    setDeleteCategoryArticleCount(0);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '删除中...' : '确定删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除文档确认模态框 */}
      {showDeleteArticleModal && articleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">删除文档</h2>
              <button
                onClick={() => {
                  setShowDeleteArticleModal(false);
                  setArticleToDelete(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-800">
                确定要删除文档
                <span className="font-semibold mx-1">{articleToDelete.title}</span>
                吗？删除后可以在回收站中恢复。
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteArticleModal(false);
                    setArticleToDelete(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteArticle}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '删除中...' : '确定删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-Previewable File Modal */}
      {nonPreviewableFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">文件操作</h2>
              <button
                onClick={() => setNonPreviewableFile(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="text-center space-y-3">
              <div className="text-5xl">
                {getFileIcon(inferFileType(nonPreviewableFile))}
              </div>
              <p className="font-medium text-gray-900 truncate">{nonPreviewableFile.name}</p>
              <p className="text-sm text-gray-500">此文件不支持在线预览。</p>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = getAttachmentUrl(nonPreviewableFile.url);
                  link.target = '_blank';
                  link.download = nonPreviewableFile.name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setNonPreviewableFile(null);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>📥</span>
                <span>下载文件</span>
              </button>
              <button
                onClick={() => setNonPreviewableFile(null)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveToMyKnowledgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">保存到我的知识库</h2>
              <button
                onClick={() => {
                  setShowSaveToMyKnowledgeModal(false);
                  setSelectedArticleToSave(null);
                  setTargetCategory('');
                  setNewCategoryName('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {selectedArticleToSave && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 truncate">{selectedArticleToSave.title}</h3>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">选择分类</label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">选择现有分类</option>
                  {myKnowledgeCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="new">新建分类</option>
                </select>
              </div>

              {targetCategory === 'new' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">新分类名称 *</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="请输入分类名称"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowSaveToMyKnowledgeModal(false);
                    setSelectedArticleToSave(null);
                    setTargetCategory('');
                    setNewCategoryName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveToMyKnowledge}
                  disabled={loading || !targetCategory || (targetCategory === 'new' && !newCategoryName.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMoveArticleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">移动文档到分类</h2>
              <button
                onClick={() => {
                  setShowMoveArticleModal(false);
                  setArticleToMove(null);
                  setMoveTargetCategory('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {articleToMove && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 truncate">{articleToMove.title}</h3>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">目标分类</label>
                <select
                  value={moveTargetCategory}
                  onChange={(e) => setMoveTargetCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">未分类</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowMoveArticleModal(false);
                    setArticleToMove(null);
                    setMoveTargetCategory('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleMoveArticle}
                  disabled={loading || !articleToMove}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '移动中...' : '确定移动'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重命名分类模态框 */}
      {showRenameCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">重命名分类</h2>
              <button
                onClick={() => {
                  setShowRenameCategoryModal(false);
                  setRenamingCategory(null);
                  setRenameCategoryName('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新的分类名称 *
                </label>
                <input
                  type="text"
                  value={renameCategoryName}
                  onChange={(e) => setRenameCategoryName(e.target.value)}
                  placeholder="请输入新的分类名称"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowRenameCategoryModal(false);
                    setRenamingCategory(null);
                    setRenameCategoryName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleRenameCategory}
                  disabled={loading || !renameCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建文档模态框 */}
      {showCreateArticleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>{editingArticle ? '编辑文档' : '新建文档'}</span>
                  {creatingCategory && !editingArticle && (
                    <span className="text-sm font-normal text-gray-600">（所属分类：{creatingCategory.name}）</span>
                  )}
                </h2>
                <p className="text-xs text-gray-500 mt-1">标题、摘要、内容、类型、状态、图标和附件均可在此配置。</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateArticleModal(false);
                  setCreatingCategory(null);
                  setEditingArticle(null);
                  setArticleFormData({
                    title: '',
                    category_id: '',
                    summary: '',
                    content: '',
                    type: 'common',
                    status: 'published',
                    icon: '📄',
                    attachments: []
                  });
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">
              {/* 顶部：标题 + 发布状态 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">标题 *</label>
                  <input
                    type="text"
                    value={articleFormData.title}
                    onChange={(e) => setArticleFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="请输入文档标题"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">发布状态</label>
                  <select
                    value={articleFormData.status}
                    onChange={(e) => setArticleFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                  >
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">附件</label>
                <div
                  className="border border-dashed border-gray-300 rounded-lg p-4 bg-white flex flex-col gap-3 text-sm text-gray-600"
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📂</span>
                      <div>
                        <div>拖拽文件到此区域即可上传</div>
                        <div className="text-xs text-gray-400">支持图片、PDF、Office 等常见格式</div>
                      </div>
                    </div>
                    <label className="self-start md:self-auto px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer inline-flex items-center gap-1">
                      <span>📎</span>
                      <span>{uploadingFiles ? '上传中...' : '选择文件'}</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFiles}
                      />
                    </label>
                  </div>

                  {articleFormData.attachments && articleFormData.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {articleFormData.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 rounded px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{getFileIcon(inferFileType(file))}</span>
                            <span className="truncate max-w-xs" title={file.name}>{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(index)}
                            className="text-gray-400 hover:text-red-500 ml-3"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-white flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateArticleModal(false);
                  setCreatingCategory(null);
                  setEditingArticle(null);
                  setArticleFormData({
                    title: '',
                    category_id: '',
                    summary: '',
                    content: '',
                    type: 'common',
                    status: 'published',
                    icon: '📄',
                    attachments: []
                  });
                }}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleCreateArticle}
                disabled={loading || !articleFormData.title.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建分类模态框 */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新建分类</h2>
              <button
                onClick={() => {
                  setShowCreateCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分类名称 *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="请输入分类名称"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateCategory}
                  disabled={loading || !newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Win11KnowledgeFolderView;
