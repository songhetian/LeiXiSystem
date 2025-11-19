import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import api from '../api'
import axios from 'axios'
import AdvancedSearch from './AdvancedSearch'
import { getApiUrl, getApiBaseUrl } from '../utils/apiConfig'
import FilePreviewModal from './FilePreviewModal'
import Win11ContextMenu from './Win11ContextMenu'


const KnowledgeBase = () => {
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
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [myCategories, setMyCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [saveNotes, setSaveNotes] = useState('')
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [likedArticles, setLikedArticles] = useState(new Set()) // 记录已点赞的文档
  // 添加视图模式状态
  const [viewMode, setViewMode] = useState('grid') // 'grid' 或 'list'
  // 添加收藏状态
  const [collectedArticles, setCollectedArticles] = useState(new Set())
  // 添加学习计划状态
  const [learningPlans, setLearningPlans] = useState([])
  const [showAddToPlanModal, setShowAddToPlanModal] = useState(false)
  const [selectedArticleForPlan, setSelectedArticleForPlan] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  // 添加文章分页状态
  const [articlePage, setArticlePage] = useState(1)
  const [articlePageSize, setArticlePageSize] = useState(20)
  const [totalArticles, setTotalArticles] = useState(0)
  // 添加总分类数状态
  const [totalCategories, setTotalCategories] = useState(0)

  // 添加调整弹出框宽高的状态
  const [articleModalWidth, setArticleModalWidth] = useState('max-w-4xl')
  const [articleModalHeight, setArticleModalHeight] = useState('max-h-[90vh]')
  const [previewModalWidth, setPreviewModalWidth] = useState('max-w-6xl')
  const [previewModalHeight, setPreviewModalHeight] = useState('max-h-[95vh]')

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: '', // 'folder' or 'file'
    data: null
  })

  useEffect(() => {
    fetchCategories()
    fetchArticles()
    fetchMyCategories()
    fetchLearningPlans()
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [articlePage, articlePageSize, searchTerm])

  const fetchCategories = async () => {
    try {
      const response = await api.get('/knowledge/categories')
      setCategories(response.data || [])
      setTotalCategories(response.data?.length || 0)
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await api.get('/knowledge/articles', {
        params: {
          page: articlePage,
          pageSize: articlePageSize,
          search: searchTerm
        }
      })
      // 只显示已发布的文档
      const publishedArticles = (response.data.data || response.data || []).filter(a => a.status === 'published')
      setArticles(publishedArticles)
      setTotalArticles(response.data.pagination?.total || response.data.length || 0)
    } catch (error) {
      console.error('获取文档失败:', error)
      toast.error('获取文档失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewArticle = async (article) => {
    setSelectedArticle(article)
    setShowArticleModal(true)

    // 增加浏览量
    try {
      await api.post(`/knowledge/articles/${article.id}/view`)
      // 刷新文章列表以更新浏览量
      fetchArticles()
    } catch (error) {
      console.error('更新浏览量失败:', error)
    }
  }

  const handleLike = async (articleId) => {
    // 检查是否已点赞
    if (likedArticles.has(articleId)) {
      toast.warning('您已经点赞过了')
      return
    }

    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const response = await api.post(`/knowledge/articles/${articleId}/like`, { userId })

      if (response.data.success) {
        toast.success('点赞成功')
        // 记录已点赞
        setLikedArticles(prev => new Set([...prev, articleId]))
        // 刷新文章列表
        fetchArticles()
        if (selectedArticle && selectedArticle.id === articleId) {
          setSelectedArticle({
            ...selectedArticle,
            like_count: (selectedArticle.like_count || 0) + 1
          })
        }
        if (previewFile && previewFile.id === articleId) {
          setPreviewFile({
            ...previewFile,
            like_count: (previewFile.like_count || 0) + 1
          })
        }
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.warning(error.response.data.message || '您已经点赞过了')
        setLikedArticles(prev => new Set([...prev, articleId]))
      } else {
        toast.error('点赞失败')
      }
    }
  }

  // 检查文档是否已点赞
  const checkLikedStatus = async (articleId) => {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const response = await api.get(`/knowledge/articles/${articleId}/liked?userId=${userId}`)
      return response.data.liked
    } catch (error) {
      return false
    }
  }

  // 收藏文档
  const handleCollect = async (articleId) => {
    // 检查是否已收藏
    if (collectedArticles.has(articleId)) {
      toast.warning('文档已在收藏夹中')
      return
    }

    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const response = await api.post(`/knowledge/articles/${articleId}/collect`, {
        user_id: userId
      })

      if (response.data.success) {
        toast.success('收藏成功')
        // 记录已收藏
        setCollectedArticles(prev => new Set([...prev, articleId]))
        // 刷新文章列表
        fetchArticles()
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.warning(error.response.data.message || '文档已在收藏夹中')
        setCollectedArticles(prev => new Set([...prev, articleId]))
      } else {
        toast.error('收藏失败')
      }
    }
  }

  // 取消收藏文档
  const handleUncollect = async (articleId) => {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const response = await api.delete(`/knowledge/articles/${articleId}/uncollect`, {
        data: { user_id: userId }
      })

      if (response.data.success) {
        toast.success('已取消收藏')
        // 移除收藏记录
        setCollectedArticles(prev => {
          const newSet = new Set(prev)
          newSet.delete(articleId)
          return newSet
        })
        // 刷新文章列表
        fetchArticles()
      }
    } catch (error) {
      toast.error('取消收藏失败')
    }
  }

  // 检查文档是否已收藏
  const checkCollectedStatus = async (articleId) => {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const response = await api.get(`/knowledge/articles/${articleId}/collected?userId=${userId}`)
      return response.data.collected
    } catch (error) {
      return false
    }
  }

  const fetchMyCategories = async () => {
    try {
      const response = await api.get('/my-knowledge/categories')
      setMyCategories(response.data || [])
    } catch (error) {
      console.error('获取我的分类失败:', error)
    }
  }

  // 获取学习计划列表
  const fetchLearningPlans = async () => {
    try {
      const response = await api.get('/learning-plans')
      setLearningPlans(response.data || [])
    } catch (error) {
      console.error('获取学习计划失败:', error)
    }
  }

  // 添加文章到学习计划
  const handleAddToPlan = async (article) => {
    setSelectedArticleForPlan(article)
    await fetchLearningPlans()
    setShowAddToPlanModal(true)
  }

  // 确认添加到学习计划
  const confirmAddToPlan = async () => {
    if (!selectedArticleForPlan) {
      toast.error('未选择文档')
      return
    }

    // 如果没有选择学习计划，自动创建一个以当前文件夹名命名的学习计划
    let planId = selectedPlanId
    if (!planId) {
      try {
        // 获取当前文件夹名称
        let planName = '默认学习计划'
        if (currentFolderCategory) {
          planName = currentFolderCategory.name === '未分类' ? '未分类文档学习计划' : `${currentFolderCategory.name}学习计划`
        } else if (selectedArticleForPlan.category_name) {
          planName = `${selectedArticleForPlan.category_name}学习计划`
        }

        // 创建新的学习计划
        const createResponse = await api.post('/learning-plans', {
          title: planName,
          description: `自动创建的学习计划，包含${planName}中的文档`
        })

        if (createResponse.data && createResponse.data.data) {
          planId = createResponse.data.data.id
          toast.success(`已自动创建学习计划: ${planName}`)
          // 刷新学习计划列表
          await fetchLearningPlans()
        } else {
          throw new Error('创建学习计划失败')
        }
      } catch (error) {
        console.error('创建学习计划失败:', error)
        toast.error('创建学习计划失败: ' + (error.response?.data?.message || error.message))
        return
      }
    }

    try {
      const response = await api.post(`/learning-plans/${planId}/details`, {
        title: selectedArticleForPlan.title,
        description: selectedArticleForPlan.summary || '',
        article_id: selectedArticleForPlan.id,
        order_num: 1
      })

      if (response.data.success) {
        toast.success('已添加到学习计划')
        setShowAddToPlanModal(false)
        setSelectedArticleForPlan(null)
        setSelectedPlanId('')
      }
    } catch (error) {
      console.error('添加到学习计划失败:', error)
      toast.error('添加到学习计划失败')
    }
  }

  const handleSaveToMyKnowledge = () => {
    if (!selectedArticle) return
    setShowSaveModal(true)
    setSaveNotes('')
    setSelectedCategory(null)
  }

  const handleConfirmSave = async () => {
    if (!selectedArticle) return

    try {
      const response = await api.post('/my-knowledge/articles/save', {
        articleId: selectedArticle.id,
        categoryId: selectedCategory,
        notes: saveNotes
      })

      if (response.data.success) {
        toast.success('已保存到我的知识库')
        setShowSaveModal(false)
        setSelectedArticle(null)
        setShowArticleModal(false)
      }
    } catch (error) {
      console.error('保存失败:', error)
      toast.error(error.response?.data?.error || '保存失败')
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
        case 'collect':
          handleCollect(contextMenu.data.id)
          break
        case 'like':
          handleLike(contextMenu.data.id)
          break
        case 'addToPlan':
          handleAddToPlan(contextMenu.data)
          break
        default:
          break
      }
    }
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 确保附件 URL 格式正确
  const getAttachmentUrl = (url) => {
    if (!url) return ''
    // 如果已经是完整 URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // 如果是相对路径，补全为完整 URL
    if (url.startsWith('/')) {
      const host = getApiBaseUrl().replace('/api', '')
      return `${host}${url}`
    }
    // 其他情况，假设是文件名，补全完整路径
    const host = getApiBaseUrl().replace('/api', '')
    return `${host}/uploads/${url}`
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
      ? articles.filter(a => !a.category_id)
      : articles.filter(a => a.category_id == currentFolderCategory.id)

    return categoryArticles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(folderSearchTerm.toLowerCase()) ||
                           article.summary?.toLowerCase().includes(folderSearchTerm.toLowerCase())
      return matchesSearch
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
    // 过滤掉隐藏的分类（只显示 is_hidden !== 1 的分类）
    const visibleCategories = categories.filter(cat => cat.is_hidden !== 1)
    const startIndex = (categoryPage - 1) * categoryPageSize
    const endIndex = startIndex + categoryPageSize
    return visibleCategories.slice(startIndex, endIndex)
  }

  const getCategoryTotalPages = () => {
    // 只计算可见分类的总页数
    const visibleCategories = categories.filter(cat => cat.is_hidden !== 1)
    return Math.ceil(visibleCategories.length / categoryPageSize)
  }

  // 文章分页计算
  const getArticleTotalPages = () => {
    return Math.ceil(totalArticles / articlePageSize)
  }

  // 按分类分组文档
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
        <h1 className="text-2xl font-bold text-gray-800">📚 浏览知识库</h1>
        <p className="text-gray-600 mt-1">浏览和查看已发布的知识文档</p>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex gap-3 items-center flex-1">
            <input
              type="text"
              placeholder="快速搜索文档标题..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setArticlePage(1)
                  fetchArticles()
                }
              }}
            />
            <button
              onClick={() => {
                setArticlePage(1)
                fetchArticles()
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              🔍 搜索
            </button>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                showAdvancedSearch
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {showAdvancedSearch ? '收起搜索' : '高级搜索'}
            </button>
          </div>

          <div className="flex gap-2 items-center">
            {/* 视图模式切换 */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm ${
                  viewMode === 'grid'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="网格视图"
              >
                🟦
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm ${
                  viewMode === 'list'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="列表视图"
              >
                📋
              </button>
            </div>

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
                  setArticles(results.data.filter(a => a.status === 'published'))
                  toast.success(`找到 ${results.pagination?.total || 0} 个结果`)
                }
              }}
              onPreview={(article) => {
                setPreviewFile(article)
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
              <p className="text-gray-500">暂无已发布的文档</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* 分类文件夹 */}
                {getPaginatedCategories().map(category => {
                  // 只显示已发布的分类
                  if (category.status === 'draft') return null

                  const categoryArticles = articlesByCategory[category.id] || []
                  if (categoryArticles.length === 0 && searchTerm) return null

                  return (
                    <div
                      key={category.id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary-300 overflow-hidden group win11-folder relative"
                      onClick={() => handleOpenFolder(category)}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                    >
                      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // 显示/隐藏功能
                            const newStatus = category.is_hidden === 1 ? 0 : 1;
                            handleToggleCategoryVisibility(category.id, newStatus);
                          }}
                          className={`px-2 py-1 text-white rounded text-xs ${category.is_hidden === 1 ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'}`}
                          title={category.is_hidden === 1 ? '显示分类' : '隐藏分类'}
                        >
                          {category.is_hidden === 1 ? '👁️' : '🙈'}
                        </button>
                      </div>
                      <div className="p-6">
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

                {/* 未分类文档 */}
                {uncategorizedArticles.length > 0 && (
                  <div
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary-300 overflow-hidden group win11-folder relative"
                    onClick={() => handleOpenFolder({ id: 'uncategorized', name: '未分类', icon: '📂', description: '未指定分类的文档' })}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', { id: 'uncategorized', name: '未分类', icon: '📂', description: '未指定分类的文档' })}
                  >
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // 未分类文件夹不能隐藏，所以只显示信息
                          toast.info('未分类文件夹不能隐藏');
                        }}
                        className="px-2 py-1 bg-gray-400 text-white rounded text-xs cursor-not-allowed"
                        title="未分类文件夹不能隐藏"
                      >
                        🔒
                      </button>
                    </div>
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

      {/* 文件夹内容模态框 */}
      {showFolderModal && currentFolderCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{currentFolderCategory.icon || '📁'}</span>
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
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3 bg-gray-50">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="搜索文档..."
                  value={folderSearchTerm}
                  onChange={(e) => {
                    setFolderSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('切换到网格视图')
                  setViewMode('grid')
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
                title="网格视图"
              >
                🟦 网格
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('切换到列表视图')
                  setViewMode('list')
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
                title="列表视图"
              >
                📋 列表
              </button>
              <span className="text-sm text-gray-600 whitespace-nowrap bg-white px-3 py-2 rounded-lg border border-gray-300">
                共 {getCurrentFolderArticles().length} 篇文档
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {getPaginatedArticles().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-500">
                    {folderSearchTerm ? '没有找到匹配的文档' : '暂无文档'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                // 网格视图
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      onClick={() => setPreviewFile(article)}
                      className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all hover:border-primary-400 cursor-pointer group aspect-square flex flex-col win11-file"
                      onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                    >
                      {/* 大图标 */}
                      <div className="flex items-center justify-center mb-4 flex-shrink-0">
                        <span className="text-6xl group-hover:scale-110 transition-transform">
                          {article.icon || '📄'}
                        </span>
                      </div>

                      {/* 标题 */}
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-center text-sm group-hover:text-primary-600 transition-colors flex-shrink-0">
                        {article.title}
                      </h3>

                      {/* 摘要 */}
                      {article.summary && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2 text-center flex-shrink-0">
                          {article.summary}
                        </p>
                      )}

                      {/* 底部信息 */}
                      <div className="mt-auto pt-3 border-t border-gray-100 flex-shrink-0">
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mb-2">
                          <span className="flex items-center gap-1">
                            👁️ {article.view_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            ❤️ {article.like_count || 0}
                          </span>
                        </div>
                        {parseAttachments(article.attachments).length > 0 && (
                          <div className="text-xs text-gray-400 text-center mt-1">
                            📎 {parseAttachments(article.attachments).length} 个附件
                          </div>
                        )}
                        {/* 预览按钮 */}
                        <div className="mt-3 flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilePreview({
                                name: article.title,
                                type: 'article',
                                size: 0,
                                url: article.content
                              });
                            }}
                            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs whitespace-nowrap"
                            title="预览"
                          >
                            👁️ 预览
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // 列表视图
                <div className="space-y-3">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      onClick={() => setPreviewFile(article)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-primary-400 cursor-pointer group flex items-center gap-4 win11-file"
                      onContextMenu={(e) => handleContextMenu(e, 'file', article)}
                    >
                      {/* 图标 */}
                      <div className="flex-shrink-0">
                        <span className="text-3xl">{article.icon || '📄'}</span>
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                          {article.title}
                        </h3>

                        {article.summary && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {article.summary}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>👁️ {article.view_count || 0}</span>
                          <span>❤️ {article.like_count || 0}</span>
                          {parseAttachments(article.attachments).length > 0 && (
                            <span>📎 {parseAttachments(article.attachments).length} 个附件</span>
                          )}
                          <span>📅 {formatDate(article.created_at)}</span>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex-shrink-0 flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilePreview({
                              name: article.title,
                              type: 'article',
                              size: 0,
                              url: article.content
                            });
                          }}
                          className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs whitespace-nowrap"
                          title="预览"
                        >
                          👁️ 预览
                        </button>
                        <div className="text-gray-400 text-xs flex items-center justify-center">
                          →
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

      {/* 文章详情Modal */}
      {showArticleModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-lg w-full ${articleModalWidth} ${articleModalHeight} overflow-hidden flex flex-col`}>
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div className="flex-1 pr-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedArticle.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>👁️ {selectedArticle.view_count || 0} 浏览</span>
                  <span>❤️ {selectedArticle.like_count || 0} 点赞</span>
                  <span>📅 {formatDate(selectedArticle.created_at)}</span>
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

            <div className="flex-1 overflow-y-auto p-6">
              {selectedArticle.summary && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <p className="text-gray-700">{selectedArticle.summary}</p>
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
                      <a
                        key={index}
                        href={getAttachmentUrl(file.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-2xl">{getFileIcon(file.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{file.name}</div>
                          <div className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                        <span className="text-primary-500">下载</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => handleLike(selectedArticle.id)}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  ❤️ 点赞 ({selectedArticle.like_count || 0})
                </button>
                <button
                  onClick={handleSaveToMyKnowledge}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                >
                  ⭐ 保存到我的知识库
                </button>
              </div>
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

      {/* 保存到我的知识库模态框 */}
      {showSaveModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">保存到我的知识库</h2>
              <p className="text-sm text-gray-600 mt-1">选择分类或保存到默认分类</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择分类（可选）
                </label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">默认分类</option>
                  {myCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  如果不选择，将保存到"默认分类"中
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  个人笔记（可选）
                </label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="添加你的学习笔记或心得..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">文档标题：</span>{selectedArticle.title}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文档预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-xl shadow-2xl w-full ${previewModalWidth} ${previewModalHeight} flex flex-col`}>
            <div className="p-8 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl font-bold text-gray-900 truncate">{previewFile.title}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-base text-gray-700">
                  <span className="flex items-center gap-2 text-lg">📁 {previewFile.category_name || '未分类'}</span>
                  <span className="flex items-center gap-2 text-lg">👤 {previewFile.author_name || '未知'}</span>
                  <span className="flex items-center gap-2 text-lg">📅 {formatDate(previewFile.created_at)}</span>
                  <span className="flex items-center gap-2 text-lg">👁️ {previewFile.view_count || 0} 浏览</span>
                  <span className="flex items-center gap-2 text-lg">❤️ {previewFile.like_count || 0} 点赞</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 调整宽高按钮 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const widths = ['max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl']
                      const currentIndex = widths.indexOf(previewModalWidth)
                      const nextIndex = (currentIndex + 1) % widths.length
                      setPreviewModalWidth(widths[nextIndex])
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-lg"
                    title="调整宽度"
                  >
                    ↔️
                  </button>
                  <button
                    onClick={() => {
                      const heights = ['max-h-[90vh]', 'max-h-[95vh]', 'max-h-[98vh]']
                      const currentIndex = heights.indexOf(previewModalHeight)
                      const nextIndex = (currentIndex + 1) % heights.length
                      setPreviewModalHeight(heights[nextIndex])
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-lg"
                    title="调整高度"
                  >
                    ↕️
                  </button>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md ml-4 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {previewFile.summary && (
                <div className="mb-8 p-6 bg-blue-100 rounded-xl border border-blue-200">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">📝 摘要</h3>
                  <p className="text-lg text-gray-800 leading-relaxed">{previewFile.summary}</p>
                </div>
              )}

              <div className="prose max-w-none mb-8">
                {previewFile.content ? (
                  <div
                    className="text-xl text-gray-900 whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewFile.content.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <div className="text-gray-600 text-center py-12">
                    <p className="text-2xl">暂无内容</p>
                  </div>
                )}
              </div>

              {/* 附件预览区域 */}
              {parseAttachments(previewFile.attachments).length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-6">📎 附件 ({parseAttachments(previewFile.attachments).length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parseAttachments(previewFile.attachments).map((file, index) => (
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
                        <div className="text-4xl">
                          {file.type.startsWith('image/') && '🖼️'}
                          {file.type.includes('pdf') && '📄'}
                          {file.type.startsWith('video/') && '🎬'}
                          {file.type.includes('word') && '📝'}
                          {file.type.includes('excel') && '📊'}
                          {file.type.includes('powerpoint') && '📑'}
                          {file.type.includes('zip') && '📦'}
                          {!file.type.startsWith('image/') &&
                           !file.type.includes('pdf') &&
                           !file.type.startsWith('video/') &&
                           !file.type.includes('word') &&
                           !file.type.includes('excel') &&
                           !file.type.includes('powerpoint') &&
                           !file.type.includes('zip') && '📄'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-lg text-gray-900 truncate">{file.name}</div>
                          <div className="text-base text-gray-600 mt-1">
                            {formatFileSize(file.size)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {file.type.includes('pdf') || file.type.startsWith('image/') || file.type.startsWith('video/')
                              ? '点击预览'
                              : '点击下载'}
                          </div>
                        </div>
                        <div className="text-blue-600 text-lg">
                          {file.type.includes('pdf') || file.type.startsWith('image/') || file.type.startsWith('video/')
                            ? '👁️'
                            : '📥'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-200 flex gap-4 justify-between bg-gray-50">
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setSelectedArticle(previewFile)
                    setPreviewFile(null) // 关闭预览模态框
                    setShowSaveModal(true)
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-3 text-lg font-medium shadow-md"
                >
                  💾 保存到我的知识库
                </button>
                <button
                  onClick={() => handleAddToPlan(previewFile)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-3 text-lg font-medium shadow-md"
                >
                  📅 添加到学习计划
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleLike(previewFile.id)}
                  disabled={likedArticles.has(previewFile.id)}
                  className={`px-6 py-3 rounded-xl transition-all flex items-center gap-3 text-lg font-medium shadow-md ${
                    likedArticles.has(previewFile.id)
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  ❤️ {likedArticles.has(previewFile.id) ? '已点赞' : '点赞'} ({previewFile.like_count || 0})
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all text-lg font-medium shadow-md"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加到学习计划模态框 */}
      {showAddToPlanModal && selectedArticleForPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">添加到学习计划</h2>
              <p className="text-sm text-gray-600 mt-1">选择要添加的学习计划</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文档标题
                </label>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium text-gray-900">{selectedArticleForPlan.title}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择学习计划（可选，不选择将自动创建）
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">请选择学习计划</option>
                  {learningPlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddToPlanModal(false)
                  setSelectedArticleForPlan(null)
                  setSelectedPlanId('')
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmAddToPlan}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 独立文件预览模态框 */}
      <FilePreviewModal
        file={filePreview}
        onClose={() => setFilePreview(null)}
        getFileIcon={getFileIcon}
        formatFileSize={formatFileSize}
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
                { icon: '📂', label: '打开', actionType: 'open' }
              ]
            : contextMenu.type === 'file'
            ? [
                { icon: '👁️', label: '预览', actionType: 'preview' },
                { icon: '📄', label: '查看详情', actionType: 'view' },
                { icon: '💾', label: '收藏', actionType: 'collect' },
                { icon: '❤️', label: '点赞', actionType: 'like' },
                { icon: '📅', label: '添加到学习计划', actionType: 'addToPlan' }
              ]
            : []
        }
      />
    </div>
  )
}

export default KnowledgeBase
