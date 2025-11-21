import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'


const ExamCategoryManagement = () => {
  const [categories, setCategories] = useState([])
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [usageStats, setUsageStats] = useState({})
  const [dragging, setDragging] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    weight: 0,
    status: 'active',
    parent_id: null,
    description: '',
    icon: '📚'
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const [treeRes, statsRes] = await Promise.all([
        axios.get(getApiUrl('/api/exam-categories/tree'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        axios.get(getApiUrl('/api/exam-categories/usage-stats'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ])
      const tdata = treeRes.data?.data || []
      setTree(Array.isArray(tdata) ? tdata : [])
      const statsArr = statsRes.data?.data || []
      const stats = {}
      statsArr.forEach(s => { stats[s.id] = s.exam_count || 0 })
      setUsageStats(stats)
      const flatten = (nodes, depth = 0, acc = []) => {
        nodes.forEach(n => {
          acc.push({ ...n, depth })
          if (Array.isArray(n.children) && n.children.length) flatten(n.children, depth + 1, acc)
        })
        return acc
      }
      setCategories(flatten(tdata))
    } catch (error) {
      console.error('获取分类失败:', error)
      toast.error('获取分类列表失败')
      setCategories([])
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = { ...formData, weight: Number(formData.weight) }
      if (editingCategory) {
        await axios.put(getApiUrl(`/api/exam-categories/${editingCategory.id}`), payload, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        toast.success('分类更新成功')
      } else {
        await axios.post(getApiUrl('/api/exam-categories'), payload, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        toast.success('分类创建成功')
      }
      setShowModal(false)
      resetForm()
      fetchCategories()
    } catch (error) {
      console.error('提交失败:', error)
      toast.error(editingCategory ? '更新失败' : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个分类吗？')) return

    try {
      await axios.delete(getApiUrl(`/api/exam-categories/${id}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      toast.success('分类删除成功')
      fetchCategories()
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '📚'
    })
    setEditingCategory(null)
  }

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDragEnd = async (result) => {
    setDragging(false)
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.index === source.index) return
    const item = filteredCategories[source.index]
    const target = filteredCategories[destination.index]
    if (!item || !target) return
    if ((item.parent_id || null) !== (target.parent_id || null)) {
      toast.error('仅支持同级拖拽排序')
      return
    }
    try {
      const siblings = filteredCategories.filter(c => (c.parent_id || null) === (item.parent_id || null))
      const newOrder = destination.index < source.index ? Math.max(1, (item.order_num || 1) - 1) : (item.order_num || 1) + 1
      await axios.put(getApiUrl('/api/exam-categories/reorder'), {
        moves: [{ id: item.id, parent_id: item.parent_id || null, order_num: newOrder }]
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      fetchCategories()
    } catch (e) {
      toast.error('拖拽排序失败')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📁 试卷分类管理</h1>
        <p className="text-gray-600 mt-1">管理试卷分类，便于组织和查找试卷</p>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            ➕ 新建分类
          </button>
          <button
            onClick={async () => {
              try {
                const res = await axios.get(getApiUrl('/api/exam-categories/export.xlsx'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, responseType: 'blob' })
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = '考试分类.xlsx'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('导出成功')
              } catch (e) {
                toast.error('导出失败')
              }
            }}
            className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
          >
            ⬇️ 导出
          </button>
          <label className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer">
            ⬆️ 导入
            <input type="file" className="hidden" accept=".xlsx" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const form = new FormData()
                form.append('file', file)
                const res = await axios.post(getApiUrl('/api/exam-categories/import.xlsx'), form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                toast.success(`导入完成：成功 ${res.data?.data?.success_count || 0}`)
                fetchCategories()
              } catch (err) {
                toast.error('导入失败')
              }
              e.target.value = ''
            }} />
          </label>
          <input
            type="text"
            placeholder="搜索分类..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 分类列表 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">暂无分类</p>
        </div>
      ) : (
        <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
          <Droppable droppableId="category-list" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCategories.map((category, index) => (
                  <Draggable key={category.id} draggableId={String(category.id)} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`bg-white rounded-lg shadow-sm p-6 transition-all border ${snapshot.isDragging ? 'border-primary-500 shadow-lg' : 'border-gray-200 hover:shadow-md'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="text-4xl">{category.icon || '📁'}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCategory(category)
                                setFormData({
                                  name: category.name,
                                  code: category.code || '',
                                  weight: category.weight || 0,
                                  status: category.status || 'active',
                                  parent_id: category.parent_id || null,
                                  description: category.description || '',
                                  icon: category.icon || '📚'
                                })
                                setShowModal(true)
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="编辑"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(category.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-900 text-lg mb-2">
                          <span style={{ paddingLeft: `${category.depth * 16}px` }}>
                            {category.name}
                          </span>
                        </h3>

                        {category.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {category.description}
                          </p>
                        )}

                        <div className="text-sm text-gray-500">
                          <div className="flex items-center gap-3">
                            <span>编码：{category.code}</span>
                            <span>权重：{category.weight}</span>
                            <span>状态：{category.status === 'active' ? '启用' : category.status === 'inactive' ? '停用' : '已删除'}</span>
                            <span>📋 {usageStats[category.id] || 0} 份试卷</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={async () => {
                              try {
                                const moves = [{ id: category.id, parent_id: category.parent_id, order_num: (category.order_num || 1) - 1 }]
                                await axios.put(getApiUrl('/api/exam-categories/reorder'), { moves }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                                fetchCategories()
                              } catch { toast.error('上移失败') }
                            }}>上移</button>
                            <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={async () => {
                              try {
                                const moves = [{ id: category.id, parent_id: category.parent_id, order_num: (category.order_num || 1) + 1 }]
                                await axios.put(getApiUrl('/api/exam-categories/reorder'), { moves }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                                fetchCategories()
                              } catch { toast.error('下移失败') }
                            }}>下移</button>
                            <select className="px-2 py-1 text-xs border rounded" value={category.parent_id || ''} onChange={async (e) => {
                              const newParent = e.target.value ? parseInt(e.target.value, 10) : null
                              try {
                                await axios.put(getApiUrl(`/api/exam-categories/${category.id}`), { parent_id: newParent }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                                fetchCategories()
                              } catch { toast.error('调整父级失败') }
                            }}>
                              <option value="">置为顶级</option>
                              {categories.filter(c => c.id !== category.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* 创建/编辑Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                {editingCategory ? '编辑分类' : '新建分类'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分类名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="如：产品知识、技能考核"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">编码 *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：KNOWLEDGE_BASIC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">权重</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">父级分类</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">置为顶级</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">图标</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="输入emoji图标"
                />
                <p className="text-xs text-gray-500 mt-1">
                  常用图标：📚 📖 📝 💼 🎓 🔧 💡 🎯
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="输入分类描述"
                />
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
    </div>
  )
}

export default ExamCategoryManagement
