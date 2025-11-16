import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { categoryIcons } from '../utils/iconOptions'
import AdvancedSearch from './AdvancedSearch'
import { getApiUrl } from '../utils/apiConfig'


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

  // 高级搜索
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)

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

  const handleOpenFolder = (category) => {
    setCurrentFolderCategory(category)
    setFolderSearchTerm('')
    setCurrentPage(1)
    setShowFolderModal(true)
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
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary-300 overflow-hidden group relative"
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
                          <div className="text-5xl">{category.icon}</div>
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
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary-300 overflow-hidden group"
                    onClick={() => handleOpenFolder({ id: 'uncategorized', name: '未分类', icon: '📂', description: '未指定分类的文档' })}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
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

            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
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
              <span className="text-sm text-gray-600 whitespace-nowrap">
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
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {getPaginatedArticles().map(article => (
                    <div
                      key={article.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all hover:border-primary-400 group aspect-square flex flex-col"
                    >
                      {/* 大图标 */}
                      <div
                        className="flex items-center justify-center mb-3 flex-shrink-0 cursor-pointer"
                        onClick={() => setPreviewFile(article)}
                      >
                        <span className="text-5xl group-hover:scale-110 transition-transform">
                          {article.icon || '📄'}
                        </span>
                      </div>

                      {/* 标题 */}
                      <h3
                        className="font-semibold text-gray-900 mb-2 line-clamp-2 text-center text-sm cursor-pointer hover:text-primary-600 transition-colors flex-shrink-0"
                        onClick={() => setPreviewFile(article)}
                        title={article.title}
                      >
                        {article.title}
                      </h3>

                      {/* 笔记提示 */}
                      {article.notes && (
                        <div className="text-xs text-yellow-600 text-center mb-2 flex-shrink-0">
                          💡 有笔记
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="mt-auto pt-3 border-t border-gray-100 flex-shrink-0">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveArticle(article)
                            }}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="移动"
                          >
                            📁
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewArticle(article)
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="编辑"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteArticle(article)
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>

                        {/* 附件信息 */}
                        {parseAttachments(article.attachments).length > 0 && (
                          <div className="text-xs text-gray-400 text-center">
                            📎 {parseAttachments(article.attachments).length} 个附件
                          </div>
                        )}
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
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className={`px-4 py-2 border rounded-lg ${
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
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div className="flex-1 pr-10">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedArticle.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>📅 {new Date(selectedArticle.created_at).toLocaleDateString()}</span>
                  {selectedArticle.category_name && (
                    <span>📁 {selectedArticle.category_name}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowArticleModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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
                      <a
                        key={index}
                        href={file.url}
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

      {/* 文档预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
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
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  handleViewArticle(previewFile)
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

      {/* 删除确认模态框 */}
      {showDeleteModal && articleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">确认删除文档</h3>
                  <p className="text-sm text-gray-500">此操作将移至回收站</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700">
                  确定要删除文档 <span className="font-bold">"{articleToDelete.title}"</span> 吗？
                  删除后可以在回收站中恢复。
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setArticleToDelete(null)
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteArticle}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyKnowledgeBase
