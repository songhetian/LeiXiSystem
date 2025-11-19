import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import axios from 'axios'
import { useDebounce } from '../hooks/useDebounce'
import { getApiBaseUrl } from '../utils/apiConfig'

const API_URL = getApiBaseUrl()

const AdvancedSearch = ({ isOpen, onClose, embedded = false, onSearch, onEdit, onMove, onDelete, onPreview }) => {
  // 搜索条件
  const [keyword, setKeyword] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [selectedAuthors, setSelectedAuthors] = useState([])
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
    field: 'created_at'
  })
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // 搜索结果
  const [searchResults, setSearchResults] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // 可用选项
  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])

  // 防抖搜索关键词
  const debouncedKeyword = useDebounce(keyword, 500)

  // 文档类型选项
  const typeOptions = [
    { value: 'company', label: '🏢 公司知识' },
    { value: 'personal', label: '👤 个人知识' },
    { value: 'shared', label: '🤝 共享知识' }
  ]

  // 文档状态选项
  const statusOptions = [
    { value: 'draft', label: '📝 草稿' },
    { value: 'published', label: '✅ 已发布' },
    { value: 'archived', label: '📦 已归档' }
  ]

  // 排序选项
  const sortOptions = [
    { value: 'created_at', label: '创建时间' },
    { value: 'updated_at', label: '更新时间' },
    { value: 'view_count', label: '浏览量' },
    { value: 'like_count', label: '点赞数' }
  ]

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
      fetchAuthors()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      performSearch()
    }
  }, [debouncedKeyword, selectedCategories, selectedTypes, selectedStatuses, selectedAuthors, dateRange, sortBy, sortOrder, currentPage])

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/knowledge/categories`)
      setCategories(response.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  const fetchAuthors = async () => {
    try {
      // 获取所有文档的作者列表（去重）
      const response = await axios.get(`${API_URL}/knowledge/articles`)
      const articles = response.data || []
      const authorMap = new Map()

      articles.forEach(article => {
        if (article.created_by && article.author_name) {
          authorMap.set(article.created_by, article.author_name)
        }
      })

      const authorList = Array.from(authorMap, ([id, name]) => ({ id, name }))
      setAuthors(authorList)
    } catch (error) {
      console.error('获取作者列表失败:', error)
    }
  }

  const performSearch = async (retryCount = 0) => {
    setLoading(true)
    setError(null)
    try {
      const searchParams = {
        keyword: debouncedKeyword,
        categories: selectedCategories,
        types: selectedTypes,
        statuses: selectedStatuses,
        authors: selectedAuthors,
        dateRange: dateRange.start || dateRange.end ? dateRange : null,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize
      }

      const response = await axios.post(`${API_URL}/knowledge/articles/search`, searchParams)

      if (response.data.success) {
        const results = response.data.data || response.data
        setSearchResults(results.articles || results || [])
        setTotalResults(results.total || response.data.pagination?.total || 0)
        setStatistics(results.statistics || null)
        setError(null)

        // 如果是嵌入模式且有onSearch回调，调用它
        if (embedded && onSearch) {
          onSearch(response.data)
        }
      } else {
        setSearchResults([])
        setTotalResults(0)
        setStatistics(null)
      }
    } catch (error) {
      console.error('搜索失败:', error)
      const errorMessage = error.response?.status === 400 ? '搜索参数无效' :
                          error.response?.status === 429 ? '搜索请求过于频繁，请稍后再试' :
                          error.response?.status === 500 ? '服务器错误，请稍后再试' :
                          error.response?.data?.error || error.message || '搜索失败'

      setError(errorMessage)
      toast.error(errorMessage)
      setSearchResults([])
      setTotalResults(0)
      setStatistics(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    performSearch()
  }

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
    setCurrentPage(1)
  }

  const handleTypeToggle = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
    setCurrentPage(1)
  }

  const handleStatusToggle = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
    setCurrentPage(1)
  }

  const handleAuthorToggle = (authorId) => {
    setSelectedAuthors(prev =>
      prev.includes(authorId)
        ? prev.filter(id => id !== authorId)
        : [...prev, authorId]
    )
    setCurrentPage(1)
  }

  const handleReset = () => {
    setKeyword('')
    setSelectedCategories([])
    setSelectedTypes([])
    setSelectedStatuses([])
    setSelectedAuthors([])
    setDateRange({ start: '', end: '', field: 'created_at' })
    setSortBy('created_at')
    setSortOrder('desc')
    setCurrentPage(1)
  }

  const handleStatisticClick = (type, value) => {
    // 点击统计项快速筛选
    if (type === 'category') {
      const category = categories.find(c => c.name === value)
      if (category && !selectedCategories.includes(category.id)) {
        setSelectedCategories([category.id])
        setCurrentPage(1)
      }
    } else if (type === 'type') {
      if (!selectedTypes.includes(value)) {
        setSelectedTypes([value])
        setCurrentPage(1)
      }
    }
  }

  const getTotalPages = () => {
    return Math.ceil(totalResults / pageSize)
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

  const getStatusLabel = (status) => {
    const labels = {
      draft: '草稿',
      published: '已发布',
      archived: '已归档'
    }
    return labels[status] || status
  }

  const getTypeLabel = (type) => {
    const labels = {
      company: '公司知识',
      personal: '个人知识',
      shared: '共享知识'
    }
    return labels[type] || type
  }

  if (!isOpen && !embedded) return null

  const containerClass = embedded
    ? "bg-gray-50 rounded-lg"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"

  const contentClass = embedded
    ? "w-full"
    : "bg-white rounded-lg w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] flex flex-col"

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* 头部 */}
        {!embedded && (
          <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">🔍 高级搜索</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">多维度搜索知识文档</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* 搜索条件区域 */}
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50 overflow-y-auto max-h-[40vh] sm:max-h-none">
          <div className="space-y-3 sm:space-y-4">
            {/* 关键词搜索 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                关键词搜索
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="搜索标题、内容或摘要..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* 筛选条件 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* 分类筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分类筛选 ({selectedCategories.length} 个已选)
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto bg-white">
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">暂无分类</p>
                  ) : (
                    <div className="space-y-2">
                      {categories.map(category => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category.id)}
                            onChange={() => handleCategoryToggle(category.id)}
                            className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-sm">
                            {category.icon} {category.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 类型筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  类型筛选 ({selectedTypes.length} 个已选)
                </label>
                <div className="border border-gray-300 rounded-lg p-3 bg-white">
                  <div className="space-y-2">
                    {typeOptions.map(option => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(option.value)}
                          onChange={() => handleTypeToggle(option.value)}
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 状态筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态筛选 ({selectedStatuses.length} 个已选)
                </label>
                <div className="border border-gray-300 rounded-lg p-3 bg-white">
                  <div className="space-y-2">
                    {statusOptions.map(option => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(option.value)}
                          onChange={() => handleStatusToggle(option.value)}
                          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 日期范围筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日期范围筛选
                </label>
                <div className="border border-gray-300 rounded-lg p-3 bg-white space-y-2">
                  <select
                    value={dateRange.field}
                    onChange={(e) => setDateRange({ ...dateRange, field: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="created_at">创建时间</option>
                    <option value="updated_at">更新时间</option>
                  </select>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => {
                      setDateRange({ ...dateRange, start: e.target.value })
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="开始日期"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => {
                      setDateRange({ ...dateRange, end: e.target.value })
                      setCurrentPage(1)
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="结束日期"
                  />
                </div>
              </div>
            </div>

            {/* 排序选项 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  排序方式
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  排序顺序
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                >
                  <option value="desc">降序（新到旧）</option>
                  <option value="asc">升序（旧到新）</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm sm:text-base"
                >
                  🔄 重置
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索结果区域 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-gray-600">搜索中...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-gray-700 text-lg font-medium mb-2">搜索出错</p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                🔄 重试
              </button>
            </div>
          ) : (
            <>
              {/* 统计信息 */}
              {statistics && (
                <div className="mb-4 sm:mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2 sm:mb-3">📊 搜索统计</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* 按分类统计 */}
                    {statistics.byCategory && Object.keys(statistics.byCategory).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2">按分类</h4>
                        <div className="space-y-1">
                          {Object.entries(statistics.byCategory).map(([name, count]) => (
                            <button
                              key={name}
                              onClick={() => handleStatisticClick('category', name)}
                              className="w-full text-left px-2 py-1 text-xs bg-white rounded hover:bg-blue-100 transition-colors flex items-center justify-between"
                            >
                              <span className="truncate">{name}</span>
                              <span className="font-medium text-primary-600">{count}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 按类型统计 */}
                    {statistics.byType && Object.keys(statistics.byType).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2">按类型</h4>
                        <div className="space-y-1">
                          {Object.entries(statistics.byType).map(([type, count]) => (
                            <button
                              key={type}
                              onClick={() => handleStatisticClick('type', type)}
                              className="w-full text-left px-2 py-1 text-xs bg-white rounded hover:bg-blue-100 transition-colors flex items-center justify-between"
                            >
                              <span>{getTypeLabel(type)}</span>
                              <span className="font-medium text-primary-600">{count}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 按作者统计 */}
                    {statistics.byAuthor && Object.keys(statistics.byAuthor).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2">按作者</h4>
                        <div className="space-y-1">
                          {Object.entries(statistics.byAuthor).slice(0, 5).map(([author, count]) => (
                            <div
                              key={author}
                              className="px-2 py-1 text-xs bg-white rounded flex items-center justify-between"
                            >
                              <span className="truncate">{author || '未知'}</span>
                              <span className="font-medium text-primary-600">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 结果数量 */}
              <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                  搜索结果 <span className="text-primary-600">({totalResults})</span>
                </h3>
                {totalResults > 0 && (
                  <span className="text-xs sm:text-sm text-gray-600">
                    第 {currentPage} / {getTotalPages()} 页
                  </span>
                )}
              </div>

              {/* 搜索结果列表 */}
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🔍</div>
                  <p className="text-gray-500 text-base sm:text-lg">没有找到匹配的文档</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-2">尝试调整搜索条件</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {searchResults.map(article => (
                    <div
                      key={article.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all hover:border-primary-300 active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4
                          className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-2 flex-1 pr-2 cursor-pointer hover:text-primary-600 transition-colors"
                          onClick={() => onPreview && onPreview(article)}
                          title="点击预览"
                        >
                          {article.title}
                        </h4>
                        <span className={`px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 ${
                          article.status === 'published' ? 'bg-green-100 text-green-700' :
                          article.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getStatusLabel(article.status)}
                        </span>
                      </div>

                      {article.summary && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                          {article.summary}
                        </p>
                      )}

                      <div className="space-y-2 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-2">
                          <span>📁 {article.category_name || '未分类'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{getTypeLabel(article.type)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>👁️ {article.view_count || 0}</span>
                          <span>❤️ {article.like_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>👤 {article.author_name || '未知'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>📅 {formatDate(article.created_at)}</span>
                        </div>
                        {parseAttachments(article.attachments).length > 0 && (
                          <div className="flex items-center gap-2">
                            <span>📎 {parseAttachments(article.attachments).length} 个附件</span>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      {(onEdit || onMove || onDelete) && (
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                          {onMove && (
                            <button
                              onClick={() => onMove(article)}
                              className="px-2 py-1 text-purple-600 hover:bg-purple-50 rounded transition-colors text-xs"
                              title="移动到其他分类"
                            >
                              📁 移动
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(article)}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs"
                              title="编辑"
                            >
                              ✏️ 编辑
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(article.id)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-xs"
                              title="删除"
                            >
                              🗑️ 删除
      </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 分页 */}
              {getTotalPages() > 1 && (
                <div className="mt-4 sm:mt-6 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-base"
                  >
                    <span className="hidden sm:inline">← 上一页</span>
                    <span className="sm:hidden">←</span>
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
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 border rounded-lg transition-colors text-xs sm:text-base ${
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
                    onClick={nextPage}
                    disabled={currentPage === getTotalPages()}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-base"
                  >
                    <span className="hidden sm:inline">下一页 →</span>
                    <span className="sm:hidden">→</span>
                  </button>

                  <div className="text-sm text-gray-600 ml-4">
                    共 {totalResults} 条结果
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex items-center justify-end gap-2 sm:gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm sm:text-base"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdvancedSearch
