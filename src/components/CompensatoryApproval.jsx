import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { CheckCircle, XCircle, Clock, Calendar, X, Search, Eye } from 'lucide-react'
import { formatDate } from '../utils/date'

const CompensatoryApproval = () => {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [processing, setProcessing] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState('pending')
  const [dateFilters, setDateFilters] = useState({
    申请时间_start: '',
    申请时间_end: '',
    调休日期_start: '',
    调休日期_end: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')


  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    loadRequests()
  }, [pagination.page, searchTerm, dateFilters, status, selectedDepartment])

  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/departments/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await response.json()
      if (result.success) {
        const activeDepts = result.data.filter(d => d.status === 'active')
        setDepartments(activeDepts)
        // 默认显示全部部门，不自动选中第一个
      }
    } catch (error) {
      console.error('加载部门列表失败:', error)
    }
  }

  const loadRequests = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const params = new URLSearchParams({
        ...(selectedDepartment && { department_id: selectedDepartment }),
        page: pagination.page,
        limit: pagination.limit,
        ...(searchTerm && { search: searchTerm }),
        ...(dateFilters.申请时间_start && { created_start: dateFilters.申请时间_start }),
        ...(dateFilters.申请时间_end && { created_end: dateFilters.申请时间_end }),
        ...(dateFilters.调休日期_start && { schedule_start: dateFilters.调休日期_start }),
        ...(dateFilters.调休日期_end && { schedule_end: dateFilters.调休日期_end }),
        status: status === 'all' ? '' : status
      })

      const response = await fetch(
        `${API_BASE_URL}/compensatory/list?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      const result = await response.json()
      if (result.success) {
        setRequests(result.data)
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            total: result.pagination.total
          }))
        }
      } else {
        // 如果是获取失败，但不是网络错误，可能是没有数据（取决于后端实现）
        // 这里我们不显示错误提示，而是清空列表
        setRequests([])
        setPagination(prev => ({ ...prev, total: 0 }))
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      // 不显示错误提示，避免在无数据时打扰用户
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const openDetailModal = (request) => {
    setSelectedRequest(request)
    setApprovalNote('')
    setShowDetailModal(true)
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedRequest(null)
    setApprovalNote('')
  }

  const handleApprove = async () => {
    try {
      setProcessing(selectedRequest.id)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const response = await fetch(`${API_BASE_URL}/compensatory/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approver_id: user.id,
          approval_note: approvalNote || '批准'
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('调休申请已批准')
        closeDetailModal()
        loadRequests()
      } else {
        toast.error(result.message || '操作失败')
      }
    } catch (error) {
      console.error('审批失败:', error)
      toast.error('操作失败：' + error.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!approvalNote.trim()) {
      toast.error('请填写拒绝理由')
      return
    }

    try {
      setProcessing(selectedRequest.id)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))

      const response = await fetch(`${API_BASE_URL}/compensatory/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approver_id: user.id,
          approval_note: approvalNote
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('调休申请已拒绝')
        closeDetailModal()
        loadRequests()
      } else {
        toast.error(result.message || '操作失败')
      }
    } catch (error) {
      console.error('拒绝失败:', error)
      toast.error('操作失败：' + error.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Clock className="text-primary-600" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">调休审批</h1>
              <p className="text-sm text-gray-600 mt-1">处理员工的调休申请</p>
            </div>
          </div>
        </div>
      </div>

      {/* 状态切换标签 */}
      <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-6 inline-flex">
        {[
          { id: 'pending', label: '待审批', icon: Clock },
          { id: 'approved', label: '已通过', icon: CheckCircle },
          { id: 'rejected', label: '已拒绝', icon: XCircle },
          { id: 'all', label: '全部', icon: Eye }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setStatus(tab.id)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${status === tab.id
              ? 'bg-primary-50 text-primary-600 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜索和过滤栏 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* 第一行: 搜索框 */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索姓名或工号..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              搜索
            </button>
            {(searchTerm || Object.values(dateFilters).some(v => v)) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setDateFilters({
                    申请时间_start: '',
                    申请时间_end: '',
                    调休日期_start: '',
                    调休日期_end: ''
                  })
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                清除全部
              </button>
            )}
          </div>

          {/* 第二行: 部门选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择部门</label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          {/* 第三行: 时间过滤器 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">申请时间</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFilters.申请时间_start}
                  onChange={(e) => setDateFilters({ ...dateFilters, 申请时间_start: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-500">至</span>
                <input
                  type="date"
                  value={dateFilters.申请时间_end}
                  onChange={(e) => setDateFilters({ ...dateFilters, 申请时间_end: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">调休日期</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFilters.调休日期_start}
                  onChange={(e) => setDateFilters({ ...dateFilters, 调休日期_start: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-gray-500">至</span>
                <input
                  type="date"
                  value={dateFilters.调休日期_end}
                  onChange={(e) => setDateFilters({ ...dateFilters, 调休日期_end: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 列表内容区域 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-primary-600 rounded-full mb-2"></div>
            <p>加载中...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Calendar size={32} className="text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900">
              {status === 'pending' ? '暂无待审批申请' :
                status === 'approved' ? '暂无已通过申请' :
                  status === 'rejected' ? '暂无已拒绝申请' : '暂无申请记录'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {status === 'pending' ? '当前没有需要处理的调休申请' : '当前筛选条件下没有找到记录'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  {/* 左侧：用户信息 */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg shadow-inner">
                      {request.employee_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{request.employee_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium text-gray-600">
                          {request.department_name}
                        </span>
                        <span>{request.employee_no}</span>
                      </div>
                    </div>
                  </div>

                  {/* 中间：调休详情 */}
                  <div className="flex-1 px-8 border-l border-r border-gray-100 mx-8">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">原排班</p>
                          <p className="font-medium text-gray-900">{formatDate(request.original_schedule_date)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <span className="text-xs text-gray-400 mb-1">调换</span>
                        <div className="w-24 h-px bg-gray-300 relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t border-r border-gray-300 transform rotate-45"></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">调休至</p>
                          <p className="font-medium text-gray-900">{formatDate(request.new_schedule_date)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 mt-3 bg-gray-50 p-2 rounded-lg">
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap mt-0.5">申请理由:</span>
                      <p className="text-sm text-gray-700 line-clamp-1" title={request.reason}>
                        {request.reason || '未填写理由'}
                      </p>
                    </div>
                  </div>

                  {/* 右侧：操作 */}
                  <div className="flex flex-col items-end gap-3 min-w-[140px]">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">申请时间</p>
                      <p className="text-sm font-medium text-gray-600">{formatDateTime(request.created_at)}</p>
                    </div>
                    <button
                      onClick={() => openDetailModal(request)}
                      className="flex items-center gap-2 px-5 py-2 bg-white border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors font-medium shadow-sm"
                    >
                      <Eye size={18} />
                      审核详情
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {requests.length > 0 && (
          <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              显示第 <span className="font-medium">{((Number(pagination.page || 1) - 1) * Number(pagination.limit || 10)) + 1}</span> 到 <span className="font-medium">{Math.min(Number(pagination.page || 1) * Number(pagination.limit || 10), Number(pagination.total || 0))}</span> 条，
              共 <span className="font-medium">{Number(pagination.total || 0)}</span> 条记录
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* 弹窗标题 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">调休申请详情</h2>
              <button
                onClick={closeDetailModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-6">
              {/* 申请人信息 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">申请人信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">姓名</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRequest.employee_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">工号</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRequest.employee_no}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">部门</label>
                    <p className="text-sm font-medium text-gray-900">{selectedRequest.department_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">申请时间</label>
                    <p className="text-sm font-medium text-gray-900">{formatDateTime(selectedRequest.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* 调休信息 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">调休信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">原排班日期</label>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedRequest.original_schedule_date)}</p>
                    {selectedRequest.original_shift_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedRequest.original_shift_name} ({selectedRequest.original_start_time} - {selectedRequest.original_end_time})
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">调休至</label>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedRequest.new_schedule_date)}</p>
                    {selectedRequest.new_shift_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedRequest.new_shift_name} ({selectedRequest.new_start_time} - {selectedRequest.new_end_time})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 申请理由 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">申请理由</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedRequest.reason || '无'}</p>
              </div>

              {/* 审批备注 */}
              {/* 审批备注 */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">审批备注</label>
                {selectedRequest.status === 'pending' ? (
                  <textarea
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="请输入审批备注(拒绝时必填)..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedRequest.approval_note || '无'}
                  </p>
                )}
              </div>
            </div>

            {/* 弹窗操作按钮 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeDetailModal}
                disabled={processing}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                {selectedRequest.status === 'pending' ? '取消' : '关闭'}
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    {processing === selectedRequest.id ? '处理中...' : '拒绝'}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={18} />
                    {processing === selectedRequest.id ? '处理中...' : '通过'}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default CompensatoryApproval
