import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function ApprovalManagement() {
  const [activeTab, setActiveTab] = useState('leave')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')
  const [viewMode, setViewMode] = useState('card') // card, list
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { record, approved }

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [filters, setFilters] = useState({
    status: 'pending',
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    fetchRecords()
  }, [activeTab, pagination.page, filters])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      let endpoint = ''
      switch (activeTab) {
        case 'leave':
          endpoint = '/api/attendance/leave/records'
          break
        case 'overtime':
          endpoint = '/api/attendance/overtime/records'
          break
        case 'makeup':
          endpoint = '/api/attendance/makeup/records'
          break
      }

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      }

      const response = await axios.get(getApiUrl(endpoint), { params })
      if (response.data.success) {
        setRecords(response.data.data)
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0
        }))
      }
    } catch (error) {
      toast.error('获取记录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (record) => {
    setSelectedRecord(record)
    setApprovalNote('')
    setShow(true)
  }

  const handleSubmitApproval = async (approved) => {
    if (!selectedRecord) return

    try {
      let endpoint = ''
      switch (activeTab) {
        case 'leave':
          endpoint = `/api/attendance/leave/${selectedRecord.id}/approve`
          break
        case 'overtime':
          endpoint = `/api/attendance/overtime/${selectedRecord.id}/approve`
          break
        case 'makeup':
          endpoint = `/api/attendance/makeup/${selectedRecord.id}/approve`
          break
      }

      const response = await axios.post(getApiUrl(endpoint), {
        approved,
        approval_note: approvalNote
      })

      if (response.data.success) {
        toast.success(approved ? '✅ 审批通过' : '❌ 审批驳回')
        setShowModal(false)
        fetchRecords()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '审批失败')
    }
  }

  // 快速审批 - 打开确认模态框
  const handleQuickApproval = (record, approved) => {
    setConfirmAction({ record, approved })
    setShowConfirmModal(true)
  }

  // 执行快速审批
  const executeQuickApproval = async () => {
    if (!confirmAction) return

    const { record, approved } = confirmAction

    try {
      let endpoint = ''
      switch (activeTab) {
        case 'leave':
          endpoint = `/api/attendance/leave/${record.id}/approve`
          break
        case 'overtime':
          endpoint = `/api/attendance/overtime/${record.id}/approve`
          break
        case 'makeup':
          endpoint = `/api/attendance/makeup/${record.id}/approve`
          break
      }

      const response = await axios.post(getApiUrl(endpoint), {
        approved,
        approval_note: ''
      })

      if (response.data.success) {
        toast.success(approved ? '✅ 审批通过' : '❌ 审批驳回')
        setShowConfirmModal(false)
        setConfirmAction(null)
        fetchRecords()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '审批失败')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '待审批', color: 'bg-yellow-100 text-yellow-800' },
      approved: { text: '已通过', color: 'bg-green-100 text-green-800' },
      rejected: { text: '已驳回', color: 'bg-red-100 text-red-800' },
      cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-600' }
    }
    const badge = badges[status] || badges.pending
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const getLeaveTypeName = (type) => {
    const types = {
      sick: '病假',
      annual: '年假',
      personal: '事假',
      maternity: '产假',
      compensatory: '调休',
      other: '其他'
    }
    return types[type] || type
  }

  // 卡片视图 - 请假记录
  const renderLeaveCardView = (record) => (
    <div key={record.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-800 text-lg">
              {record.employee_name || `员工 #${record.employee_id}`}
            </span>
            {getStatusBadge(record.status)}
            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
              {getLeaveTypeName(record.leave_type)}
            </span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            📅 {record.start_date?.substring(0, 10) || record.start_date} 至 {record.end_date?.substring(0, 10) || record.end_date}
            <span className="ml-2 font-medium text-blue-600">({record.days}天)</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
            💬 {record.reason}
          </div>
        </div>
        {record.status === 'pending' && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleQuickApproval(record, true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              title="快速通过"
            >
              ✓ 通过
            </button>
            <button
              onClick={() => handleQuickApproval(record, false)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              title="快速驳回"
            >
              ✗ 驳回
            </button>
            <button
              onClick={() => handleApprove(record)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="详细审批"
            >
              📝
            </button>
          </div>
        )}
      </div>
      {record.approval_note && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
          <span className="font-medium">审批意见：</span>
          {record.approval_note}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        🕐 申请时间：{record.created_at?.substring(0, 19).replace('T', ' ')}
      </div>
    </div>
  )

  // 列表视图 - 请假记录
  const renderLeaveListView = (record) => (
    <tr key={record.id} className="hover:bg-gray-50">
      <td className="px-4 py-3 border-b">
        <div className="font-medium text-gray-800">{record.employee_name || `员工 #${record.employee_id}`}</div>
        <div className="text-xs text-gray-500">{getLeaveTypeName(record.leave_type)}</div>
      </td>
      <td className="px-4 py-3 border-b text-sm">
        <div>{record.start_date?.substring(0, 10)}</div>
        <div className="text-xs text-gray-500">至 {record.end_date?.substring(0, 10)}</div>
      </td>
      <td className="px-4 py-3 border-b text-center">
        <span className="font-medium text-blue-600">{record.days}天</span>
      </td>
      <td className="px-4 py-3 border-b text-sm max-w-xs truncate" title={record.reason}>
        {record.reason}
      </td>
      <td className="px-4 py-3 border-b text-center">
        {getStatusBadge(record.status)}
      </td>
      <td className="px-4 py-3 border-b">
        {record.status === 'pending' ? (
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => handleQuickApproval(record, true)}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs"
              title="通过"
            >
              ✓
            </button>
            <button
              onClick={() => handleQuickApproval(record, false)}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
              title="驳回"
            >
              ✗
            </button>
            <button
              onClick={() => handleApprove(record)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
              title="详细"
            >
              📝
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
    </tr>
  )

  // 卡片视图 - 加班记录
  const renderOvertimeCardView = (record) => (
    <div key={record.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-800 text-lg">
              {record.employee_name || `员工 #${record.employee_id}`}
            </span>
            {getStatusBadge(record.status)}
          </div>
          <div className="text-sm text-gray-600 mb-2">
            📅 {record.overtime_date}
            <span className="ml-2">⏰ {record.start_time?.substring(11, 16)} - {record.end_time?.substring(11, 16)}</span>
            <span className="ml-2 font-medium text-orange-600">({record.hours}小时)</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
            💬 {record.reason}
          </div>
        </div>
        {record.status === 'pending' && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleQuickApproval(record, true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ✓ 通过
            </button>
            <button
              onClick={() => handleQuickApproval(record, false)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ✗ 驳回
            </button>
            <button
              onClick={() => handleApprove(record)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm"
            >
              📝
            </button>
          </div>
        )}
      </div>
      {record.approval_note && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
          <span className="font-medium">审批意见：</span>
          {record.approval_note}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        🕐 申请时间：{record.created_at?.substring(0, 19).replace('T', ' ')}
      </div>
    </div>
  )

  // 卡片视图 - 补卡记录
  const renderMakeupCardView = (record) => (
    <div key={record.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-800 text-lg">
              {record.employee_name || `员工 #${record.employee_id}`}
            </span>
            {getStatusBadge(record.status)}
            <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
              {record.clock_type === 'in' ? '上班卡' : '下班卡'}
            </span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            📅 {record.record_date}
            <span className="ml-2">⏰ {record.clock_time?.substring(11, 19)}</span>
          </div>
          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
            💬 {record.reason}
          </div>
        </div>
        {record.status === 'pending' && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleQuickApproval(record, true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ✓ 通过
            </button>
            <button
              onClick={() => handleQuickApproval(record, false)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ✗ 驳回
            </button>
            <button
              onClick={() => handleApprove(record)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm"
            >
              📝
            </button>
          </div>
        )}
      </div>
      {record.approval_note && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
          <span className="font-medium">审批意见：</span>
          {record.approval_note}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        🕐 申请时间：{record.created_at?.substring(0, 19).replace('T', ' ')}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">考勤审批</h1>
          <p className="text-gray-600 mt-1">快速审批员工的请假、加班和补卡申请</p>
        </div>
        {/* 视图切换 */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('card')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'card'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            title="卡片视图"
          >
            🎴 卡片
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            title="列表视图"
          >
            📋 列表
          </button>
        </div>
      </div>

      {/* 标签页和筛选 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'leave'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📝 请假申请
            </button>
            <button
              onClick={() => setActiveTab('overtime')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'overtime'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⏰ 加班申请
            </button>
            <button
              onClick={() => setActiveTab('makeup')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'makeup'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🔄 补卡申请
            </button>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">全部</option>
                <option value="pending">待审批</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ status: 'pending', start_date: '', end_date: '' })}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 记录列表 */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <div className="mt-2">加载中...</div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <div>暂无记录</div>
            </div>
          ) : viewMode === 'card' ? (
            <div className="space-y-4">
              {activeTab === 'leave' && records.map(renderLeaveCardView)}
              {activeTab === 'overtime' && records.map(renderOvertimeCardView)}
              {activeTab === 'makeup' && records.map(renderMakeupCardView)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">员工</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      {activeTab === 'leave' ? '请假时间' : activeTab === 'overtime' ? '加班日期' : '补卡日期'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                      {activeTab === 'leave' ? '天数' : activeTab === 'overtime' ? '时长' : '类型'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">原因</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">状态</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'leave' && records.map(renderLeaveListView)}
                  {/* 加班和补卡的列表视图类似，这里省略 */}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {pagination.total > pagination.limit && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                共 {pagination.total} 条记录，第 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)} 页
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 审批模态框（详细审批时使用） */}
      {showModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">详细审批</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded">
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-medium">申请人：</span>
                  {selectedRecord.employee_name || `员工 #${selectedRecord.employee_id}`}
                </div>
                {activeTab === 'leave' && (
                  <>
                    <div>
                      <span className="font-medium">请假类型：</span>
                      {getLeaveTypeName(selectedRecord.leave_type)}
                    </div>
                    <div>
                      <span className="font-medium">请假时间：</span>
                      {selectedRecord.start_date?.substring(0, 10)} 至 {selectedRecord.end_date?.substring(0, 10)} ({selectedRecord.days}天)
                    </div>
                    <div>
                      <span className="font-medium">请假原因：</span>
                      {selectedRecord.reason}
                    </div>
                  </>
                )}
                {activeTab === 'overtime' && (
                  <>
                    <div>
                      <span className="font-medium">加班日期：</span>
                      {selectedRecord.overtime_date}
                    </div>
                    <div>
                      <span className="font-medium">加班时长：</span>
                      {selectedRecord.hours}小时
                    </div>
                    <div>
                      <span className="font-medium">加班原因：</span>
                      {selectedRecord.reason}
                    </div>
                  </>
                )}
                {activeTab === 'makeup' && (
                  <>
                    <div>
                      <span className="font-medium">补卡日期：</span>
                      {selectedRecord.record_date}
                    </div>
                    <div>
                      <span className="font-medium">补卡类型：</span>
                      {selectedRecord.clock_type === 'in' ? '上班卡' : '下班卡'}
                    </div>
                    <div>
                      <span className="font-medium">补卡原因：</span>
                      {selectedRecord.reason}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                审批意见（可选）
              </label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows="3"
                placeholder="填写审批意见..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSubmitApproval(true)}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded font-medium"
              >
                ✓ 通过
              </button>
              <button
                onClick={() => handleSubmitApproval(false)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded font-medium"
              >
                ✗ 驳回
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 快速审批确认模态框 */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              {/* 图标 */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4"
                   style={{ backgroundColor: confirmAction.approved ? '#dcfce7' : '#fee2e2' }}>
                <span className="text-4xl">
                  {confirmAction.approved ? '✓' : '✗'}
                </span>
              </div>

              {/* 标题 */}
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {confirmAction.approved ? '确认通过申请' : '确认驳回申请'}
              </h3>

              {/* 申请信息 */}
              <div className="text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded">
                <div className="mb-2">
                  <span className="font-medium">申请人：</span>
                  {confirmAction.record.employee_name || `员工 #${confirmAction.record.employee_id}`}
                </div>
                {activeTab === 'leave' && (
                  <>
                    <div className="mb-2">
                      <span className="font-medium">请假类型：</span>
                      {getLeaveTypeName(confirmAction.record.leave_type)}
                    </div>
                    <div>
                      <span className="font-medium">请假时间：</span>
                      {confirmAction.record.start_date?.substring(0, 10)} 至 {confirmAction.record.end_date?.substring(0, 10)} ({confirmAction.record.days}天)
                    </div>
                  </>
                )}
                {activeTab === 'overtime' && (
                  <>
                    <div className="mb-2">
                      <span className="font-medium">加班日期：</span>
                      {confirmAction.record.overtime_date}
                    </div>
                    <div>
                      <span className="font-medium">加班时长：</span>
                      {confirmAction.record.hours}小时
                    </div>
                  </>
                )}
                {activeTab === 'makeup' && (
                  <>
                    <div className="mb-2">
                      <span className="font-medium">补卡日期：</span>
                      {confirmAction.record.record_date}
                    </div>
                    <div>
                      <span className="font-medium">补卡类型：</span>
                      {confirmAction.record.clock_type === 'in' ? '上班卡' : '下班卡'}
                    </div>
                  </>
                )}
              </div>

              {/* 提示信息 */}
              <p className="text-sm text-gray-500 mb-6">
                {confirmAction.approved
                  ? '此操作将通过该申请，是否继续？'
                  : '此操作将驳回该申请，是否继续？'}
              </p>

              {/* 按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false)
                    setConfirmAction(null)
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeQuickApproval}
                  className={`flex-1 text-white py-2 px-4 rounded font-medium transition-colors ${
                    confirmAction.approved
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {confirmAction.approved ? '确认通过' : '确认驳回'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
