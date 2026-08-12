import api from '@/api';
import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig'


const RecycleBin = ({ isOpen, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('categories') // 'categories' | 'articles'
  const [deletedCategories, setDeletedCategories] = useState([])
  const [deletedArticles, setDeletedArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 还原确认模态框
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoreType, setRestoreType] = useState(null) // 'category' | 'article'
  const [restoreArticles, setRestoreArticles] = useState(true) // 是否同时还原文档

  // 永久删除确认模态框
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteType, setDeleteType] = useState(null) // 'category' | 'article'

  // 清空回收站确认模态框
  const [showEmptyModal, setShowEmptyModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchRecycleBin()
    }
  }, [isOpen])

  const fetchRecycleBin = async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoriesRes, articlesRes] = await Promise.all([
        api.get(getApiUrl('/api/knowledge/recycle-bin/categories')),
        api.get(getApiUrl('/api/knowledge/recycle-bin/articles'))
      ])

      setDeletedCategories(categoriesRes.data.data || [])
      setDeletedArticles(articlesRes.data.data || [])
      setError(null)
    } catch (error) {
      logger.error('获取回收站数据失败:', error)
      const errorMessage = error.response?.status === 403 ? '权限不足，无法访问回收站' :
                          error.response?.status === 500 ? '服务器错误，请稍后再试' :
                          error.response?.data?.error || error.message || '获取回收站数据失败'
      setError(errorMessage)
      toast.error(errorMessage)
      setDeletedCategories([])
      setDeletedArticles([])
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    fetchRecycleBin()
  }

  // 打开还原确认模态框
  const handleOpenRestoreModal = (item, type) => {
    setRestoreTarget(item)
    setRestoreType(type)
    setRestoreArticles(true)
    setShowRestoreModal(true)
  }

  // 确认还原
  const handleConfirmRestore = async () => {
    if (!restoreTarget || !restoreType) return

    setActionLoading(true)
    try {
      if (restoreType === 'category') {
        await api.post(
          getApiUrl(`/api/knowledge/recycle-bin/categories/${restoreTarget.id}/restore`),
          { restoreArticles }
        )
        toast.success(`分类"${restoreTarget.name}"已还原`)
      } else {
        await api.post(
          getApiUrl(`/api/knowledge/recycle-bin/articles/${restoreTarget.id}/restore`)
        )
        toast.success(`文档"${restoreTarget.title}"已还原`)
      }

      setShowRestoreModal(false)
      setRestoreTarget(null)
      setRestoreType(null)
      await fetchRecycleBin()
      if (onRefresh) onRefresh()
    } catch (error) {
      logger.error('还原失败:', error)
      const errorMessage = error.response?.status === 404 ? '项目不存在或已被永久删除' :
                          error.response?.status === 409 ? '名称冲突，请先重命名' :
                          error.response?.status === 403 ? '权限不足，无法还原' :
                          error.response?.data?.error || error.message || '还原失败'
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  // 打开永久删除确认模态框
  const handleOpenDeleteModal = (item, type) => {
    setDeleteTarget(item)
    setDeleteType(type)
    setShowDeleteModal(true)
  }

  // 确认永久删除
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteType) return

    setActionLoading(true)
    try {
      if (deleteType === 'category') {
        await api.delete(
          getApiUrl(`/api/knowledge/recycle-bin/categories/${deleteTarget.id}/permanent`)
        )
        toast.success(`分类"${deleteTarget.name}"已永久删除`)
      } else {
        await api.delete(
          getApiUrl(`/api/knowledge/recycle-bin/articles/${deleteTarget.id}/permanent`)
        )
        toast.success(`文档"${deleteTarget.title}"已永久删除`)
      }

      setShowDeleteModal(false)
      setDeleteTarget(null)
      setDeleteType(null)
      await fetchRecycleBin()
      if (onRefresh) onRefresh()
    } catch (error) {
      logger.error('永久删除失败:', error)
      const errorMessage = error.response?.status === 403 ? '权限不足，无法永久删除' :
                          error.response?.status === 404 ? '项目不存在' :
                          error.response?.data?.error || error.message || '永久删除失败'
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  // 打开清空回收站确认模态框
  const handleOpenEmptyModal = () => {
    setShowEmptyModal(true)
  }

  // 确认清空回收站
  const handleConfirmEmpty = async () => {
    setActionLoading(true)
    try {
      await api.post(getApiUrl('/api/knowledge/recycle-bin/empty'), {
        type: 'all'
      })
      toast.success('回收站已清空')
      setShowEmptyModal(false)
      await fetchRecycleBin()
      if (onRefresh) onRefresh()
    } catch (error) {
      logger.error('清空回收站失败:', error)
      const errorMessage = error.response?.status === 403 ? '权限不足，无法清空回收站' :
                          error.response?.data?.error || error.message || '清空回收站失败'
      toast.error(errorMessage)
    } finally {
      setActionLoading(false)
    }
  }

  

  if (!isOpen) return null

  const totalItems = deletedCategories.length + deletedArticles.length

  return (
    <>
      {/* 回收站主模态框 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
          {/* 头部 */}
          <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <span className="text-3xl sm:text-4xl flex-shrink-0">🗑️</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">回收站</h2>
                <p className="text-gray-600 text-xs sm:text-sm truncate">
                  共 {totalItems} 项 ({deletedCategories.length} 个分类, {deletedArticles.length} 篇文档)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex-shrink-0 ml-2"
              title="关闭"
            >
              ✕
            </button>
          </div>

          {/* 标签页和操作栏 */}
          <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
            <div className="flex gap-1 sm:gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap text-xs sm:text-base ${
                  activeTab === 'categories'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📁 分类 ({deletedCategories.length})
              </button>
              <button
                onClick={() => setActiveTab('articles')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap text-xs sm:text-base ${
                  activeTab === 'articles'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📄 文档 ({deletedArticles.length})
              </button>
            </div>

            {totalItems > 0 && (
              <button
                onClick={handleOpenEmptyModal}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-base whitespace-nowrap"
              >
                🗑️ 清空回收站
              </button>
            )}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <p className="mt-2 text-gray-600">加载中...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-gray-700 text-lg font-medium mb-2">加载失败</p>
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
                {/* 分类列表 */}
                {activeTab === 'categories' && (
                  <div>
                    {deletedCategories.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center">
                        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📂</div>
                        <p className="text-gray-500 text-sm sm:text-base">回收站中没有已删除的分类</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {deletedCategories.map(category => (
                          <div
                            key={category.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                              <span className="text-3xl sm:text-4xl flex-shrink-0">{category.icon || '📁'}</span>
                              <div className="flex-1 min-w-0 w-full">
                                <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1 break-words">
                                  {category.name}
                                </h3>
                                {category.description && (
                                  <p className="text-xs sm:text-sm text-gray-600 mb-2 break-words">
                                    {category.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                  <span>📄 {category.article_count || 0} 篇文档</span>
                                  <span className="hidden sm:inline">🗑️ {formatDate(category.deleted_at)}</span>
                                  <span className="sm:hidden">🗑️ {formatDate(category.deleted_at)}</span>
                                  {category.deleted_by_name && (
                                    <span>👤 {category.deleted_by_name}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0">
                                <button
                                  onClick={() => handleOpenRestoreModal(category, 'category')}
                                  className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs sm:text-base"
                                  title="还原分类"
                                >
                                  ↩️ 还原
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteModal(category, 'category')}
                                  className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-base"
                                  title="永久删除"
                                >
                                  🗑️ <span className="hidden sm:inline">永久删除</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 文档列表 */}
                {activeTab === 'articles' && (
                  <div>
                    {deletedArticles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center">
                        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📄</div>
                        <p className="text-gray-500 text-sm sm:text-base">回收站中没有已删除的文档</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {deletedArticles.map(article => (
                          <div
                            key={article.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                              <span className="text-3xl sm:text-4xl flex-shrink-0">{article.icon || '📄'}</span>
                              <div className="flex-1 min-w-0 w-full">
                                <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1 break-words">
                                  {article.title}
                                </h3>
                                {article.summary && (
                                  <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2 break-words">
                                    {article.summary}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                  {article.category_name && (
                                    <span>📁 {article.category_name}</span>
                                  )}
                                  <span className="hidden sm:inline">🗑️ {formatDate(article.deleted_at)}</span>
                                  <span className="sm:hidden">🗑️ {formatDate(article.deleted_at)}</span>
                                  {article.author_name && (
                                    <span>👤 {article.author_name}</span>
                                  )}
                                  {article.type && (
                                    <span>
                                      {article.type === 'company' ? '🏢' :
                                       article.type === 'personal' ? '👤' : '🤝'}
                                      <span className="hidden sm:inline ml-1">
                                        {article.type === 'company' ? '公司知识' :
                                         article.type === 'personal' ? '个人知识' : '共享知识'}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0">
                                <button
                                  onClick={() => handleOpenRestoreModal(article, 'article')}
                                  className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs sm:text-base"
                                  title="还原文档"
                                >
                                  ↩️ 还原
                                </button>
                                <button
                                  onClick={() => handleOpenDeleteModal(article, 'article')}
                                  className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-base"
                                  title="永久删除"
                                >
                                  🗑️ <span className="hidden sm:inline">永久删除</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 底部 */}
          <div className="p-3 sm:p-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* 还原确认模态框 */}
      {showRestoreModal && restoreTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-3 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-bold text-gray-800">
                还原{restoreType === 'category' ? '分类' : '文档'}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{restoreTarget.icon || (restoreType === 'category' ? '📁' : '📄')}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {restoreType === 'category' ? restoreTarget.name : restoreTarget.title}
                    </p>
                    {restoreTarget.description && (
                      <p className="text-sm text-gray-500">{restoreTarget.description}</p>
                    )}
                    {restoreTarget.summary && (
                      <p className="text-sm text-gray-500">{restoreTarget.summary}</p>
                    )}
                  </div>
                </div>

                {restoreType === 'category' && restoreTarget.article_count > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 text-xl">ℹ️</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 font-medium mb-2">
                          该分类下有 {restoreTarget.article_count} 篇文档
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restoreArticles}
                            onChange={(e) => setRestoreArticles(e.target.checked)}
                            className="w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">
                            同时还原该分类下的所有文档
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        还原后，{restoreType === 'category' ? '分类' : '文档'}将恢复到原来的位置
                        {restoreType === 'category' && restoreArticles && '，文档状态将恢复为"已发布"'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRestoreModal(false)
                    setRestoreTarget(null)
                    setRestoreType(null)
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmRestore}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>还原中...</span>
                    </>
                  ) : (
                    <>✅ 确认还原</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 永久删除确认模态框 */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-3 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-bold text-red-600">
                ⚠️ 永久删除{deleteType === 'category' ? '分类' : '文档'}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{deleteTarget.icon || (deleteType === 'category' ? '📁' : '📄')}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {deleteType === 'category' ? deleteTarget.name : deleteTarget.title}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm text-red-700 font-medium mb-2">
                        此操作无法撤销！
                      </p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• {deleteType === 'category' ? '分类' : '文档'}将被永久删除</li>
                        {deleteType === 'category' && deleteTarget.article_count > 0 && (
                          <li>• 该分类下的 {deleteTarget.article_count} 篇文档也将被永久删除</li>
                        )}
                        <li>• 所有相关数据将无法恢复</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteTarget(null)
                    setDeleteType(null)
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>删除中...</span>
                    </>
                  ) : (
                    <>🗑️ 确认永久删除</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 清空回收站确认模态框 */}
      {showEmptyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-3 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-bold text-red-600">
                ⚠️ 清空回收站
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm text-red-700 font-medium mb-2">
                        此操作无法撤销！
                      </p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• 将永久删除 {deletedCategories.length} 个分类</li>
                        <li>• 将永久删除 {deletedArticles.length} 篇文档</li>
                        <li>• 所有数据将无法恢复</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEmptyModal(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmEmpty}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>清空中...</span>
                    </>
                  ) : (
                    <>🗑️ 确认清空回收站</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default RecycleBin
