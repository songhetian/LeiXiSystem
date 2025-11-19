import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import Modal from './Modal'
import { getApiUrl } from '../utils/apiConfig'

function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [viewingDept, setViewingDept] = useState(null)
  const [statusChangingDept, setStatusChangingDept] = useState(null)
  const [deptDetails, setDeptDetails] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [viewMode, setViewMode] = useState('table') // 'table' or 'card'
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  })

  useEffect(() => {
    fetchDepartments()
  }, [showDeleted])

  // 分页计算
  const totalPages = Math.ceil(departments.length / pageSize)
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return departments.slice(startIndex, endIndex)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = showDeleted
        ? getApiUrl('/api/departments?includeDeleted=true')
        : getApiUrl('/api/departments')
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()

      // 获取每个部门的员工数量
      const deptsWithCount = await Promise.all(
        data.map(async (dept) => {
          try {
            const empResponse = await fetch(getApiUrl('/api/employees'), {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            const employees = await empResponse.json()
            const count = employees.filter(emp => emp.department_id === dept.id).length
            return { ...dept, employee_count: count }
          } catch {
            return { ...dept, employee_count: 0 }
          }
        })
      )

      setDepartments(deptsWithCount)
    } catch (error) {
      toast.error('获取部门列表失败')
    }
  }

  const fetchDepartmentDetails = async (deptId) => {
    try {
      const token = localStorage.getItem('token')
      // 获取该部门的所有员工
      const empResponse = await fetch(getApiUrl('/api/employees'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const allEmployees = await empResponse.json()
      const deptEmployees = allEmployees.filter(emp => emp.department_id === deptId)

      // 按职位统计人数
      const positionStats = {}
      deptEmployees.forEach(emp => {
        const position = emp.position || '未分配职位'
        positionStats[position] = (positionStats[position] || 0) + 1
      })

      // 转换为数组格式
      const positionList = Object.entries(positionStats).map(([position, count]) => ({
        position,
        count
      }))

      setDeptDetails({
        totalCount: deptEmployees.length,
        positions: positionList,
        employees: deptEmployees
      })
    } catch (error) {
      toast.error('获取部门详情失败')
    }
  }

  const handleViewDetail = async (dept) => {
    setViewingDept(dept)
    setIsDetailModalOpen(true)
    await fetchDepartmentDetails(dept.id)
  }

  const handleStatusClick = (dept) => {
    setStatusChangingDept(dept)
    setIsStatusModalOpen(true)
  }

  const handleStatusChange = async (newStatus) => {
    if (!statusChangingDept) return

    // 如果状态没有变化，直接关闭
    if (statusChangingDept.status === newStatus) {
      setIsStatusModalOpen(false)
      setStatusChangingDept(null)
      return
    }

    // 如果部门有员工，给出警告提示
    const employeeCount = statusChangingDept.employee_count || 0
    if (employeeCount > 0) {
      const action = newStatus === 'active' ? '启用' : '停用'
      const employeeAction = newStatus === 'active' ? '启用' : '停用'
      const confirmMsg = `该部门有 ${employeeCount} 名员工，${action}部门后，所有员工状态将同步${employeeAction}。\n\n确定要继续吗？`

      if (!confirm(confirmMsg)) {
        return
      }
    }

    try {
      const response = await fetch(getApiUrl(`/api/departments/${statusChangingDept.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...statusChangingDept,
          status: newStatus
        })
      })

      if (response.ok) {
        const result = await response.json()
        const affectedCount = result.affectedEmployees || 0

        if (affectedCount > 0) {
          toast.success(`部门状态已修改，同时更新了 ${affectedCount} 名员工的状态`)
        } else {
          toast.success('部门状态修改成功')
        }

        setIsStatusModalOpen(false)
        setStatusChangingDept(null)
        fetchDepartments()
      } else {
        toast.error('状态修改失败')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingDept
        ? getApiUrl(`/api/departments/${editingDept.id}`)
        : getApiUrl('/api/departments')

      const response = await fetch(url, {
        method: editingDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success(editingDept ? '部门更新成功' : '部门创建成功')
        setIsModalOpen(false)
        fetchDepartments()
        resetForm()
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleEdit = (dept) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      description: dept.description || '',
      status: dept.status
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (dept) => {
    const employeeCount = dept.employee_count || 0
    let confirmMsg = '确定要删除这个部门吗？\n\n'

    if (employeeCount > 0) {
      confirmMsg += `该部门有 ${employeeCount} 名员工，删除后员工也将被标记为删除状态。\n\n`
    }

    confirmMsg += '删除后可以随时恢复。'

    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(getApiUrl(`/api/departments/${dept.id}`), {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('部门已删除（可恢复）')
        fetchDepartments()
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleRestore = async (id) => {
    if (!confirm('确定要恢复这个部门吗？\n\n恢复后部门和员工状态将变为启用。')) return

    try {
      const response = await fetch(getApiUrl(`/api/departments/${id}/restore`), {
        method: 'POST'
      })
      if (response.ok) {
        toast.success('部门已恢复')
        fetchDepartments()
      }
    } catch (error) {
      toast.error('恢复失败')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', status: 'active' })
    setEditingDept(null)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">部门管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {departments.filter(d => d.status !== 'deleted').length} 个部门
            {departments.filter(d => d.status === 'deleted').length > 0 &&
              ` (${departments.filter(d => d.status === 'deleted').length} 个已删除)`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 视图切换按钮 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="表格视图"
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
              title="卡片视图"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            显示已删除
          </label>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm"
          >
            + 新增部门
          </button>
        </div>
      </div>

      {/* 表格视图 */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow-sm">
          <table className="w-full">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">部门名称</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">描述</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">人数</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {getCurrentPageData().map((dept) => (
              <tr key={dept.id} className="hover:bg-primary-50/30 transition-colors">
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleViewDetail(dept)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline"
                    title="点击查看部门详情"
                  >
                    {dept.name}
                  </button>
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">{dept.description || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {dept.employee_count || 0} 人
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {dept.status === 'deleted' ? (
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                      已删除
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStatusClick(dept)}
                      className={`px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                        dept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                      title="点击修改状态"
                    >
                      {dept.status === 'active' ? '启用' : '停用'}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">
                  {formatDate(dept.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {dept.status === 'deleted' ? (
                      <button
                        onClick={() => handleRestore(dept.id)}
                        className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        恢复
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(dept)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(dept)}
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      </>
                    )}
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
          {getCurrentPageData().map((dept) => (
            <div
              key={dept.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-5"
            >
              {/* 卡片头部 */}
              <div className="flex items-start justify-between mb-3">
                <button
                  onClick={() => handleViewDetail(dept)}
                  className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors text-left"
                >
                  {dept.name}
                </button>
                {dept.status === 'deleted' ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex-shrink-0">
                    已删除
                  </span>
                ) : (
                  <button
                    onClick={() => handleStatusClick(dept)}
                    className={`px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 ${
                      dept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {dept.status === 'active' ? '启用' : '停用'}
                  </button>
                )}
              </div>

              {/* 描述 */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                {dept.description || '暂无描述'}
              </p>

              {/* 统计信息 */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-gray-600">{dept.employee_count || 0} 人</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600">{formatDate(dept.created_at)}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                {dept.status === 'deleted' ? (
                  <button
                    onClick={() => handleRestore(dept.id)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    恢复
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(dept)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页组件 */}
      {departments.length > 0 && (
        <div className="mt-6 flex items-center justify-between px-4">
          {/* 左侧：每页显示数量 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">每页显示</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
            <span className="text-sm text-gray-600">条</span>
            <span className="text-sm text-gray-600 ml-4">
              共 {departments.length} 条记录
            </span>
          </div>

          {/* 右侧：分页按钮 */}
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

            {/* 页码按钮 */}
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

      {/* 编辑/新增部门模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          resetForm()
        }}
        title={editingDept ? '编辑部门' : '新增部门'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              部门名称 <span className="text-red-500">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">部门描述</label>
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
              {editingDept ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 部门详情模态框 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setViewingDept(null)
          setDeptDetails(null)
        }}
        title="部门详情"
      >
        {viewingDept && (
          <div className="space-y-4">
            {/* 部门基本信息 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">{viewingDept.name}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">部门描述：</span>
                  <span className="text-gray-900">{viewingDept.description || '无'}</span>
                </div>
                <div>
                  <span className="text-gray-600">状态：</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    viewingDept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {viewingDept.status === 'active' ? '启用' : '停用'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">总人数：</span>
                  <span className="text-gray-900 font-semibold">{deptDetails?.totalCount || 0} 人</span>
                </div>
                <div>
                  <span className="text-gray-600">创建时间：</span>
                  <span className="text-gray-900">{formatDate(viewingDept.created_at)}</span>
                </div>
              </div>
            </div>

            {/* 职位统计 */}
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-3">职位分布</h4>
              {deptDetails ? (
                deptDetails.positions.length > 0 ? (
                  <div className="space-y-2">
                    {deptDetails.positions.map((pos, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                          <span className="text-sm font-medium text-gray-900">{pos.position}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary-600">{pos.count} 人</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    该部门暂无员工
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  加载中...
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  setViewingDept(null)
                  setDeptDetails(null)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 状态修改模态框 */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false)
          setStatusChangingDept(null)
        }}
        title="修改部门状态"
      >
        {statusChangingDept && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-600">部门名称：</span>
                <span className="text-gray-900 font-medium">{statusChangingDept.name}</span>
              </div>
              <div className="text-sm mt-2">
                <span className="text-gray-600">当前状态：</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  statusChangingDept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {statusChangingDept.status === 'active' ? '启用' : '停用'}
                </span>
              </div>
            </div>

            {/* 员工数量提示 */}
            {statusChangingDept.employee_count > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">重要提示</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      该部门有 <span className="font-semibold">{statusChangingDept.employee_count}</span> 名员工，
                      修改部门状态后，所有员工的状态将同步更新。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择新状态
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleStatusChange('active')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    statusChangingDept.status === 'active'
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <div className="text-2xl mb-1">✓</div>
                  <div className="text-sm font-medium text-gray-900">启用</div>
                  <div className="text-xs text-gray-500 mt-1">部门正常运作</div>
                  {statusChangingDept.employee_count > 0 && (
                    <div className="text-xs text-green-600 mt-1 font-medium">
                      员工状态 → 启用
                    </div>
                  )}
                </button>
                <button
                  onClick={() => handleStatusChange('inactive')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    statusChangingDept.status === 'inactive'
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">✕</div>
                  <div className="text-sm font-medium text-gray-900">停用</div>
                  <div className="text-xs text-gray-500 mt-1">暂停使用</div>
                  {statusChangingDept.employee_count > 0 && (
                    <div className="text-xs text-gray-600 mt-1 font-medium">
                      员工状态 → 停用
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setIsStatusModalOpen(false)
                  setStatusChangingDept(null)
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

export default DepartmentManagement
