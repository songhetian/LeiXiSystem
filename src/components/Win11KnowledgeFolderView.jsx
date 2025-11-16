import React, { useState, useEffect } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // 新建分类状态
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 预览文档
  const [previewFile, setPreviewFile] = useState(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '', // 'folder', 'file' or 'background'
    data: null
  });

  // 添加调整弹出框宽高的状态
  const [previewModalWidth, setPreviewModalWidth] = useState('max-w-6xl');
  const [previewModalHeight, setPreviewModalHeight] = useState('max-h-[95vh]');

  useEffect(() => {
    fetchCategories();
    fetchArticles();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/my-knowledge/categories'));
      console.log('Folder Categories API Response:', response.data); // 调试信息
      // 确保返回的是数组
      let categoriesData = response.data || [];
      if (!Array.isArray(categoriesData) && categoriesData.data && Array.isArray(categoriesData.data)) {
        // 如果是分页数据结构 { data: [...], pagination: {...} }
        categoriesData = categoriesData.data;
      }
      setCategories(categoriesData);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(getApiUrl('/api/my-knowledge/articles'));
      console.log('Folder Articles API Response:', response.data); // 调试信息
      // 确保返回的是数组
      let articlesData = response.data || [];
      if (Array.isArray(articlesData)) {
        // 数据是数组，直接使用
      } else if (articlesData.data && Array.isArray(articlesData.data)) {
        // 如果是分页数据结构 { data: [...], pagination: {...} }
        articlesData = articlesData.data;
      } else if (typeof articlesData === 'object' && !Array.isArray(articlesData)) {
        // 如果是分页对象结构 { data: [...], total: ..., page: ... }
        articlesData = articlesData.data || [];
      } else {
        articlesData = [];
      }
      setArticles(articlesData);
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

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📎';
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
    setFolderSearchTerm('');
    setCurrentPage(1);
  };

  // 获取当前文件夹的文档
  const getCurrentFolderArticles = () => {
    if (!currentFolderCategory) return [];

    const categoryArticles = currentFolderCategory.id === 'uncategorized'
      ? articles.filter(a => !a.category_id)
      : articles.filter(a => a.category_id == currentFolderCategory.id);

    return categoryArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(folderSearchTerm.toLowerCase());
      return matchesSearch;
    });
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

  // 新建分类处理函数
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(getApiUrl('/api/my-knowledge/categories'), {
        name: newCategoryName,
        description: '',
        icon: '📁'
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
      await axios.delete(getApiUrl(`/api/my-knowledge/categories/${categoryId}`));
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
      await axios.put(getApiUrl(`/api/my-knowledge/categories/${categoryId}/visibility`), { is_hidden: isHidden });
      toast.success(isHidden === 1 ? '分类已隐藏' : '分类已显示');
      // 重新获取分类列表
      fetchCategories();
    } catch (error) {
      console.error('更新分类可见性失败:', error);
      toast.error('操作失败');
    }
  };

  // 按分类分组文档
  const articlesByCategory = {};
  const uncategorizedArticles = [];

  articles.forEach(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.summary?.toLowerCase().includes(searchTerm.toLowerCase());
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
        case 'open':
          handleOpenFolder(contextMenu.data);
          break;
        case 'delete':
          handleDeleteCategory(contextMenu.data.id);
          break;
        case 'toggleVisibility':
          handleToggleCategoryVisibility(contextMenu.data.id, contextMenu.data.is_hidden === 0 ? 1 : 0);
          break;
        default:
          break;
      }
    } else if (contextMenu.type === 'file') {
      switch (item.actionType) {
        case 'preview':
          setPreviewFile(contextMenu.data);
          break;
        case 'move':
          // 这里可以添加移动逻辑
          toast.info('移动功能待实现');
          break;
        case 'delete':
          // 这里可以添加删除逻辑
          toast.info('删除功能待实现');
          break;
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

  // 处理背景右键菜单
  const handleBackgroundContextMenu = (e) => {
    handleContextMenu(e, 'background', null);
  };

  // 关闭文件夹视图
  const closeFolderView = () => {
    setCurrentFolderCategory(null);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-100">
      {/* 顶部标题栏 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📁</span>
          知识文档
        </h1>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="搜索文档..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              🔍
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden" onContextMenu={handleBackgroundContextMenu}>
        {currentFolderCategory ? (
          // 文件夹内容视图
          <div className="flex-1 flex flex-col h-full" onContextMenu={handleBackgroundContextMenu}>
            {/* 文件夹头部 */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={closeFolderView}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                  title="返回上一级"
                >
                  ←
                </button>
                <span className="text-2xl">📁</span>
                <h2 className="text-xl font-semibold">{currentFolderCategory.name}</h2>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索..."
                    value={folderSearchTerm}
                    onChange={(e) => setFolderSearchTerm(e.target.value)}
                    className="px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    🔍
                  </div>
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center"
                      onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                      onClick={() => setPreviewFile(article)}
                    >
                      <div className="text-7xl mb-3">
                        📁
                      </div>
                      <h3 className="font-medium text-gray-900 text-center line-clamp-2 text-base">
                        {article.title}
                      </h3>
                      {article.notes && (
                        <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                          💡 有笔记
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 分页 */}
            {getTotalPages() > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    第 {currentPage} / {getTotalPages()} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← 上一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页 →
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {/* 分类文件夹 */}
                  {categories
                    .filter(cat => cat.status !== 'draft') // 只显示已发布的分类
                    .map(category => {
                      const categoryArticles = articlesByCategory[category.id] || [];
                      if (categoryArticles.length === 0 && searchTerm) return null;

                      return (
                        <div
                          key={category.id}
                          className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center relative"
                          onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                          onClick={() => handleOpenFolder(category)}
                        >
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCategoryVisibility(category.id, category.is_hidden === 1 ? 0 : 1);
                              }}
                              className="text-xs p-1 rounded hover:bg-gray-200"
                              title={category.is_hidden === 1 ? '显示分类' : '隐藏分类'}
                            >
                              {category.is_hidden === 1 ? '👁️' : '🙈'}
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
                          <div className="text-7xl mb-3">
                            📁
                          </div>
                          <h3 className="font-medium text-gray-900 text-center line-clamp-2 text-base">
                            {category.name}
                          </h3>
                          <div className="text-xs text-gray-500 mt-1">
                            📄 {categoryArticles.length}
                          </div>
                        </div>
                      );
                    })}

                  {/* 未分类文档 */}
                  {uncategorizedArticles.length > 0 && (
                    <div
                      className="bg-white p-4 hover:bg-gray-50 transition-all cursor-pointer group flex flex-col items-center relative"
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
                      <div className="text-7xl mb-3">📁</div>
                      <h3 className="font-medium text-gray-900 text-center text-base">未分类</h3>
                      <div className="text-xs text-gray-500 mt-1">
                        📄 {uncategorizedArticles.length}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                  <span className="flex items-center gap-1">📅 {new Date(previewFile.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">👁️ {previewFile.view_count || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 调整宽高按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const widths = ['max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl'];
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
                      const heights = ['max-h-[90vh]', 'max-h-[95vh]', 'max-h-[98vh]'];
                      const currentIndex = heights.indexOf(previewModalHeight);
                      const nextIndex = (currentIndex + 1) % heights.length;
                      setPreviewModalHeight(heights[nextIndex]);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-sm"
                    title="调整高度"
                  >
                    ↕️
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
                    {parseAttachments(previewFile.attachments).map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                        onClick={() => {
                          // 根据文件类型决定是预览还是下载
                          const link = document.createElement('a');
                          link.href = getAttachmentUrl(file.url);
                          link.target = '_blank';
                          link.download = file.name;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <div className="text-2xl">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{file.name}</div>
                          <div className="text-sm text-gray-600">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                        <div className="text-blue-600">
                          📥
                        </div>
                      </div>
                    ))}
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
                { icon: '📂', label: '打开', actionType: 'open' },
                { icon: '🗑️', label: '删除', actionType: 'delete' },
                contextMenu.data && contextMenu.data.is_hidden === 1
                  ? { icon: '👁️', label: '显示', actionType: 'toggleVisibility' }
                  : { icon: '🙈', label: '隐藏', actionType: 'toggleVisibility' }
              ]
            : contextMenu.type === 'file'
            ? [
                { icon: '👁️', label: '预览', actionType: 'preview' },
                { icon: '📂', label: '移动到', actionType: 'move' },
                { icon: '🗑️', label: '删除', actionType: 'delete' }
              ]
            : contextMenu.type === 'background'
            ? [
                { icon: '📁', label: '新建分类', actionType: 'newCategory' }
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
    </div>
  );
};

export default Win11KnowledgeFolderView;
