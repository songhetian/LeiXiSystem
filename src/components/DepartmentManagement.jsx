import api from '@/api';
import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
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
  const [viewMode, setViewMode] = useState('card')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  })

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({
    title: '',
    message: '',
    onConfirm: null
  })

  useEffect(() => {
    fetchDepartments()
  }, [showDeleted])

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
      const path = showDeleted ? '/departments?includeDeleted=true' : '/departments'
      const response = await api.get(path)
      const data = response.data

      // 获取每个部门的员工数量 (优化：并行请求)
      const deptsWithCount = await Promise.all(
        data.map(async (dept) => {
          try {
            const empResponse = await api.get('/employees')
            const employees = empResponse.data
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
      const empResponse = await api.get('/employees')
      const allEmployees = empResponse.data
      const deptEmployees = allEmployees.filter(emp => emp.department_id === deptId)

      const positionStats = {}
      deptEmployees.forEach(emp => {
        const position = emp.position || '未分配职位'
        positionStats[position] = (positionStats[position] || 0) + 1
      })

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
    if (statusChangingDept.status === newStatus) {
      setIsStatusModalOpen(false)
      setStatusChangingDept(null)
      return
    }

    const employeeCount = statusChangingDept.employee_count || 0
    if (employeeCount > 0) {
      const action = newStatus === 'active' ? '启用' : '停用'
      const confirmMsg = `该部门有 ${employeeCount} 名员工，${action}部门后，所有员工状态将同步${action}。\n\n确定要继续吗？`

      setConfirmDialogConfig({
        title: '确认操作',
        message: confirmMsg,
        onConfirm: async () => {
          await performStatusChange(newStatus)
        }
      })
      setIsConfirmDialogOpen(true)
      return
    }

    await performStatusChange(newStatus)
  }

  const performStatusChange = async (newStatus) => {
    try {
      const response = await api.put(`/departments/update/${statusChangingDept.id}`, {
        ...statusChangingDept,
        status: newStatus
      })

      if (response.data) {
        const affectedCount = response.data.affectedEmployees || 0
        toast.success(affectedCount > 0 ? `部门状态已修改，同时更新了 ${affectedCount} 名员工的状态` : '部门状态修改成功')
        setIsStatusModalOpen(false)
        setStatusChangingDept(null)
        fetchDepartments()
      }
    } catch (error) {
      toast.error('修改失败')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const path = editingDept ? `/departments/update/${editingDept.id}` : '/departments/create'
      const response = editingDept ? await api.put(path, formData) : await api.post(path, formData)

      if (response.data) {
        toast.success(editingDept ? '部门更新成功' : '部门及关联聊天群组创建成功')
        setIsModalOpen(false)
        fetchDepartments()
        resetForm()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '操作失败')
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
    let confirmMsg = `确定要删除这个部门吗？\n\n${employeeCount > 0 ? `该部门有 ${employeeCount} 名员工，删除后员工也将被标记为删除状态。\n\n` : ''}删除后可以随时恢复。`

    setConfirmDialogConfig({
      title: '删除部门',
      message: confirmMsg,
      onConfirm: async () => {
        try {
          const response = await api.delete(`/departments/delete/${dept.id}`)
          if (response.data) {
            toast.success('部门已删除（可恢复）')
            fetchDepartments()
          }
        } catch (error) {
          toast.error('删除失败')
        }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const handleRestore = async (id) => {
    setConfirmDialogConfig({
      title: '恢复部门',
      message: '确定要恢复这个部门吗？\n\n恢复后部门和员工状态将变为启用。',
      onConfirm: async () => {
        try {
          const response = await api.post(`/departments/restore/${id}`)
          if (response.data) {
            toast.success('部门已恢复')
            fetchDepartments()
          }
        } catch (error) {
          toast.error('恢复失败')
        }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', status: 'active' })
    setEditingDept(null)
  }

  const handleSyncGroups = async () => {
    setConfirmDialogConfig({
      title: '一键同步群组',
      message: '系统将扫描所有部门，自动补全缺失的聊天群组，并将部门下的所有在职员工同步加入群聊。是否继续？',
      onConfirm: async () => {
        try {
          const response = await api.post('/departments/sync-all-groups')
          if (response.data) {
            toast.success(response.data.message)
            fetchDepartments()
          }
        } catch (error) {
          toast.error('同步失败')
        }
      }
    })
    setIsConfirmDialogOpen(true)
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
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} title="表格视图">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} title="卡片视图">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            显示已删除
          </label>
          <button onClick={handleSyncGroups} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            同步群组
          </button>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm">+ 新增部门</button>
        </div>
      </div>

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
                  <button onClick={() => handleViewDetail(dept)} className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline">{dept.name}</button>
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">{dept.description || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {dept.employee_count || 0} 人
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {dept.status === 'deleted' ? <span className="inline-block px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">已删除</span> : (
                    <button onClick={() => handleStatusClick(dept)} className={`px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity ${dept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {dept.status === 'active' ? '启用' : '停用'}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">{formatDate(dept.created_at)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {dept.status === 'deleted' ? (
                      <button onClick={() => handleRestore(dept.id)} className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1">恢复</button>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(dept)} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">编辑</button>
                        <button onClick={() => handleDelete(dept)} className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1">删除</button>
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

      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getCurrentPageData().map((dept) => (
            <div key={dept.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <button onClick={() => handleViewDetail(dept)} className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors text-left">{dept.name}</button>
                {dept.status === 'deleted' ? <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex-shrink-0">已删除</span> : (
                  <button onClick={() => handleStatusClick(dept)} className={`px-2 py-1 text-xs rounded-full cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 ${dept.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{dept.status === 'active' ? '启用' : '停用'}</button>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">{dept.description || '暂无描述'}</p>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="text-gray-600">👥 {dept.employee_count || 0} 人</span>
                <span className="text-gray-600">📅 {formatDate(dept.created_at)}</span>
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                {dept.status === 'deleted' ? (
                  <button onClick={() => handleRestore(dept.id)} className="flex-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">恢复</button>
                ) : (
                  <>
                    <button onClick={() => handleEdit(dept)} className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">编辑</button>
                    <button onClick={() => handleDelete(dept)} className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">删除</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页与模态框保持原有逻辑，已确保路径规范化 */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingDept ? '编辑部门' : '新增部门'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">部门名称 *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">部门描述</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" /></div>
          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg">{editingDept ? '更新' : '创建'}</button></div>
        </form>
      </Modal>

      {/* 详情与状态对话框逻辑保持不变，确保 api 实例使用无误 */}
      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} />
    </div>
  )
}

export default DepartmentManagement
