import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'

function PositionManagement() {
  const [positions, setPositions] = useState([])
  const [filteredPositions, setFilteredPositions] = useState([])
  const [departments, setDepartments] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingPos, setEditingPos] = useState(null)
  const [statusChangingPos, setStatusChangingPos] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: ''
  })
  const [formData, setFormData] = useState({
    name: '',
    department_id: '',
    description: '',
    status: 'active'
  })

  useEffect(() => {
    fetchPositions()
    fetchDepartments()
  }, [])

  useEffect(() => {
    filterPositions()
  }, [searchFilters, positions])

  const filterPositions = () => {
    let filtered = [...positions]

    if (searchFilters.keyword) {
      const keyword = searchFilters.keyword.toLowerCase()
      filtered = filtered.filter(pos =>
        pos.name?.toLowerCase().includes(keyword) ||
        pos.description?.toLowerCase().includes(keyword)
      )
    }

    if (searchFilters.department) {
      filtered = filtered.filter(pos => pos.department_id === parseInt(searchFilters.department))
    }

    setFilteredPositions(filtered)
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(filteredPositions.length / pageSize)
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredPositions.slice(startIndex, endIndex)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSearchChange = (field, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const clearFilters = () => {
    setSearchFilters({
      keyword: '',
      department: ''
    })
  }

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await fetch(getApiUrl('/api/positions?limit=1000'), { headers })
      const result = await response.json()

      // 后端返回格式: { success: true, data: [...] }
      const data = result.success ? result.data : []
      setPositions(data)
      setFilteredPositions(data)
    } catch (error) {
      console.error('获取职位列表失败:', error)
      toast.error('获取职位列表失败')
    }
  }

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // 移除 forManagement=true，使用正常的部门权限过滤
      const response = await fetch(getApiUrl('/api/departments'), { headers })
      const data = await response.json()

      // 部门 API 可能直接返回数组或 { success, data } 格式
      const departments = Array.isArray(data) ? data : (data.success ? data.data : data)
      setDepartments(departments.filter(d => d.status === 'active'))
    } catch (error) {
      console.error('获取部门列表失败:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const url = editingPos
        ? getApiUrl(`/api/positions/${editingPos.id}`)
        : getApiUrl('/api/positions')

      const response = await fetch(url, {
        method: editingPos ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(editingPos ? '职位更新成功' : '职位创建成功')
        setIsModalOpen(false)
        fetchPositions()
        resetForm()
      } else {
        toast.error(result.message || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      toast.error('操作失败')
    }
  }

  const handleEdit = (pos) => {
    setEditingPos(pos)
    setFormData({
      name: pos.name,
      department_id: pos.department_id || '',
      description: pos.description || '',
      status: pos.status
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个职位吗？')) return

    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await fetch(getApiUrl(`/api/positions/${id}`), {
        method: 'DELETE',
        headers
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('职位删除成功')
        fetchPositions()
      } else {
        toast.error(result.message || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
    }
  }

  const handleStatusClick = (pos) => {
    setStatusChangingPos(pos)
    setIsStatusModalOpen(true)
  }

  const handleStatusChange = async (newStatus) => {
    if (!statusChangingPos) return

    // 如果状态没有变化，直接关闭
    if (statusChangingPos.status === newStatus) {
      setIsStatusModalOpen(false)
      setStatusChangingPos(null)
      return
    }

    // 获取该职位的员工数量（需要从后端获取）
    const confirmMsg = `确定要${newStatus === 'active' ? '启用' : '停用'}这个职位吗？\n\n该职位的所有员工状态将同步${newStatus === 'active' ? '启用' : '停用'}。`

    if (!confirm(confirmMsg)) return

    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(getApiUrl(`/api/positions/${statusChangingPos.id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...statusChangingPos,
          status: newStatus
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        const affectedCount = result.affectedEmployees || 0

        if (affectedCount > 0) {
          toast.success(`职位状态已修改，同时更新了 ${affectedCount} 名员工的状态`)
        } else {
          toast.success('职位状态修改成功')
        }

        setIsStatusModalOpen(false)
        setStatusChangingPos(null)
        fetchPositions()
      } else {
        toast.error(result.message || '状态修改失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      toast.error('操作失败')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      department_id: '',
      description: '',
      status: 'active'
    })
    setEditingPos(null)
  }

  return (
    <div className="p-6">
      {/* 头部 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">职位管理</h1>
          <p className="text-sm text-gray-500 mt-1">共 {filteredPositions.length} 个职位</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 视图切换 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm"
          >
            + 新增职位
          </button>
        </div>
      </div>

      {/* 搜索筛选 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="搜索职位名称或描述..."
            value={searchFilters.keyword}
            onChange={(e) => handleSearchChange('keyword', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <select
            value={searchFilters.department}
            onChange={(e) => handleSearchChange('department', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">全部部门</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
        {(searchFilters.keyword || searchFilters.department) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 underline"
            >
              清除筛选
            </button>
          </div>
        )}
      </div>

      {/* 表格视图 */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">职位名称</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">所属部门</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">描述</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {getCurrentPageData().map((pos) => (
                <tr key={pos.id} className="hover:bg-primary-50/30 transition-colors">
                  <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{pos.name}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {departments.find(d => d.id === pos.department_id)?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">
                    {pos.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleStatusClick(pos)}
                      className={`px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                        pos.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                      title="点击修改状态"
                    >
                      {pos.status === 'active' ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(pos)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(pos.id)}
                        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 卡片视图 */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getCurrentPageData().map((pos) => (
            <div
              key={pos.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-5"
            >
              {/* 卡片头部 */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{pos.name}</h3>
                <button
                  onClick={() => handleStatusClick(pos)}
                  className={`px-2 py-1 text-xs rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${
                    pos.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                  title="点击修改状态"
                >
                  {pos.status === 'active' ? '启用' : '停用'}
                </button>
              </div>

              {/* 部门信息 */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{departments.find(d => d.id === pos.department_id)?.name || '未分配部门'}</span>
                </div>
              </div>

              {/* 描述 */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                {pos.description || '暂无描述'}
              </p>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(pos)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(pos.id)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页组件 */}
      {filteredPositions.length > 0 && (
        <div className="mt-6 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">每页显示</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
            <span className="text-sm text-gray-600">条</span>
            <span className="text-sm text-gray-600 ml-4">共 {filteredPositions.length} 条记录</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              首页
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum
                if (totalPages <= 7) {
                  pageNum = i + 1
                } else if (currentPage <= 4) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i
                } else {
                  pageNum = currentPage - 3 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 border rounded-lg ${
                      currentPage === pageNum
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              末页
            </button>

            <span className="text-sm text-gray-600 ml-2">
              第 {currentPage} / {totalPages} 页
            </span>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          resetForm()
        }}
        title={editingPos ? '编辑职位' : '新增职位'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              职位名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所属部门</label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">请选择部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">职位描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                resetForm()
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              {editingPos ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 状态修改模态框 */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false)
          setStatusChangingPos(null)
        }}
        title="修改职位状态"
      >
        {statusChangingPos && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-600">职位名称：</span>
                <span className="text-gray-900 font-medium">{statusChangingPos.name}</span>
              </div>
              <div className="text-sm mt-2">
                <span className="text-gray-600">当前状态：</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  statusChangingPos.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {statusChangingPos.status === 'active' ? '启用' : '停用'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">重要提示</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    修改职位状态后，该职位的所有员工状态将同步更新。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择新状态
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleStatusChange('active')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    statusChangingPos.status === 'active'
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <div className="text-2xl mb-1">✓</div>
                  <div className="text-sm font-medium text-gray-900">启用</div>
                  <div className="text-xs text-gray-500 mt-1">职位正常使用</div>
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    员工状态 → 启用
                  </div>
                </button>
                <button
                  onClick={() => handleStatusChange('inactive')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    statusChangingPos.status === 'inactive'
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">✕</div>
                  <div className="text-sm font-medium text-gray-900">停用</div>
                  <div className="text-xs text-gray-500 mt-1">暂停使用</div>
                  <div className="text-xs text-gray-600 mt-1 font-medium">
                    员工状态 → 停用
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setIsStatusModalOpen(false)
                  setStatusChangingPos(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default PositionManagement
