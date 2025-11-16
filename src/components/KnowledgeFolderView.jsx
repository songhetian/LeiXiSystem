import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { categoryIcons } from '../utils/iconOptions'
import RecycleBin from './RecycleBin'
import AdvancedSearch from './AdvancedSearch'
import { getApiUrl } from '../utils/apiConfig'


const KnowledgeFolderView = () => {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [currentFolderCategory, setCurrentFolderCategory] = useState(null)
  const [folderSearchTerm, setFolderSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 文件类型筛选
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusChangingArticle, setStatusChangingArticle] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryPageSize, setCategoryPageSize] = useState(8)

  // 分类显示/隐藏确认模态框
  const [showVisibilityModal, setShowVisibilityModal] = useState(false)
  const [categoryToToggle, setCategoryToToggle] = useState(null)

  // 删除分类确认模态框
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [categoryArticlesCount, setCategoryArticlesCount] = useState(0)

  // 回收站
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [recycleBinCount, setRecycleBinCount] = useState(0)

  // 高级搜索
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)

  // 移动分类
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [articleToMove, setArticleToMove] = useState(null)
  const [targetCategoryId, setTargetCategoryId] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    summary: '',
    content: '',
    type: 'company',
    status: 'draft',
    icon: '📄',
    attachments: []
  })

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    icon: '📚'
  })

  useEffect(() => {
    fetchArticles()
    fetchCategories()
    fetchRecycleBinCount()
  }, [])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/articles'))
      setArticles(response.data || [])
    } catch (error) {
      console.error('获取知识文档失败:', error)
      toast.error('获取知识文档失败')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/categories'))
      const cats = response.data || []
      setCategories(cats)
      // 默认展开所有文件夹
      const expanded = {}
      cats.forEach(cat => {
        expanded[cat.id] = true
      })
      setExpandedFolders(expanded)
    } catch (error) {
      console.error('获取分类失败:', error)
      toast.error('获取分类失败')
      setCategories([])
    }
  }

  const fetchRecycleBinCount = async () => {
    try {
      const [categoriesRes, articlesRes] = await Promise.all([
        axios.get(getApiUrl('/api/knowledge/recycle-bin/categories')),
        axios.get(getApiUrl('/api/knowledge/recycle-bin/articles'))
      ])
      const categoryCount = categoriesRes.data.data?.length || 0
      const articleCount = articlesRes.data.data?.length || 0
      setRecycleBinCount(categoryCount + articleCount)
    } catch (error) {
      console.error('获取回收站数量失败:', error)
      setRecycleBinCount(0)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingArticle) {
        await axios.put(getApiUrl(`/api/knowledge/articles/${editingArticle.id}`), formData)
        toast.success('文档更新成功')
      } else {
        await axios.post(getApiUrl('/api/knowledge/articles'), formData)
        toast.success('文档创建成功')
      }
      setShowModal(false)
      resetForm()
      fetchArticles()
    } catch (error) {
      console.error('提交失败:', error)
      toast.error(editingArticle ? '更新失败' : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editingCategory) {
        await axios.put(getApiUrl(`/api/knowledge/categories/${editingCategory.id}`), categoryFormData)
        toast.success('分类更新成功')
      } else {
        await axios.post(getApiUrl('/api/knowledge/categories'), categoryFormData)
        toast.success('分类创建成功')
      }
      resetCategoryForm()
      await fetchCategories()
    } catch (error) {
      console.error('分类操作失败:', error)
      toast.error(editingCategory ? '更新失败' : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = (categoryId) => {
    // 检查该分类下是否有文档
    const categoryArticles = articles.filter(a => a.category_id == categoryId && a.status !== 'deleted')
    setCategoryArticlesCount(categoryArticles.length)
    setCategoryToDelete(categoryId)
    setShowDeleteCategoryModal(true)
  }

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      // 调用软删除 API
      await axios.post(getApiUrl(`/api/knowledge/categories/${categoryToDelete}/soft-delete`))
      toast.success('已移至回收站')
      setShowDeleteCategoryModal(false)
      setCategoryToDelete(null)
      await fetchCategories()
      await fetchArticles()
      await fetchRecycleBinCount()
    } catch (error) {
      console.error('删除分类失败:', error)
      toast.error('删除分类失败')
    }
  }

  const handleEdit = (article) => {
    setEditingArticle(article)
    setFormData({
      title: article.title,
      category_id: article.category_id || '',
      summary: article.summary || '',
      content: article.content,
      type: article.type,
      status: article.status,
      icon: article.icon || '📄',
      attachments: parseAttachments(article.attachments)
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这篇文档吗？')) return

    try {
      // 调用软删除 API
      await axios.post(getApiUrl(`/api/knowledge/articles/${id}/soft-delete`))
      toast.success('已移至回收站')
      await fetchArticles()
      await fetchRecycleBinCount()
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
    }
  }

  const handleMoveArticle = (article) => {
    setArticleToMove(article)
    setTargetCategoryId(article.category_id || '')
    setShowMoveModal(true)
  }

  const confirmMoveArticle = async () => {
    if (!articleToMove) return

    try {
      // 更新文档的分类
      await axios.put(getApiUrl(`/api/knowledge/articles/${articleToMove.id}`), {
        ...articleToMove,
        category_id: targetCategoryId || null
      })

      toast.success('文档已移动')
      setShowMoveModal(false)
      setArticleToMove(null)
      setTargetCategoryId('')
      await fetchArticles()
      setShowFolderModal(false)
    } catch (error) {
      console.error('移动文档失败:', error)
      toast.error('移动文档失败')
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingFiles(true)
    try {
      const uploadedFiles = []

      for (const file of files) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)

        const response = await axios.post(getApiUrl('/api/upload'), uploadFormData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })

        uploadedFiles.push({
          name: file.name,
          url: response.data.url,
          type: file.type,
          size: file.size
        })
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }))

      toast.success(`成功上传 ${files.length} 个文件`)
    } catch (error) {
      console.error('文件上传失败:', error)
      toast.error('文件上传失败: ' + (error.response?.data?.error || error.message))
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.startsWith('video/')) return '🎬'
    if (type.startsWith('audio/')) return '🎵'
    if (type.includes('pdf')) return '📄'
    if (type.includes('word') || type.includes('document')) return '📝'
    if (type.includes('excel') || type.includes('sheet')) return '📊'
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️'
    return '📎'
  }

  // 根据文档附件自动判断图标
  const getDocumentIcon = (article) => {
    // 如果有自定义图标，优先使用
    if (article.icon && article.icon !== '📄') {
      return article.icon
    }

    // 根据附件类型判断
    const attachments = parseAttachments(article.attachments)
    if (attachments.length > 0) {
      const firstAttachment = attachments[0]
      const type = firstAttachment.type || ''

      // Excel
      if (type.includes('excel') || type.includes('sheet') || type.includes('spreadsheet')) {
        return '📊'
      }
      // PowerPoint
      if (type.includes('powerpoint') || type.includes('presentation')) {
        return '📽️'
      }
      // PDF
      if (type.includes('pdf')) {
        return '📄'
      }
      // Word
      if (type.includes('word') || type.includes('document')) {
        return '📝'
      }
      // 视频
      if (type.startsWith('video/')) {
        return '🎬'
      }
      // 图片
      if (type.startsWith('image/')) {
        return '🖼️'
      }
      // 音频
      if (type.startsWith('audio/')) {
        return '🎵'
      }
    }

    // 默认图标
    return article.icon || '📄'
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const resetForm = () => {
    setFormData({
      title: '',
      category_id: '',
      summary: '',
      content: '',
      type: 'company',
      status: 'draft',
      icon: '📄',
      attachments: []
    })
    setEditingArticle(null)
    setSelectedCategory(null)
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      icon: '📚'
    })
    setEditingCategory(null)
  }

  const toggleFolder = (categoryId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  // 打开文件夹模态框
  const handleOpenFolder = (category) => {
    setCurrentFolderCategory(category)
    setFolderSearchTerm('')
    setCurrentPage(1)
    setShowFolderModal(true)
  }

  // 获取当前文件夹的文档
  const getCurrentFolderArticles = () => {
    if (!currentFolderCategory) return []

    const categoryArticles = currentFolderCategory.id === 'uncategorized'
      ? articles.filter(a => !a.category_id && a.status !== 'deleted')
      : articles.filter(a => a.category_id == currentFolderCategory.id && a.status !== 'deleted')

    // 搜索和类型过滤
    return categoryArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(folderSearchTerm.toLowerCase())
      const matchesType = filterType === 'all' || article.type === filterType
      return matchesSearch && matchesType
    })
  }

  // 分页计算
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

  // 分类分页
  const getPaginatedCategories = () => {
    // 显示所有分类（包括隐藏的分类）
    const startIndex = (categoryPage - 1) * categoryPageSize
    const endIndex = startIndex + categoryPageSize
    return categories.slice(startIndex, endIndex)
  }

  const getCategoryTotalPages = () => {
    // 计算所有分类的总页数
    return Math.ceil(categories.length / categoryPageSize)
  }

  // 在指定分类下创建文档
  const handleCreateInCategory = (category) => {
    setSelectedCategory(category)
    setFormData({
      title: '',
      category_id: category ? category.id : '',
      summary: '',
      content: '',
      type: 'company',
      status: 'draft',
      icon: '📄',
      attachments: []
    })
    setEditingArticle(null)
    setShowModal(true)
  }

  // 按分类分组文档
  const articlesByCategory = {}
  const uncategorizedArticles = []

  articles.filter(a => a.status !== 'deleted').forEach(article => {
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

  // 打开状态修改模态框
  const handleOpenStatusModal = (article) => {
    setStatusChangingArticle(article)
    setNewStatus(article.status)
    setShowStatusModal(true)
  }

  // 确认修改状态
  const handleConfirmStatusChange = async () => {
    if (!statusChangingArticle || !newStatus) return

    try {
      await axios.put(getApiUrl(`/api/knowledge/articles/${statusChangingArticle.id}`), {
        ...statusChangingArticle,
        status: newStatus,
        attachments: parseAttachments(statusChangingArticle.attachments)
      })
      toast.success('状态更新成功')
      setShowStatusModal(false)
      setStatusChangingArticle(null)
      fetchArticles()
    } catch (error) {
      console.error('状态更新失败:', error)
      toast.error('状态更新失败')
    }
  }

  // 打开切换分类显示/隐藏确认模态框
  const handleOpenVisibilityModal = (category) => {
    setCategoryToToggle(category)
    setShowVisibilityModal(true)
  }

  // 确认切换分类显示/隐藏状态
  const handleConfirmToggleVisibility = async () => {
    if (!categoryToToggle) return

    const currentHidden = categoryToToggle.is_hidden || 0
    const newHidden = currentHidden === 1 ? 0 : 1
    const action = newHidden === 1 ? '隐藏' : '显示'

    try {
      // 调用后端API切换可见性
      const response = await axios.post(getApiUrl(`/api/knowledge/categories/${categoryToToggle.id}/toggle-visibility`), {
        is_hidden: newHidden
      })

      toast.success(response.data.message || `分类已${action}`)
      setShowVisibilityModal(false)
      setCategoryToToggle(null)
      await fetchCategories()
      await fetchArticles() // 刷新文档列表以显示状态变化
    } catch (error) {
      console.error('切换分类可见性失败:', error)
      toast.error('操作失败: ' + (error.response?.data?.error || error.message))
    }
  }

  const getStatusBadge = (status, article) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
      published: 'bg-green-100 text-green-700 hover:bg-green-200',
      archived: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
    }
    const labels = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档'
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleOpenStatusModal(article)
        }}
        className={`px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${badges[status]}`}
        title="点击修改状态"
      >
        {labels[status]}
      </button>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📚 知识文档</h1>
        <p className="text-gray-600 mt-1">按文件夹管理知识文档</p>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex gap-3">
            <button
              onClick={() => handleCreateInCategory(null)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              ➕ 新建文档
            </button>
            <button
              onClick={() => {
                resetCategoryForm()
                setShowCategoryModal(true)
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
              onClick={() => setShowRecycleBin(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors relative"
            >
              🗑️ 回收站
              {recycleBinCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                  {recycleBinCount > 99 ? '99+' : recycleBinCount}
                </span>
              )}
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
                // 处理搜索结果
                if (results && results.data) {
                  setArticles(results.data)
                  toast.success(`找到 ${results.pagination?.total || 0} 个结果`)
                }
              }}
              onPreview={(article) => {
                setPreviewFile(article)
              }}
              onEdit={(article) => {
                handleEdit(article)
                setShowAdvancedSearch(false)
              }}
              onMove={(article) => {
                handleMoveArticle(article)
              }}
              onDelete={async (articleId) => {
                if (window.confirm('确定要删除这篇文档吗？')) {
                  try {
                    await axios.post(getApiUrl(`/api/knowledge/articles/${articleId}/soft-delete`))
                    toast.success('已移至回收站')
                    await fetchArticles()
                    await fetchRecycleBinCount()
                  } catch (error) {
                    console.error('删除失败:', error)
                    toast.error('删除失败')
                  }
                }
              }}
              onClose={() => setShowAdvancedSearch(false)}
            />
          </div>
        )}
      </div>

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
              <p className="text-gray-500 mb-4">暂无文档和分类</p>
              <button
                onClick={() => {
                  resetCategoryForm()
                  setShowCategoryModal(true)
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                创建第一个分类
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* 分类文件夹 */}
              {getPaginatedCategories().map(category => {
                const categoryArticles = articlesByCategory[category.id] || []
                if (categoryArticles.length === 0 && searchTerm) return null

                return (
                  <div
                    key={category.id}
                    className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all border-2 overflow-hidden group relative ${
                      category.is_hidden === 1
                        ? 'border-gray-300 hover:border-gray-400 opacity-75'
                        : 'border-transparent hover:border-primary-300'
                    }`}
                  >
                    {/* 隐藏标签 - 始终显示在左上角 */}
                    {category.is_hidden === 1 && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded shadow-sm">
                          🔒 隐藏
                        </span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenVisibilityModal(category)
                        }}
                        className={`px-2 py-1 text-white rounded text-xs ${
                          category.is_hidden === 1
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-gray-500 hover:bg-gray-600'
                        }`}
                        title={category.is_hidden === 1 ? '点击显示分类' : '点击隐藏分类'}
                      >
                        {category.is_hidden === 1 ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCreateInCategory(category)
                        }}
                        className="px-2 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
                        title="新建文档"
                      >
                        ➕
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingCategory(category)
                          setCategoryFormData({
                            name: category.name,
                            description: category.description || '',
                            icon: category.icon || '📚'
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

                    {/* 文件夹内容 */}
                    <div
                      className="p-6 cursor-pointer"
                      onClick={() => handleOpenFolder(category)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`text-5xl ${category.is_hidden === 1 ? 'opacity-60' : ''}`}>
                          {category.icon}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-lg truncate flex-1 ${
                          category.is_hidden === 1 ? 'text-gray-600' : 'text-gray-800'
                        }`}>
                          {category.name}
                        </h3>
                      </div>
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

              {/* 未分类文档 - 隐藏不显示 */}
              </div>

              {/* 分类分页 */}
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
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            className={`px-4 py-2 border rounded-lg transition-colors ${
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
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* 文档编辑Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all shadow-md"
              title="关闭"
            >
              ✕
            </button>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 pr-10">
                {editingArticle ? '编辑文档' : selectedCategory ? `在 ${selectedCategory.name} 中新建文档` : '新建文档'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">文档标题 *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="输入文档标题"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">无分类</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">文档图标</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {categoryIcons.map(icon => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">类型 *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="company">公司知识</option>
                    <option value="personal">个人知识</option>
                    <option value="shared">共享知识</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">状态 *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                    <option value="archived">已归档</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">摘要</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:rg-primary-500"
                  placeholder="简短的内容概述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">正文内容 *</label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows="12"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="输入文档正文内容"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">附件</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-4xl mb-2">📎</div>
                    <div className="text-sm text-gray-600">
                      {uploadingFiles ? '上传中...' : '点击或拖拽文件到此处上传'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      支持图片、视频、音频、PDF、Office文档等
                    </div>
                  </label>
                </div>

                {formData.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-medium text-gray-700">已上传附件：</div>
                    {formData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">{getFileIcon(file.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{file.name}</div>
                            <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            👁️ 预览
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            🗑️ 删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 文件夹内容模态框 */}
      {showFolderModal && currentFolderCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
            {/* 头部 */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{currentFolderCategory.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{currentFolderCategory.name}</h2>
                  {currentFolderCategory.description && (
                    <p className="text-gray-600 text-sm">{currentFolderCategory.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 操作栏 */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={() => {
                  handleCreateInCategory(currentFolderCategory.id !== 'uncategorized' ? currentFolderCategory : null)
                  setShowFolderModal(false)
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                ➕ 新建文档
              </button>
              <input
                type="text"
                placeholder="搜索文档..."
                value={folderSearchTerm}
                onChange={(e) => {
                  setFolderSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">全部类型</option>
                <option value="company">🏢 公司知识</option>
                <option value="personal">👤 个人知识</option>
                <option value="shared">🤝 共享知识</option>
              </select>
              <span className="text-sm text-gray-600 whitespace-nowrap">
                共 {getCurrentFolderArticles().length} 篇文档
              </span>
            </div>

            {/* 文档卡片网格 */}
            <div className="flex-1 overflow-y-auto p-6">
              {getPaginatedArticles().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-500 mb-4">
                    {folderSearchTerm ? '没有找到匹配的文档' : '暂无文档'}
                  </p>
                  {!folderSearchTerm && (
                    <button
                      onClick={() => {
                        handleCreateInCategory(currentFolderCategory.id !== 'uncategorized' ? currentFolderCategory : null)
                        setShowFolderModal(false)
                      }}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      创建第一篇文档
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-primary-300"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl flex-shrink-0">{getDocumentIcon(article)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3
                              className="font-semibold text-gray-900 flex-1 pr-2 line-clamp-2 text-base cursor-pointer hover:text-primary-600 transition-colors"
                              onClick={() => setPreviewFile(article)}
                              title="点击预览"
                            >
                              {article.title}
                            </h3>
                            {getStatusBadge(article.status, article)}
                          </div>
                          {article.summary && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {article.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          👁️ {article.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          ❤️ {article.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          📅 {new Date(article.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {parseAttachments(article.attachments).length > 0 && (
                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                          📎 {parseAttachments(article.attachments).length} 个附件
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleMoveArticle(article)}
                          className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded transition-colors text-sm"
                          title="移动到其他分类"
                        >
                          📁 移动
                        </button>
                        <button
                          onClick={() => {
                            handleEdit(article)
                            setShowFolderModal(false)
                          }}
                          className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                          title="编辑"
                        >
                          ✏️ 编辑
                        </button>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                          title="删除"
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 分页 */}
            {getTotalPages() > 1 && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    第 {currentPage} / {getTotalPages()} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ← 上一页
                    </button>

                    {/* 页码按钮 */}
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
                          className={`px-4 py-2 border rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-primary-500 text-white border-primary-500'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                      disabled={currentPage === getTotalPages()}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* 文件预览Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">{previewFile.name}</h2>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {previewFile.type.startsWith('image/') && (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full h-auto mx-auto"
                />
              )}
              {previewFile.type.startsWith('video/') && (
                <video
                  controls
                  className="max-w-full h-auto mx-auto"
                  style={{ maxHeight: '70vh' }}
                >
                  <source src={previewFile.url} type={previewFile.type} />
                  您的浏览器不支持视频播放
                </video>
              )}
              {previewFile.type.includes('pdf') && (
                <iframe
                  src={previewFile.url}
                  className="w-full h-full min-h-[600px]"
                  title={previewFile.name}
                />
              )}
              {!previewFile.type.startsWith('image/') &&
               !previewFile.type.startsWith('video/') &&
               !previewFile.type.includes('pdf') && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">{getFileIcon(previewFile.type)}</div>
                  <div className="text-xl font-medium text-gray-800 mb-2">{previewFile.name}</div>
                  <div className="text-gray-600 mb-4">此文件类型不支持在线预览</div>
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    📥 下载文件
                  </a>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                文件大小：{formatFileSize(previewFile.size)}
              </div>
              <div className="flex gap-3">
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  📥 下载
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分类管理Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl relative">
            <button
              type="button"
              onClick={() => {
                setShowCategoryModal(false)
                resetCategoryForm()
              }}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all shadow-md"
              title="关闭"
            >
              ✕
            </button>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 pr-10">分类管理</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleCategorySubmit} className="space-y-4 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      required
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="分类名称"
                    />
                  </div>
                  <div>
                    <select
                      value={categoryFormData.icon}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {categoryIcons.map(icon => (
                        <option key={icon.value} value={icon.value}>
                          {icon.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="分类描述"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {editingCategory ? '更新分类' : '添加分类'}
                </button>
              </form>

              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  已有分类 ({categories.length} 个)
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {categories.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      暂无分类，请先添加分类
                    </div>
                  ) : (
                    categories.map(cat => {
                      const catArticleCount = articles.filter(a => a.category_id == cat.id && a.status !== 'deleted').length
                      return (
                        <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-2xl">{cat.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{cat.name}</span>
                                {cat.is_hidden === 1 && (
                                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                                    隐藏
                                  </span>
                                )}
                              </div>
                              {cat.description && (
                                <div className="text-sm text-gray-500">{cat.description}</div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                📄 {catArticleCount} 篇文档
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat)
                                setCategoryFormData({
                                  name: cat.name,
                                  description: cat.description || '',
                                  icon: cat.icon || '📚'
                                })
                              }}
                              className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="编辑"
                            >
                              ✏️ 编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              🗑️ 删除
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    resetCategoryForm()
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 状态修改Modal */}
      {showStatusModal && statusChangingArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">修改文档状态</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  文档：<span className="font-medium">{statusChangingArticle.title}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  当前状态：<span className="font-medium">
                    {statusChangingArticle.status === 'draft' ? '草稿' :
                     statusChangingArticle.status === 'published' ? '已发布' : '已归档'}
                  </span>
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择新状态：
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="draft">📝 草稿</option>
                  <option value="published">✅ 已发布</option>
                  <option value="archived">📦 已归档</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowStatusModal(false)
                    setStatusChangingArticle(null)
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmStatusChange}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  确认修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分类显示/隐藏确认Modal */}
      {showVisibilityModal && categoryToToggle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                {categoryToToggle.is_hidden === 1 ? '显示分类' : '隐藏分类'}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{categoryToToggle.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{categoryToToggle.name}</p>
                    {categoryToToggle.description && (
                      <p className="text-sm text-gray-500">{categoryToToggle.description}</p>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 font-medium mb-2">
                        {categoryToToggle.is_hidden === 1 ? '显示此分类后：' : '隐藏此分类后：'}
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {categoryToToggle.is_hidden === 1 ? (
                          <>
                            <li>• 分类将在知识库中显示</li>
                            <li>• 该分类下所有文档状态将改为"已发布"</li>
                            <li>• 用户可以查看该分类及其文档</li>
                          </>
                        ) : (
                          <>
                            <li>• 分类将在知识库中隐藏</li>
                            <li>• 该分类下所有文档状态将改为"已归档"</li>
                            <li>• 用户将无法查看该分类及其文档</li>
                          </>
                        )}
                      </ul>
                      <p className="text-sm text-gray-600 mt-2">
                        受影响的文档数量：
                        <span className="font-medium text-gray-800">
                          {articles.filter(a => a.category_id == categoryToToggle.id && a.status !== 'deleted').length} 篇
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowVisibilityModal(false)
                    setCategoryToToggle(null)
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmToggleVisibility}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    categoryToToggle.is_hidden === 1
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-500 hover:bg-gray-600'
                  }`}
                >
                  {categoryToToggle.is_hidden === 1 ? '✅ 确认显示' : '🔒 确认隐藏'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除分类确认模态框 */}
      {showDeleteCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">确认删除分类</h3>
                  <p className="text-sm text-gray-500">此操作将移至回收站</p>
                </div>
              </div>

              <div className="mb-6">
                {categoryArticlesCount > 0 ? (
                  <p className="text-gray-700">
                    该分类下有 <span className="font-bold text-red-600">{categoryArticlesCount}</span> 篇文档，
                    删除后将一起移至回收站。确定要删除吗？
                  </p>
                ) : (
                  <p className="text-gray-700">
                    确定要删除这个分类吗？删除后可以在回收站中恢复。
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteCategoryModal(false)
                    setCategoryToDelete(null)
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 移动文档模态框 */}
      {showMoveModal && articleToMove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-2xl">📁</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">移动文档</h3>
                  <p className="text-sm text-gray-500">选择目标分类</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">文档标题：</p>
                  <p className="font-medium text-gray-900">{articleToMove.title}</p>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">当前分类：</p>
                  <p className="font-medium text-gray-700">
                    {articleToMove.category_name || '未分类'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    目标分类：
                  </label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">未分类</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowMoveModal(false)
                    setArticleToMove(null)
                    setTargetCategoryId('')
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmMoveArticle}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  确认移动
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 文档预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* 头部 */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-800 truncate">{previewFile.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                  <span>📁 {previewFile.category_name || '未分类'}</span>
                  <span>👤 {previewFile.author_name || '未知'}</span>
                  <span>📅 {new Date(previewFile.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0 ml-4"
              >
                ✕
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {previewFile.summary && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">📝 摘要</h3>
                  <p className="text-gray-700">{previewFile.summary}</p>
                </div>
              )}

              <div className="prose max-w-none">
                <div
                  className="text-gray-800 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: previewFile.content?.replace(/\n/g, '<br/>') || '暂无内容' }}
                />
              </div>

              {parseAttachments(previewFile.attachments).length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">📎 附件 ({parseAttachments(previewFile.attachments).length})</h3>
                  <div className="space-y-2">
                    {parseAttachments(previewFile.attachments).map((file, index) => (
                      <a
                        key={index}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 hover:bg-white rounded transition-colors"
                      >
                        <span className="text-2xl">📄</span>
                        <span className="text-blue-600 hover:underline">{file.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 底部操作按钮 */}
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  handleEdit(previewFile)
                  setPreviewFile(null)
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                ✏️ 编辑
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 回收站 */}
      <RecycleBin
        isOpen={showRecycleBin}
        onClose={() => setShowRecycleBin(false)}
        onRefresh={() => {
          fetchArticles()
          fetchCategories()
          fetchRecycleBinCount()
        }}
      />
    </div>
  )
}

export default KnowledgeFolderView
