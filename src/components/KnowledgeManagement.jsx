import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { categoryIcons } from '../utils/iconOptions'
import { getApiUrl } from '../utils/apiConfig'


const KnowledgeManagement = () => {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    icon: '📚'
  })

  useEffect(() => {
    fetchArticles()
    fetchCategories()
  }, [])

  const fetchArticles = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/articles'))
      setArticles(response.data || [])
    } catch (error) {
      console.error('获取文档失败:', error)
      setArticles([])
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/knowledge/categories'))
      setCategories(response.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
      setCategories([])
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
      setShowCategoryModal(false)
      resetCategoryForm()
      await fetchCategories()
    } catch (error) {
      toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', description: '', icon: '📚' })
    setEditingCategory(null)
  }

  const handleRestoreArticle = async (id) => {
    try {
      const article = articles.find(a => a.id === id)
      if (!article) return
      await axios.put(getApiUrl(`/api/knowledge/articles/${id}`), {
        ...article,
        status: 'draft',
        attachments: article.attachments
      })
      toast.success('文档已还原')
      fetchArticles()
    } catch (error) {
      toast.error('还原失败')
    }
  }

  const handlePermanentDelete = async (id) => {
    if (!window.confirm('确定要永久删除吗？此操作无法撤销！')) return
    try {
      await axios.delete(getApiUrl(`/api/knowledge/articles/${id}`))
      toast.success('已永久删除')
      fetchArticles()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const getDeletedArticles = () => {
    return articles.filter(a => a.status === 'deleted')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">知识库管理</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            📁 管理分类
          </button>
          <button
            onClick={() => setShowTrashModal(true)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            🗑️ 垃圾箱 ({getDeletedArticles().length})
          </button>
        </div>
      </div>

      {/* 分类管理Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">分类管理</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleCategorySubmit} className="space-y-4 mb-6">
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="分类名称"
                />
                <select
                  value={categoryFormData.icon}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {categoryIcons.map(icon => (
                    <option key={icon.value} value={icon.value}>{icon.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {editingCategory ? '更新' : '添加'}
                </button>
              </form>

              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat.name}</span>
                          {cat.is_hidden === 1 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">已隐藏</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!window.confirm(
                            cat.is_hidden === 1
                              ? `确定显示分类"${cat.name}"吗？该分类下所有文档将改为"已发布"。`
                              : `确定隐藏分类"${cat.name}"吗？该分类下所有文档将改为"已归档"。`
                          )) return
                          try {
                            setLoading(true)
                            const response = await axios.post(
                              getApiUrl(`/api/knowledge/categories/${cat.id}/toggle-visibility`),
                              { is_hidden: cat.is_hidden === 1 ? 0 : 1 }
                            )
                            toast.success(response.data.message || '操作成功')
                            await fetchCategories()
                            await fetchArticles()
                          } catch (error) {
                            toast.error('操作失败')
                          } finally {
                            setLoading(false)
                          }
                        }}
                        disabled={loading}
                        className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                          cat.is_hidden === 1
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
                      >
                        {cat.is_hidden === 1 ? '👁️ 显示' : '🔒 隐藏'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategory(cat)
                          setCategoryFormData({
                            name: cat.name,
                            description: cat.description || '',
                            icon: cat.icon || '📚'
                          })
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        ✏️ 编辑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t">
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    resetCategoryForm()
                  }}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 垃圾箱Modal */}
      {showTrashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">🗑️ 垃圾箱</h2>
            </div>
            <div className="p-6">
              {getDeletedArticles().length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🗑️</div>
                  <p>垃圾箱是空的</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getDeletedArticles().map(article => (
                    <div key={article.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">{article.icon || '📄'}</span>
                        <div>
                          <div className="font-medium">{article.title}</div>
                          {article.summary && (
                            <div className="text-sm text-gray-500">{article.summary}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreArticle(article.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          ↩️ 还原
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(article.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          🗑️ 永久删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-4 mt-4 border-t">
                <button
                  onClick={() => setShowTrashModal(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeManagement
