import React, { useState, useEffect, useRef } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import axios from 'axios'
import { categoryIcons } from '../utils/iconOptions'
import AdvancedSearch from './AdvancedSearch'
import { getApiUrl } from '../utils/apiConfig'
import FilePreviewModal from './FilePreviewModal'
import Win11ContextMenu from './Win11ContextMenu'
import useReadingTracker from '../hooks/useReadingTracker'

const MyKnowledgeBase = () => {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [currentFolderCategory, setCurrentFolderCategory] = useState(null)
  const [folderSearchTerm, setFolderSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryPageSize, setCategoryPageSize] = useState(8)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  // 移动分类
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [articleToMove, setArticleToMove] = useState(null)
  const [targetCategoryId, setTargetCategoryId] = useState('')

  // 删除确认模态框
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [articleToDelete, setArticleToDelete] = useState(null)

  // 预览文档
  const [previewFile, setPreviewFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const articleContentRef = useRef(null)

  // 添加调整弹出框宽高的状态
  const [articleModalWidth, setArticleModalWidth] = useState('max-w-4xl')
  const [articleModalHeight, setArticleModalHeight] = useState('max-h-[90vh]')
  const [previewModalWidth, setPreviewModalWidth] = useState('max-w-6xl')
  const [previewModalHeight, setPreviewModalHeight] = useState('max-h-[95vh]')

  // 高级搜索
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '', // 'folder' or 'file'
    data: null
  })

  // 添加缺失的状态定义
  const [showStats, setShowStats] = useState(false)
  const [articleStats, setArticleStats] = useState([])
  const [statsLoading, setStatsLoading] = useState(false)

  const fetchArticleStats = async () => {
    setStatsLoading(true)
    try {
      const res = await axios.get(getApiUrl('/api/knowledge/stats/reading'))
      setArticleStats(res.data.data || [])
    } catch (e) {
      toast.error('获取统计失败')
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (showStats) {
      fetchArticleStats()
    }
  }, [showStats])

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    icon: '📁'
  })

  useEffect(() => {
    fetchCategories()
    fetchArticles()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/my-knowledge/categories'))
      setCategories(response.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await axios.get(getApiUrl('/api/my-knowledge/articles'))
      setArticles(response.data || [])
    } catch (error) {
      console.error('获取文档失败:', error)
      toast.error('获取文档失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewArticle = (article) => {
    setSelectedArticle(article)
    setShowArticleModal(true)
  }

  useReadingTracker({ articleId: selectedArticle?.id, isOpen: !!showArticleModal && !!selectedArticle, contentRef: articleContentRef })

  const handleDeleteArticle = (article) => {
    setArticleToDelete(article)
    setShowDeleteModal(true)
  }

  const confirmDeleteArticle = async () => {
    if (!articleToDelete) return

    try {
      await axios.post(getApiUrl(`/api/knowledge/articles/${articleToDelete.id}/soft-delete`))
      toast.success('已移至回收站')
      setShowDeleteModal(false)
      setArticleToDelete(null)
      fetchArticles()
      setShowFolderModal(false)
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
    }
  }

  const parseAttachments = (attachments) => {
    if (!attachments) return []
    if (Array.isArray(attachments)) return attachments
    if (typeof attachments === 'string') {
      try {
        return JSON.parse(attachments)
      } catch (e) {
        return []
      }
    }
    return []
  }

  const handleMoveArticle = (article) => {
    setArticleToMove(article)
    setTargetCategoryId(article.category_id || '')
    setShowMoveModal(true)
  }

  const confirmMoveArticle = async () => {
    if (!articleToMove) return

    try {
      await axios.put(getApiUrl(`/api/knowledge/articles/${articleToMove.id}`), {
        ...articleToMove,
        category_id: targetCategoryId || null
      })

      toast.success('文档已移动')
      setShowMoveModal(false)
      setArticleToMove(null)
      setTargetCategoryId('')
      fetchArticles()
      setShowFolderModal(false)
    } catch (error) {
      console.error('移动文档失败:', error)
      toast.error('移动文档失败')
    }
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingCategory) {
        await axios.put(getApiUrl(`/api/my-knowledge/categories/${editingCategory.id}`), categoryFormData)
        toast.success('分类更新成功')
      } else {
        await axios.post(getApiUrl('/api/my-knowledge/categories'), categoryFormData)
        toast.success('分类创建成功')
      }
      setShowCategoryModal(false)
      resetCategoryForm()
      fetchCategories()
    } catch (error) {
      console.error('分类操作失败:', error)
      toast.error(editingCategory ? '更新失败' : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    const categoryArticles = articles.filter(a => a.category_id == categoryId)

    if (categoryArticles.length > 0) {
      if (!window.confirm(`该分类下有 ${categoryArticles.length} 篇文档，删除分类后这些文档将变为未分类。确定要删除吗？`)) {
        return
      }
    } else {
      if (!window.confirm('确定要删除这个分类吗？')) {
        return
      }
    }

    try {
      await axios.delete(getApiUrl(`/api/my-knowledge/categories/${categoryId}`))
      toast.success('分类删除成功')
      fetchCategories()
      fetchArticles()
    } catch (error) {
      console.error('删除分类失败:', error)
      toast.error('删除分类失败')
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      icon: '📁'
    })
    setEditingCategory(null)
  }

  // 右键菜单处理函数
  const handleContextMenu = (e, type, data) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data
    })
  }

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      type: '',
      data: null
    })
  }

  const handleContextMenuAction = (item) => {
    if (contextMenu.type === 'folder') {
      switch (item.actionType) {
        case 'open':
          handleOpenFolder(contextMenu.data)
          break
        case 'edit':
          setEditingCategory(contextMenu.data)
          setCategoryFormData({
            name: contextMenu.data.name,
            description: contextMenu.data.description || '',
            icon: contextMenu.data.icon || '📁'
          })
          setShowCategoryModal(true)
          break
        case 'delete':
          handleDeleteCategory(contextMenu.data.id)
          break
        default:
          break
      }
    } else if (contextMenu.type === 'file') {
      switch (item.actionType) {
        case 'preview':
          setPreviewFile(contextMenu.data)
          break
        case 'view':
          handleViewArticle(contextMenu.data)
          break
        case 'move':
          handleMoveArticle(contextMenu.data)
          break
        case 'delete':
          handleDeleteArticle(contextMenu.data)
          break
        default:
          break
      }
    }
  }

  const getFileIcon = (article) => {
    const atts = parseAttachments(article.attachments);
    if (atts.length === 0) return '📝';
    const ext = atts[0].name?.split('.').pop().toLowerCase() || '';
    const icons = {
      pdf: '📄', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
      ppt: '📙', pptx: '📙', jpg: '🖼️', png: '🖼️', mp4: '🎬',
      zip: '📦', rar: '📦'
    };
    return icons[ext] || '📎';
  }

  const handleEnhancedPreview = (article) => {
    const atts = parseAttachments(article.attachments);
    if (atts.length > 0) {
      const f = atts[0];
      const ext = f.name?.split('.').pop().toLowerCase();
      const url = getAttachmentUrl(f.url);
      const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
      
      if (officeExts.includes(ext)) {
        setFilePreview({
          name: f.name,
          type: 'office',
          url: `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
        });
      } else {
        setFilePreview({ name: f.name, type: ext, url });
      }
    } else {
      setFilePreview({ name: article.title, type: 'note', url: null, content: article.content });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleOpenFolder = (category) => {
    setCurrentFolderCategory(category)
    setFolderSearchTerm('')
    setCurrentPage(1)
    setShowFolderModal(true)
  }

  // 在指定分类下创建文档
  const handleCreateArticle = (category) => {
    // 注意：在我的知识库中，我们不需要创建新文档，而是收藏已有文档
    // 这里保留函数以避免错误，但可以添加提示信息
    toast.info('在我的知识库中，请先在知识库中找到文档并点击"收藏"按钮')
  }

  const getCurrentFolderArticles = () => {
    if (!currentFolderCategory) return []

    const categoryArticles = currentFolderCategory.id === 'uncategorized'
      ? articles.filter(a => !a.category_id)
      : articles.filter(a => a.category_id == currentFolderCategory.id)

    return categoryArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(folderSearchTerm.toLowerCase())
      return matchesSearch
    })
  }

  useEffect(() => {
    const total = getCurrentFolderArticles().length
    setTotalPages(Math.ceil(total / pageSize))
  }, [articles, currentFolderCategory, folderSearchTerm, pageSize])

  const getPaginatedArticles = () => {
    const filtered = getCurrentFolderArticles()
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filtered.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    const filtered = getCurrentFolderArticles()
    return Math.ceil(filtered.length / pageSize)
  }

  const getPaginatedCategories = () => {
    const startIndex = (categoryPage - 1) * categoryPageSize
    const endIndex = startIndex + categoryPageSize
    return categories.slice(startIndex, endIndex)
  }

  const getCategoryTotalPages = () => {
    return Math.ceil(categories.length / categoryPageSize)
  }

  const articlesByCategory = {}
  const uncategorizedArticles = []

  articles.forEach(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.summary?.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return

    if (article.category_id) {
      if (!articlesByCategory[article.category_id]) {
        articlesByCategory[article.category_id] = []
      }
      articlesByCategory[article.category_id].push(article)
    } else {
      uncategorizedArticles.push(article)
    }
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📚 我的知识库</h1>
        <p className="text-gray-600 mt-1">管理我收藏的知识文档</p>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex gap-3">
            <button
              onClick={() => {
                resetCategoryForm()
                setShowCategoryModal(true)
              }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              📁 管理分类
            </button>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showAdvancedSearch
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              🔍 {showAdvancedSearch ? '收起搜索' : '高级搜索'}
            </button>
            <button
              onClick={() => setShowStats(s => !s)}
              className="px-4 py-2 rounded-lg transition-colors bg-indigo-500 text-white hover:bg-indigo-600"
            >
              {showStats ? '隐藏统计' : '查看统计'}
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="快速搜索文档标题..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <select
              value={categoryPageSize}
              onChange={(e) => {
                setCategoryPageSize(Number(e.target.value))
                setCategoryPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={4}>每页 4 个</option>
              <option value={8}>每页 8 个</option>
              <option value={12}>每页 12 个</option>
              <option value={16}>每页 16 个</option>
              <option value={20}>每页 20 个</option>
            </select>
          </div>
        </div>

        {/* 高级搜索面板 */}
        {showAdvancedSearch && (
          <div className="border-t pt-4">
            <AdvancedSearch
              isOpen={true}
              embedded={true}
              onSearch={(results) => {
                if (results && results.data) {
                  setArticles(results.data)
                  toast.success(`找到 ${results.pagination?.total || 0} 个结果`)
                }
              }}
              onPreview={(article) => {
                setPreviewFile(article)
              }}
              onMove={(article) => {
                handleMoveArticle(article)
              }}
              onDelete={(article) => {
                handleDeleteArticle(article)
              }}
              onClose={() => setShowAdvancedSearch(false)}
            />
          </div>
        )}
      </div>

      {showStats && (
        <div className="bg-indigo-50 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">最近7天文档统计</h3>
            <button onClick={() => fetchArticleStats()} className="px-3 py-1 text-sm rounded bg-white border border-indigo-200 hover:bg-indigo-100">刷新</button>
          </div>
          {statsLoading ? (
            <div className="text-gray-600">加载统计...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2">文档</th>
                    <th className="px-3 py-2">浏览</th>
                    <th className="px-3 py-2">完整阅读率</th>
                    <th className="px-3 py-2">平均时长(秒)</th>
                  </tr>
                </thead>
                <tbody>
                  {articleStats.map(row => (
                    <tr key={row.article_id} className="border-t border-gray-200">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.views}</td>
                      <td className="px-3 py-2">{row.full_read_rate}%</td>
                      <td className="px-3 py-2">{row.avg_duration}</td>
                    </tr>
                  ))}
                  {articleStats.length === 0 && (
                    <tr><td className="px-3 py-2 text-gray-500" colSpan={4}>暂无统计数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 文件夹网格视图 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        <div>
          {categories.length === 0 && uncategorizedArticles.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500 mb-4">暂无收藏的文档</p>
              <p className="text-sm text-gray-400">
                在浏览知识库中点击"收藏"按钮即可添加到我的知识库
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {getPaginatedCategories().map(category => {
                  const categoryArticles = articlesByCategory[category.id] || []
                  if (categoryArticles.length === 0 && searchTerm) return null

                  return (
                    <div
                      key={category.id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary-300 overflow-hidden group relative win11-folder"
                      onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                    >
                      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingCategory(category)
                            setCategoryFormData({
                              name: category.name,
                              description: category.description || '',
                              icon: category.icon || '📁'
                            })
                            setShowCategoryModal(true)
                          }}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          title="编辑分类"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCategory(category.id)
                          }}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                          title="删除分类"
                        >
                          🗑️
                        </button>
                      </div>

                      <div
                        className="p-6 cursor-pointer"
                        onClick={() => handleOpenFolder(category)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="text-5xl">{category.icon || '📁'}</div>
                        </div>
                        <h3 className="font-semibold text-gray-800 text-lg mb-1 truncate">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                            {category.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            📄 {categoryArticles.length} 篇文档
                          </span>
                          <span className="text-primary-500 group-hover:text-primary-600">
                            打开 →
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {uncategorizedArticles.length > 0 && (
                  <div
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary-300 overflow-hidden group win11-folder"
                    onClick={() => handleOpenFolder({ id: 'uncategorized', name: '未分类', icon: '📂', description: '未指定分类的文档' })}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', { id: 'uncategorized', name: '未分类', icon: '📂', description: '未指定分类的文档' })}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="text-5xl">📂</div>
                      </div>
                      <h3 className="font-semibold text-gray-800 text-lg mb-1">
                        未分类
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">
                        未指定分类的文档
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          📄 {uncategorizedArticles.length} 篇文档
                        </span>
                        <span className="text-primary-500 group-hover:text-primary-600">
                          打开 →
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {categories.length > categoryPageSize && (
                <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      共 {categories.length} 个分类，第 {categoryPage} / {getCategoryTotalPages()} 页
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCategoryPage(p => Math.max(1, p - 1))}
                        disabled={categoryPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← 上一页
                      </button>

                      {[...Array(Math.min(getCategoryTotalPages(), 5))].map((_, i) => {
                        let pageNum
                        const totalPages = getCategoryTotalPages()
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (categoryPage <= 3) {
                          pageNum = i + 1
                        } else if (categoryPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = categoryPage - 2 + i
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => setCategoryPage(pageNum)}
                            className={`px-4 py-2 border rounded-lg ${
                              categoryPage === pageNum
                                ? 'bg-primary-500 text-white border-primary-500'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}

                      <button
                        onClick={() => setCategoryPage(p => Math.min(getCategoryTotalPages(), p + 1))}
                        disabled={categoryPage === getCategoryTotalPages()}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页 →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 文件夹内容模态框 */}
      {showFolderModal && currentFolderCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
            {/* 头部 */}
            <div className="p-8 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{currentFolderCategory.icon || '📁'}</span>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{currentFolderCategory.name}</h2>
                  {currentFolderCategory.description && (
                    <p className="text-gray-700 text-lg mt-2">{currentFolderCategory.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-2xl"
              >
                ✕
              </button>
            </div>

            {/* 操作栏 */}
            <div className="p-6 border-b border-gray-200 flex flex-wrap items-center gap-4 bg-gray-50">
              <button
                onClick={() => {
                  handleCreateArticle(currentFolderCategory)
                  setShowFolderModal(false)
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-3 text-lg font-medium shadow-md"
              >
                ➕ 新建文档
              </button>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="搜索文档..."
                  value={folderSearchTerm}
                  onChange={(e) => {
                    setFolderSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-transparent text-lg shadow-sm"
                />
              </div>
              <span className="text-lg text-gray-700 whitespace-nowrap bg-white px-4 py-3 rounded-xl shadow-sm">
                共 {getCurrentFolderArticles().length} 篇文档
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {getPaginatedArticles().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-8xl mb-6">📭</div>
                  <p className="text-2xl text-gray-600 mb-6">
                    {folderSearchTerm ? '没有找到匹配的文档' : '暂无文档'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      onClick={() => handleEnhancedPreview(article)}
                      className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all hover:border-blue-400 group flex flex-col h-full relative cursor-pointer"
                      onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                    >
                      {/* 选择框移到卡片内部，绝对定位 */}
                      <div className="absolute top-3 left-3 z-20">
                         {/* 如果需要多选功能，可以在这里添加 Checkbox */}
                      </div>

                      {/* 大图标 */}
                      <div className="flex items-center justify-center mb-4 flex-shrink-0">
                        <span className="text-5xl group-hover:scale-110 transition-transform">
                          {getFileIcon(article)}
                        </span>
                      </div>

                      {/* 标题 */}
                      <h3 className="font-bold text-gray-900 mb-3 line-clamp-2 text-center text-lg group-hover:text-blue-600 transition-colors flex-shrink-0">
                        {article.title}
                      </h3>

                      {/* 笔记提示 */}
                      {article.notes && (
                        <div className="text-sm text-yellow-600 text-center mb-3 flex-shrink-0 bg-yellow-50 px-3 py-1 rounded-lg">
                          💡 有笔记
                        </div>
                      )}

                      {/* 底部信息 */}
                      <div className="mt-auto pt-4 border-t border-gray-100 flex-shrink-0 flex justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewArticle(article); }}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            详情
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article); }}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            删除
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {getTotalPages() > 1 && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-lg text-gray-700">
                    第 {currentPage} / {getTotalPages()} 页
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-medium shadow-sm"
                    >
                      ← 上一页
                    </button>

                    {[...Array(Math.min(getTotalPages(), 5))].map((_, i) => {
                      let pageNum
                      const totalPages = getTotalPages()
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-6 py-3 border-2 rounded-xl transition-all text-lg font-medium shadow-sm ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                      className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-medium shadow-sm"
                    >
                      下一页 →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 文章详情模态框 */}
      {showArticleModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-lg w-full ${articleModalWidth} ${articleModalHeight} overflow-hidden flex flex-col`}>
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div className="flex-1 pr-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedArticle.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>📅 {formatDate(selectedArticle.created_at)}</span>
                  {selectedArticle.category_name && (
                    <span>📁 {selectedArticle.category_name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 调整宽高按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const widths = ['max-w-2xl', 'max-w-3xl', 'max-w-4xl', 'max-w-5xl']
                      const currentIndex = widths.indexOf(articleModalWidth)
                      const nextIndex = (currentIndex + 1) % widths.length
                      setArticleModalWidth(widths[nextIndex])
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors text-sm"
                    title="调整宽度"
                  >
                    ↔️
                  </button>
                  <button
                    onClick={() => {
                      const heights = ['max-h-[80vh]', 'max-h-[85vh]', 'max-h-[90vh]', 'max-h-[95vh]']
                      const currentIndex = heights.indexOf(articleModalHeight)
                      const nextIndex = (currentIndex + 1) % heights.length
                      setArticleModalHeight(heights[nextIndex])
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors text-sm"
                    title="调整高度"
                  >
                    ↕️
                  </button>
                </div>
                <button
                  onClick={() => setShowArticleModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6" id="my-kb-article-content" ref={articleContentRef}>
              {selectedArticle.summary && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <p className="text-gray-700">{selectedArticle.summary}</p>
                </div>
              )}

              {selectedArticle.notes && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">💡 我的笔记</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedArticle.notes}</p>
                </div>
              )}

              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {selectedArticle.content}
                </div>
              </div>

              {parseAttachments(selectedArticle.attachments).length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📎 附件</h3>
                  <div className="space-y-2">
                    {parseAttachments(selectedArticle.attachments).map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                        onClick={() => {
                          // 根据文件类型决定是预览还是下载
                          if (file.type.startsWith('image/') ||
                              file.type.includes('pdf') ||
                              file.type.startsWith('video/')) {
                            // 支持预览的文件类型，设置文件预览对象
                            setFilePreview({
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              url: file.url
                            });
                          } else {
                            // 其他文件类型直接下载
                            const link = document.createElement('a');
                            link.href = file.url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                      >
                        <span className="text-2xl">{getFileIcon(file.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{file.name}</div>
                          <div className="text-sm text-gray-500">
                            {formatFileSize(file.size)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {file.type.includes('pdf') || file.type.startsWith('image/') || file.type.startsWith('video/')
                              ? '点击预览'
                              : '点击下载'}
                          </div>
                        </div>
                        <span className="text-blue-600">
                          {file.type.includes('pdf') || file.type.startsWith('image/') || file.type.startsWith('video/')
                            ? '👁️'
                            : '📥'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end">
              <button
                onClick={() => setShowArticleModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分类管理模态框 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                {editingCategory ? '编辑分类' : '创建分类'}
              </h2>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分类名称 *
                </label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  图标
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={categoryFormData.icon}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {categoryIcons.map(icon => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-4xl">{categoryFormData.icon}</div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  从下拉列表中选择图标
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  描述
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="分类描述（可选）"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false)
                    resetCategoryForm()
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {loading ? '保存中...' : editingCategory ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 独立文件预览模态框 */}
      <FilePreviewModal
        file={filePreview}
        onClose={() => setFilePreview(null)}
        getFileIcon={getFileIcon}
        formatFileSize={formatFileSize}
        modalWidth={previewModalWidth}
        setModalWidth={setPreviewModalWidth}
        modalHeight={previewModalHeight}
        setModalHeight={setPreviewModalHeight}
      />

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
                { icon: '✏️', label: '编辑', actionType: 'edit' },
                { icon: '🗑️', label: '删除', actionType: 'delete' }
              ]
            : contextMenu.type === 'file'
            ? [
                { icon: '👁️', label: '预览', actionType: 'preview' },
                { icon: '📄', label: '查看详情', actionType: 'view' },
                { icon: '📦', label: '移动到', actionType: 'move' },
                { icon: '🗑️', label: '删除', actionType: 'delete' }
              ]
            : []
        }
      />
    </div>
  )
}

export default MyKnowledgeBase
