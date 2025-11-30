import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import './ExamCategoryManagement.css'


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
    <div className="exam-category-management">
      <div className="exam-category-header">
        <h1>📁 试卷分类管理</h1>
        <p>管理试卷分类，便于组织和查找试卷</p>
      </div>

      {/* 操作栏 */}
      <div className="exam-category-toolbar">
        <div className="toolbar-actions">
          <button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
            className="btn-flat-primary"
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
            className="btn-flat-success"
          >
            ⬇️ 导出
          </button>
          <label className="btn-flat-info cursor-pointer">
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
            className="search-input-flat"
          />
        </div>
      </div>

      {/* 分类列表 */}
      {loading ? (
        <div className="loading-container-flat">
          <div className="spinner-flat"></div>
          <p className="loading-text-flat">加载中...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="empty-container-flat">
          <p className="empty-text-flat">暂无分类</p>
        </div>
      ) : (
        <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
          <Droppable droppableId="category-list" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="category-grid">
                {filteredCategories.map((category, index) => (
                  <Draggable key={category.id} draggableId={String(category.id)} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`category-card-flat ${snapshot.isDragging ? 'dragging' : ''}`}
                      >
                        <div className="card-header-flat">
                          <div className="card-icon">{category.icon || '📁'}</div>
                          <div className="card-actions-flat">
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
                              className="card-action-btn edit"
                              title="编辑"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(category.id)}
                              className="card-action-btn delete"
                              title="删除"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <h3 className="card-title-flat">
                          <span style={{ paddingLeft: `${category.depth * 16}px` }}>
                            {category.name}
                          </span>
                        </h3>

                        {category.description && (
                          <p className="card-description-flat">
                            {category.description}
                          </p>
                        )}

                        <div className="card-meta-flat">
                          <div className="meta-row">
                            <span className="meta-item">编码：{category.code}</span>
                            <span className="meta-item">权重：{category.weight}</span>
                            <span className="meta-item">状态：{category.status === 'active' ? '启用' : category.status === 'inactive' ? '停用' : '已删除'}</span>
                            <span className="meta-item">📋 {usageStats[category.id] || 0} 份试卷</span>
                          </div>
                          <div className="quick-actions">
                            <button className="quick-btn" onClick={async () => {
                              try {
                                const moves = [{ id: category.id, parent_id: category.parent_id, order_num: (category.order_num || 1) - 1 }]
                                await axios.put(getApiUrl('/api/exam-categories/reorder'), { moves }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                                fetchCategories()
                              } catch { toast.error('上移失败') }
                            }}>上移</button>
                            <button className="quick-btn" onClick={async () => {
                              try {
                                const moves = [{ id: category.id, parent_id: category.parent_id, order_num: (category.order_num || 1) + 1 }]
                                await axios.put(getApiUrl('/api/exam-categories/reorder'), { moves }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                                fetchCategories()
                              } catch { toast.error('下移失败') }
                            }}>下移</button>
                            <select className="quick-btn" value={category.parent_id || ''} onChange={async (e) => {
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
        <div className="modal-overlay-flat">
          <div className="modal-content-flat">
            <div className="modal-header-flat">
              <h2 className="modal-title-flat">
                {editingCategory ? '编辑分类' : '新建分类'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body-flat">
              <div className="form-group-flat">
                <label className="form-label-flat">分类名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input-flat"
                  placeholder="如：产品知识、技能考核"
                />
              </div>

              <div className="form-group-flat">
                <div>
                  <label className="form-label-flat">编码 *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="form-input-flat"
                    placeholder="如：KNOWLEDGE_BASIC"
                  />
                </div>
                <div>
                  <label className="form-label-flat">权重</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                    className="form-input-flat"
                    placeholder="如：10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label-flat">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-select-flat"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>
                <div>
                  <label className="form-label-flat">父级分类</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="form-select-flat"
                  >
                    <option value="">置为顶级</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-flat">
                <label className="form-label-flat">图标</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="form-input-flat"
                  placeholder="输入emoji图标"
                />
                <p className="form-hint-flat">
                  常用图标：📚 📖 📝 💼 🎓 🔧 💡 🎯
                </p>
              </div>

              <div className="form-group-flat">
                <label className="form-label-flat">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className="form-textarea-flat"
                  placeholder="输入分类描述"
                />
              </div>

              <div className="modal-footer-flat">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-flat-primary"
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
