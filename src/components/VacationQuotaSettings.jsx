import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { Search, Save, RotateCcw, Settings, X } from 'lucide-react'

const VacationQuotaSettings = () => {
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({
    department_id: '',
    search: '',
    year: new Date().getFullYear()
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    annual_leave_total: 0,
    sick_leave_total: 0,
    compensatory_leave_total: 0
  })
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({
    adjustmentType: 'set', // set, increase, decrease
    values: {
      annual_leave_total: '',
      sick_leave_total: '',
      compensatory_leave_total: ''
    },
    reason: ''
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    loadData()
  }, [filters, pagination.page])

  const loadDepartments = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (error) {
      console.error('加载部门失败:', error)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')

      const params = new URLSearchParams({
        year: filters.year,
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.department_id && { department_id: filters.department_id }),
        ...(filters.search && { search: filters.search })
      })

      // 复用获取全员余额的接口
      const response = await fetch(`${API_BASE_URL}/vacation/balance/all?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json()
      if (result.success) {
        setEmployees(result.data)
        if (result.pagination) {
          setPagination(prev => ({ ...prev, total: result.pagination.total }))
        }
      }
    } catch (error) {
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (employee) => {
    setEditingId(employee.employee_id)
    setEditForm({
      annual_leave_total: employee.annual_leave_total,
      sick_leave_total: employee.sick_leave_total,
      compensatory_leave_total: employee.compensatory_leave_total
    })
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const handleSave = async (employee) => {
    try {
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const response = await fetch(`${API_BASE_URL}/vacation/balance/adjust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: employee.employee_id,
          year: filters.year,
          adjustments: editForm,
          operator_id: user.id,
          reason: '管理员手动调整额度'
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('额度更新成功')
        setEditingId(null)
        loadData()
      } else {
        toast.error(result.message || '更新失败')
      }
    } catch (error) {
      toast.error('更新失败')
    }
  }

  const handleBatchSave = async () => {
    if (!batchForm.reason.trim()) {
      toast.error('请填写调整原因')
      return
    }

    // 检查至少有一个调整值
    const hasValue = Object.values(batchForm.values).some(v => v !== '' && v !== null)
    if (!hasValue) {
      toast.error('请至少填写一项调整数值')
      return
    }

    try {
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const response = await fetch(`${API_BASE_URL}/vacation/balance/batch-adjust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: {
            department_id: filters.department_id,
            search: filters.search,
            year: filters.year
          },
          adjustment_type: batchForm.adjustmentType,
          adjustments: batchForm.values,
          operator_id: user.id,
          reason: batchForm.reason
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`批量调整成功，共更新 ${result.updatedCount} 条记录`)
        setShowBatchModal(false)
        setBatchForm({
          adjustmentType: 'set',
          values: { annual_leave_total: '', sick_leave_total: '', compensatory_leave_total: '' },
          reason: ''
        })
        loadData()
      } else {
        toast.error(result.message || '批量调整失败')
      }
    } catch (error) {
      console.error('批量调整失败:', error)
      toast.error('操作失败：' + error.message)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Settings className="text-primary-600" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">假期额度配置</h1>
            <p className="text-sm text-gray-600 mt-1">设置员工的年假、病假等假期总额度</p>
          </div>
        </div>

        <button
          onClick={() => setShowBatchModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Settings size={18} />
          批量调整
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {[0, 1, 2].map(offset => {
                const y = new Date().getFullYear() - 1 + offset
                return <option key={y} value={y}>{y}年</option>
              })}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="搜索姓名或工号..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            查询
          </button>
        </form>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">员工信息</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">部门</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">年假总额(天)</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">病假总额(天)</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">调休总额(天)</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">暂无数据</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                          {emp.real_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.real_name}</div>
                          <div className="text-xs text-gray-500">{emp.employee_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{emp.department_name}</td>

                    {/* 编辑模式 */}
                    {editingId === emp.employee_id ? (
                      <>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.annual_leave_total}
                            onChange={(e) => setEditForm({ ...editForm, annual_leave_total: parseFloat(e.target.value) })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.sick_leave_total}
                            onChange={(e) => setEditForm({ ...editForm, sick_leave_total: parseFloat(e.target.value) })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            value={editForm.compensatory_leave_total}
                            onChange={(e) => setEditForm({ ...editForm, compensatory_leave_total: parseFloat(e.target.value) })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSave(emp)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="保存"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              title="取消"
                            >
                              <RotateCcw size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      /* 查看模式 */
                      <>
                        <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                          {emp.annual_leave_total}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                          {emp.sick_leave_total}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                          {emp.compensatory_leave_total}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                          >
                            调整
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            共 {pagination.total} 条记录
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-gray-600">
              第 {pagination.page} 页
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={employees.length < pagination.limit}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>



      {/* 批量调整弹窗 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">批量调整假期额度</h2>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-bold mb-1">注意：</p>
                <p>此操作将应用于当前筛选条件下的所有员工（共 {pagination.total} 人）。</p>
                <p className="mt-1">当前筛选：{filters.year}年 {filters.department_id ? departments.find(d => d.id == filters.department_id)?.name : '所有部门'} {filters.search ? `包含"${filters.search}"` : ''}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">调整方式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjustmentType"
                      checked={batchForm.adjustmentType === 'set'}
                      onChange={() => setBatchForm({ ...batchForm, adjustmentType: 'set' })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>设置为固定值</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjustmentType"
                      checked={batchForm.adjustmentType === 'increase'}
                      onChange={() => setBatchForm({ ...batchForm, adjustmentType: 'increase' })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>增加额度</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjustmentType"
                      checked={batchForm.adjustmentType === 'decrease'}
                      onChange={() => setBatchForm({ ...batchForm, adjustmentType: 'decrease' })}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>减少额度</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年假</label>
                  <input
                    type="number"
                    step="0.5"
                    value={batchForm.values.annual_leave_total}
                    onChange={(e) => setBatchForm({
                      ...batchForm,
                      values: { ...batchForm.values, annual_leave_total: e.target.value }
                    })}
                    placeholder="不调整"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">病假</label>
                  <input
                    type="number"
                    step="0.5"
                    value={batchForm.values.sick_leave_total}
                    onChange={(e) => setBatchForm({
                      ...batchForm,
                      values: { ...batchForm.values, sick_leave_total: e.target.value }
                    })}
                    placeholder="不调整"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">调休</label>
                  <input
                    type="number"
                    step="0.5"
                    value={batchForm.values.compensatory_leave_total}
                    onChange={(e) => setBatchForm({
                      ...batchForm,
                      values: { ...batchForm.values, compensatory_leave_total: e.target.value }
                    })}
                    placeholder="不调整"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">调整原因 <span className="text-red-500">*</span></label>
                <textarea
                  value={batchForm.reason}
                  onChange={(e) => setBatchForm({ ...batchForm, reason: e.target.value })}
                  placeholder="请输入调整原因（必填）..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchSave}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VacationQuotaSettings
