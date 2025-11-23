﻿import React, { useState, useEffect, useCallback } from 'react';
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import Win11ContextMenu from './Win11ContextMenu';

const Win11KnowledgeBase = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [currentFolderCategory, setCurrentFolderCategory] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('card'); // For articles
  const [articleTotalPages, setArticleTotalPages] = useState(1);
  const [totalArticleItems, setTotalArticleItems] = useState(0);

  const [categoryViewMode, setCategoryViewMode] = useState('card'); // For categories

  const [categoryCurrentPage, setCategoryCurrentPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);
  const [categoryTotalPages, setCategoryTotalPages] = useState(1);
  const [totalCategoryItems, setTotalCategoryItems] = useState(0);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    article: null
  });

  // 保存到我的知识库状态
  const [showSaveToMyKnowledgeModal, setShowSaveToMyKnowledgeModal] = useState(false);
  const [selectedArticleToSave, setSelectedArticleToSave] = useState(null);
  const [targetCategory, setTargetCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [myKnowledgeCategories, setMyKnowledgeCategories] = useState([]);

  // 新建分类状态
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);

  // 移动文档状态
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedArticleToMove, setSelectedArticleToMove] = useState(null);
  const [targetMoveCategory, setTargetMoveCategory] = useState('');

  // 预览文档
  const [previewFile, setPreviewFile] = useState(null);
  const [previewModalWidth, setPreviewModalWidth] = useState('max-w-4xl');
  const [previewModalHeight, setPreviewModalHeight] = useState('max-h-[95vh]');
  const [attachmentToPreview, setAttachmentToPreview] = useState(null);
  const [nonPreviewableFile, setNonPreviewableFile] = useState(null);

  const getToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  };

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

  useEffect(() => {
    fetchCategories();
  }, [categoryCurrentPage, categoryPageSize]);

  useEffect(() => {
    fetchArticles();
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchMyKnowledgeCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl(`/api/knowledge/categories?page=${categoryCurrentPage}&pageSize=${categoryPageSize}`));
      console.log('Categories API Response:', response.data);
      let categoriesData = response.data || [];
      let totalItems = 0;
      if (response.data && Array.isArray(response.data.data)) {
        categoriesData = response.data.data;
        totalItems = response.data.total || categoriesData.length;
      } else if (Array.isArray(response.data)) {
        categoriesData = response.data;
        totalItems = categoriesData.length;
      }
      const uid = getCurrentUserId();
      const filtered = (categoriesData || []).filter(c => {
        const t = String(c?.type || '').toLowerCase();
        const notDeleted = !c.deleted_at && c.status !== 'deleted' && c.is_deleted !== 1;
        return t === 'common' && notDeleted && c.is_public === 1 && isPublished(c);
      });
      setCategories(filtered);
      // 使用过滤后的数据长度计算分页
      const filteredTotalItems = filtered.length;
      setTotalCategoryItems(filteredTotalItems);
      const calculatedTotalPages = Math.ceil(filteredTotalItems / categoryPageSize);
      setCategoryTotalPages(calculatedTotalPages);
      console.log('Pagination Debug: totalItems =', totalItems, 'categoryPageSize =', categoryPageSize, 'calculatedTotalPages =', calculatedTotalPages);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };
  const handleMoveArticle = async () => {
    if (!selectedArticleToMove || !targetMoveCategory) return;
    setLoading(true);
    try {
      const articleRes = await axios.get(getApiUrl(`/api/knowledge/articles/${selectedArticleToMove.id}`));
      const articleData = articleRes.data;
      await axios.put(getApiUrl(`/api/knowledge/articles/${selectedArticleToMove.id}`), {
        ...articleData,
        category_id: targetMoveCategory
      });
      toast.success('移动成功');
      setShowMoveModal(false);
      setSelectedArticleToMove(null);
      setTargetMoveCategory('');
      fetchArticles();
    } catch (error) {
      console.error('移动失败:', error);
      toast.error('移动失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(getApiUrl(`/api/knowledge/articles?page=${currentPage}&pageSize=${pageSize}`));
      console.log('Articles API Response:', response.data);
      let articlesData = response.data || [];
      let totalItems = 0;

      if (response.data && Array.isArray(response.data.data)) {
        articlesData = response.data.data;
        totalItems = response.data.total || articlesData.length;
      } else if (Array.isArray(response.data)) {
        articlesData = response.data;
        totalItems = articlesData.length;
      } else if (typeof articlesData === 'object') {
        articlesData = articlesData.data || [];
        totalItems = articlesData.total || articlesData.length;
      }

      const filtered = (articlesData || []).filter(a => {
        // 只显示公开的文档 (is_public === 1)
        return a.is_public === 1 && isPublished(a) && isNotDeleted(a);
      });
      setArticles(filtered);
      // 使用过滤后的数据长度计算分页
      const filteredTotalItems = filtered.length;
      setTotalArticleItems(filteredTotalItems);
      setArticleTotalPages(Math.ceil(filteredTotalItems / pageSize));
    } catch (error) {
      console.error('获取文档失败:', error);
      toast.error('获取文档失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewArticle = async (article) => {
    setSelectedArticle(article);
    setShowArticleModal(true);

    // 增加浏览量
    try {
      await axios.post(getApiUrl(`/api/knowledge/articles/${article.id}/view`));
      // 刷新文章列表以更新浏览量
      fetchArticles();
    } catch (error) {
      console.error('更新浏览量失败:', error);
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

  // 打开文件夹
  const handleOpenFolder = (category) => {
    setCurrentFolderCategory(category);
    setCurrentPage(1);
  };

  // 关闭文件夹视图
  const closeFolderView = () => {
    setCurrentFolderCategory(null);
    setCurrentPage(1);
  };

  // 获取当前文件夹的文档 - 使用 useMemo
  const folderArticles = React.useMemo(() => {
    if (!currentFolderCategory) return [];

    const categoryArticles = currentFolderCategory.id === 'uncategorized'
      ? articles.filter(a => !a.category_id)
      : articles.filter(a => a.category_id == currentFolderCategory.id);

    // 使用主搜索框的搜索词进行过滤
    let filtered = categoryArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    // 排序
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
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
  }, [currentFolderCategory, articles, searchTerm, sortBy, sortOrder]);

  // 计算分页数据
  const folderTotalItems = folderArticles.length;
  const folderTotalPages = Math.ceil(folderTotalItems / pageSize);

  // 分页计算 (logic moved to getCurrentFolderArticles and state variables)

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
        icon: '📁',
        // 公共分类不设置owner_id,这样才不会在"我的知识库"中显示
        type: 'common',
        is_public: 1
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

  // 删除分类处理函数
  const handleDeleteCategory = async (categoryId) => {
    // 获取该分类下的文档数量
    const categoryArticles = articles.filter(a => a.category_id == categoryId);

    // 如果分类下有文档，需要用户确认
    if (categoryArticles.length > 0) {
      if (!window.confirm(`该分类下有 ${categoryArticles.length} 篇文档，删除分类后这些文档将变为未分类。确定要删除吗？`)) {
        return;
      }
    } else {
      if (!window.confirm('确定要删除这个分类吗？')) {
        return;
      }
    }

    try {
      await axios.delete(getApiUrl(`/api/knowledge/categories/${categoryId}`));
      toast.success('分类删除成功');
      fetchCategories(); // 重新获取分类列表
    } catch (error) {
      console.error('删除分类失败:', error);
      toast.error('删除分类失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 处理分类显示/隐藏
  const handleToggleCategoryVisibility = async (categoryId, isHidden) => {
    try {
      await axios.put(getApiUrl(`/api/knowledge/categories/${categoryId}/visibility`), { is_hidden: isHidden });
      toast.success(isHidden === 1 ? '分类已隐藏' : '分类已显示');
      // 重新获取分类列表
      fetchCategories();
    } catch (error) {
      console.error('更新分类可见性失败:', error);
      toast.error('操作失败');
    }
  };

 // 按分类分组文档并排序 - 合并到一个 useMemo 避免循环依赖
  const { articlesByCategory, uncategorizedArticles, sortedCategories, filteredCategories } = React.useMemo(() => {
    // 1. 先分组文档
    const byCategory = {};
    const uncategorized = [];

    articles.forEach(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return;
      if (article.category_id) {
        if (!byCategory[article.category_id]) {
          byCategory[article.category_id] = [];
        }
        byCategory[article.category_id].push(article);
      } else {
        uncategorized.push(article);
      }
    });

    // 2. 排序分类
    const sorted = [...categories].sort((a, b) => {
      if (sortBy === 'name') {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      return 0;
    });

    // 3. 过滤分类
    const filtered = sorted.filter(category => {
      const categoryArticles = byCategory[category.id] || [];
      if (searchTerm) {
        return category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               categoryArticles.some(article =>
                 article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 article.summary?.toLowerCase().includes(searchTerm.toLowerCase())
               );
      }
      return true;
    });

    return {
      articlesByCategory: byCategory,
      uncategorizedArticles: uncategorized,
      sortedCategories: sorted,
      filteredCategories: filtered
    };
  }, [articles, categories, searchTerm, sortBy, sortOrder]);

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
      article: null
    });
  };

  const handleContextMenuAction = (item) => {
    if (!contextMenu.article) return;

    switch (item.action) {
      case 'preview': {
        const article = contextMenu.article;
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
      // 'saveToMyKnowledge' action is now handled by a dedicated button in the preview modal
      default:
        break;
    }

    handleContextMenuClose();
  };

  // 处理背景右键菜单
  const handleBackgroundContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: 'background',
      data: null
    });
  };

  // 获取我的知识库分类
  const fetchMyKnowledgeCategories = async () => {
    try {
      const userId = getCurrentUserId();
      const response = await axios.get(getApiUrl(`/api/my-knowledge/categories?userId=${userId}`));
      // 过滤只显示我的分类
      const myCategories = (response.data || []).filter(c => {
        const isMine = c.owner_id && String(c.owner_id) === String(userId);
        return isMine && isNotDeleted(c);
      });
      setMyKnowledgeCategories(myCategories);
    } catch (error) {
      console.error('获取我的知识库分类失败:', error);
    }
  };

  // 保存到我的知识库
  const handleSaveToMyKnowledge = async () => {
    if (!selectedArticleToSave) return;

    try {
      setLoading(true);
      let categoryId = targetCategory;

      // 如果选择了新建分类
      if (targetCategory === 'new' && newCategoryName.trim()) {
        // 创建新分类
        const userId = getCurrentUserId();
        const categoryResponse = await axios.post(getApiUrl('/api/my-knowledge/categories'), {
          name: newCategoryName.trim(),
          description: '',
          icon: '📁',
          type: 'personal',
          is_public: 0,
          owner_id: userId
        });
        categoryId = categoryResponse.data.id;

        toast.success(`分类 "${newCategoryName.trim()}" 创建成功`);

        // 重新获取我的知识库分类列表
        fetchMyKnowledgeCategories();
      }

      // 保存文档到我的知识库
      const userId = getCurrentUserId();
      const response = await axios.post(getApiUrl('/api/my-knowledge/articles/save'), {
        articleId: selectedArticleToSave.id,
        categoryId: categoryId !== 'new' ? categoryId : null,
        notes: '', // 暂时留空，可以根据需要添加备注功能
        userId: userId
      });

      if (response.data.success) {
        toast.success(`文档 "${selectedArticleToSave.title}" 已保存到我的知识库`);
      }

      // 关闭模态框
      setShowSaveToMyKnowledgeModal(false);
      setSelectedArticleToSave(null);
      setTargetCategory('');
      setNewCategoryName('');
    } catch (error) {
      console.error('保存到我的知识库失败:', error);
      toast.error('保存失败: ' + (error.response?.data?.error || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 渲染文件预览
  const renderFilePreview = (article) => {
    // 获取附件信息
    const attachments = article.attachments ?
      (Array.isArray(article.attachments) ? article.attachments :
       typeof article.attachments === 'string' ? JSON.parse(article.attachments) :
       []) : [];

    if (attachments.length === 0) {
      // 如果没有附件，显示文章内容
      return article.content ? (
        <div
          className="text-gray-900 whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br/>') }}
        />
      ) : (
        <div className="text-gray-600 text-center py-8">
          <p>暂无内容</p>
        </div>
      );
    }

    // 获取第一个附件
    const attachment = attachments[0];
    const fileType = inferFileType(attachment); // Use inferFileType
    const fileUrl = getAttachmentUrl(attachment.url || attachment.path || '');

    // 根据文件类型渲染预览
    if (fileType.includes('pdf')) {
      // PDF预览
      return (
        <div className="w-full h-full" style={{ minHeight: '600px' }}>
          <iframe
            src={`${fileUrl}#view=fit`}
            className="w-full h-full border border-gray-300 rounded-lg"
            title="PDF预览"
          />
        </div>
      );
    } else if (fileType.startsWith('image/')) {
      // 图片预览
      return (
        <div className="flex justify-center w-full h-full">
          <img
            src={fileUrl}
            alt={attachment.name || '图片预览'}
            className="max-w-full max-h-full object-contain border border-gray-300 rounded-lg"
          />
        </div>
      );
    } else if (fileType.startsWith('video/')) {
      // 视频预览
      return (
        <div className="flex justify-center w-full h-full">
          <video
            src={fileUrl}
            controls
            className="max-w-full max-h-full border border-gray-300 rounded-lg"
          >
            您的浏览器不支持视频播放。
          </video>
        </div>
      );
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      // PPT预览 - 简单显示下载链接
      return (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📽️</div>
          <p className="text-gray-700 mb-4">这是一个演示文稿文件</p>
          <a
            href={fileUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>📥</span>
            <span>下载文件</span>
          </a>
        </div>
      );
    } else if (fileType.includes('word') || fileType.includes('document') ||
               fileType.includes('excel') || fileType.includes('sheet')) {
      // Office文档预览 - 显示下载链接
      return (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">
            {fileType.includes('word') || fileType.includes('document') ? '📝' : '📊'}
          </div>
          <p className="text-gray-700 mb-4">这是一个Office文档</p>
          <a
            href={fileUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>📥</span>
            <span>下载文件</span>
          </a>
        </div>
      );
    } else {
      // 其他文件类型 - 显示下载链接
      return (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📎</div>
          <p className="text-gray-700 mb-4">这是一个文件附件</p>
          <a
            href={fileUrl}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>📥</span>
            <span>下载文件</span>
          </a>
        </div>
      );
    }
  };

  // 视图模式切换
  const handleViewModeChange = (mode) => {
    console.log('切换视图模式:', mode);
    setViewMode(mode);
  };

  // 关闭预览文件
  const handleClosePreview = () => {
    setPreviewFile(null);
    setIsFullscreen(false); // 退出全屏模式
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-100">
      {/* 顶部操作栏 */}
      <div className="mb-6">
        <div className="bg-green-50 rounded-lg shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-start">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 flex-shrink-0">
              <div className="w-12 h-12 flex items-center justify-center rounded-md bg-gray-100 text-gray-700 text-3xl">📂</div>
              知识库
            </h1>

            {/* 搜索框和操作按钮 */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-stretch ml-4">
              {/* 搜索框 */}
              <div className="relative flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder={currentFolderCategory
                    ? `在 ${currentFolderCategory.name} 中搜索...`
                    : '搜索所有文档...'}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    // Reset pagination for articles when search term changes
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                {/* 公共知识库不需要添加分类和添加文档功能 */}

                {/* View mode buttons for categories */}
                {!currentFolderCategory && (
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

                {/* View mode buttons for articles inside a folder */}
                {currentFolderCategory && (
                  <>
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
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 whitespace-nowrap">排序:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[120px]"
                      >
                        <option value="name">名称</option>
                        <option value="date">日期</option>
                        <option value="views">浏览量</option>
                      </select>

                      <button
                        onClick={() => {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title={sortOrder === 'asc' ? '升序' : '降序'}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 whitespace-nowrap">每页:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[100px]"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Items per page for categories */}
                {!currentFolderCategory && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 whitespace-nowrap">每页:</span>
                    <select
                      value={categoryPageSize}
                      onChange={(e) => {
                        setCategoryPageSize(Number(e.target.value));
                        setCategoryCurrentPage(1);
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[100px]"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={30}>30</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
        {currentFolderCategory ? (
          // 文件夹内容视图
          <div className="flex-1 flex flex-col h-full">
            {/* 文件夹头部 */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-gray-50">
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

            {/* 文件列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </div>
                </div>
              ) : totalArticleItems === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-500">
                    {searchTerm ? '没有找到匹配的文档' : '此文件夹为空'}
                  </p>
                </div>
              ) : viewMode === 'card' ? (
                // 卡片视图
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {folderArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(article => {
                    const firstAttachment = parseAttachments(article.attachments)[0];
                    const resolvedType = inferFileType(firstAttachment);
                    return (
                      <div
                        key={article.id}
                        className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center border border-gray-200 rounded-lg shadow-sm"
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
                        onContextMenu={(e) => handleContextMenu(e, 'file', article)}
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
                // 列表视图
                <div className="space-y-3">
                  {folderArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(article => {
                    const firstAttachment = parseAttachments(article.attachments)[0];
                    const resolvedType = inferFileType(firstAttachment);
                    return (
                      <div
                        key={article.id}
                        className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex items-center gap-4 border border-gray-200 rounded-lg shadow-sm"
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
                        onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                      >
                        <div className="text-2xl flex-shrink-0 transform hover:scale-110 transition-transform duration-200">
                          {getFileIcon(resolvedType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {article.title}
                          </h3>
                          {article.summary && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                              {article.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span>👁️ {article.view_count || 0}</span>
                            <span>📅 {formatDate(article.created_at)}</span>
                          </div>
                          {firstAttachment && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <span>{getFileIcon(resolvedType)}</span>
                              <span>{getFileTypeName(resolvedType)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 文章分页 */}
            {folderTotalPages > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      共 {folderTotalItems} 个文档，第 {currentPage} / {folderTotalPages} 页
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

                    {[...Array(Math.min(5, folderTotalPages))].map((_, i) => {
                      let pageNum;
                      const totalPages = folderTotalPages;
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
                      onClick={() => setCurrentPage(p => Math.min(folderTotalPages, p + 1))}
                      disabled={currentPage === folderTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(folderTotalPages)}
                      disabled={currentPage === folderTotalPages}
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
          <div className="flex-1 flex flex-col">
            {/* 文件夹网格 */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </div>
                </div>
              ) : totalCategoryItems === 0 && uncategorizedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-gray-500">{searchTerm ? '没有找到匹配的文件夹或文档' : '暂无文件夹'}</p>
                </div>
              ) : categoryViewMode === 'card' ? (
                // 卡片视图
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {/* 分类文件夹 */}
                  {categories
                    .filter(cat => cat.status !== 'draft')
                    .slice((categoryCurrentPage - 1) * categoryPageSize, categoryCurrentPage * categoryPageSize)
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
                          <div className="w-24 h-24 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 text-6xl mb-3">📂</div>
                          <h3 className="font-medium text-gray-900 text-center line-clamp-2 text-base">{category.name}</h3>
                        </div>
                      );
                    })}

                  {/* 未分类文档 */}
                  {uncategorizedArticles.length > 0 && (
                    <div
                      className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center relative border border-gray-100 rounded-lg"
                      onClick={() => handleOpenFolder({
                        id: 'uncategorized',
                        name: '未分类',
                        icon: '📂'
                      })}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', {
                        id: 'uncategorized',
                        name: '未分类',
                        icon: '📂'
                      })}
                    >
                      <div className="w-24 h-24 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 text-6xl mb-3">📂</div>
                      <h3 className="font-medium text-gray-900 text-center text-base">未分类</h3>
                    </div>
                  )}
                </div>
              ) : (
                // 列表视图
                <div className="space-y-3">
                  {/* 分类文件夹 */}
                  {categories
                    .filter(cat => cat.status !== 'draft')
                    .slice((categoryCurrentPage - 1) * categoryPageSize, categoryCurrentPage * categoryPageSize)
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
                      onClick={() => handleOpenFolder({
                        id: 'uncategorized',
                        name: '未分类',
                        icon: '📂'
                      })}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', {
                        id: 'uncategorized',
                        name: '未分类',
                        icon: '📂'
                      })}
                    >
                      <div className="text-4xl flex-shrink-0">📂</div>
                      <h3 className="font-medium text-gray-900 truncate">未分类</h3>
                    </div>
                  )}
                </div>
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
                  <span className="flex items-center gap-1">👤 {previewFile.author_name || '未知'}</span>
                  <span className="flex items-center gap-1">📅 {formatDate(previewFile.created_at)}</span>
                  <span className="flex items-center gap-1">👁️ {previewFile.view_count || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 添加到我的知识库按钮 */}
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

              {/* 文件预览区域 */}
              <div className="prose max-w-none mb-8">
                {renderFilePreview(previewFile)}
              </div>
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

      {/* 保存到我的知识库模态框 */}
      {showSaveToMyKnowledgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1002] p-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择分类
                </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新分类名称 *
                  </label>
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
                { icon: '📂', label: '打开', action: () => handleOpenFolder(contextMenu.data) }
              ]
            : contextMenu.type === 'file'
            ? [
                { icon: '👁️', label: '预览', action: () => handleContextMenuAction({ action: 'preview' }) },
                { icon: '➡️', label: '移动到...', action: () => {
                    setSelectedArticleToMove(contextMenu.data);
                    setShowMoveModal(true);
                  }
                },
                { icon: '💾', label: '保存到我的知识库', action: () => {
                    setSelectedArticleToSave(contextMenu.data);
                    setShowSaveToMyKnowledgeModal(true);
                  }
                }
              ]
            : contextMenu.type === 'background'
            ? [
                { icon: '📁', label: '新建分类', action: () => setShowCreateCategoryModal(true) }
              ]
            : []
        }
      />

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

      {/* 移动文档模态框 */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">移动文档</h2>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedArticleToMove(null);
                  setTargetMoveCategory('');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择目标分类
                </label>
                <select
                  value={targetMoveCategory}
                  onChange={(e) => setTargetMoveCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择分类...</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setSelectedArticleToMove(null);
                    setTargetMoveCategory('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleMoveArticle}
                  disabled={loading || !targetMoveCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '移动中...' : '移动'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Win11KnowledgeBase;
