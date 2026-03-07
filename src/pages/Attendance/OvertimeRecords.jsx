import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDateOnly } from '../../utils/dateUtils'
import api from '../../api'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'


export default function OvertimeRecords({ onNavigate }) {
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
  const [employee, setEmployee] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
      fetchEmployeeInfo(userData.id)
    }
  }, [])

  useEffect(() => {
    if (employee) {
      fetchRecords()
      fetchStats()
    }
  }, [pagination.page, pagination.limit, statusFilter, employee])

  const fetchEmployeeInfo = async (userId) => {
    try {
      const response = await api.get(`/api/employees/by-user/${userId}`)
      if (response.data.success && response.data.data) {
        setEmployee(response.data.data)
      } else {
        toast.error('未找到员工信息')
      }
    } catch (error) {
      logger.error('获取员工信息失败:', error)
      toast.error('获取员工信息失败')
    }
  }

  const fetchRecords = async () => {
    if (!employee) return

    setLoading(true)
    try {
      const response = await api.get('/api/overtime/records', {
        params: {
          employee_id: employee.id,
          status: statusFilter,
          page: pagination.page,
          limit: pagination.limit
        }
      })

      if (response.data.success) {
        setRecords(response.data.data)
        setPagination(prev => ({ ...prev, ...response.data.pagination }))
      }
    } catch (error) {
      toast.error('获取加班记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!employee) return

    try {
      const response = await api.get('/api/overtime/stats', {
        params: { employee_id: employee.id }
      })
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      logger.error('获取加班统计失败:', error)
    }
  }



  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '待审批', color: 'bg-yellow-100 text-yellow-800' },
      approved: { text: '已通过', color: 'bg-green-100 text-green-800' },
      rejected: { text: '已拒绝', color: 'bg-red-100 text-red-800' }
    }
    const badge = badges[status] || badges.pending
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    )
  }



  const formatTime = (dateTimeStr) => {
    if (!dateTimeStr) return '--:--'
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="p-6">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">加班记录</h1>
          <p className="text-gray-600 mt-1">查看您的加班申请历史</p>
        </div>
        <button
          onClick={() => onNavigate?.('/attendance/overtime/apply')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          + 新建加班
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">总加班时长</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.total_hours}h</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">已调休时长</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.compensated_hours}h</div>
          </div>
        </div>
      )}

      {/* 状态筛选 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2">
          {[
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待审批' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已拒绝' }
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => {
                setStatusFilter(status.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === status.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* 记录列表 - 卡片布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">加载中...</div>
        ) : records.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">暂无加班记录</div>
        ) : (
          records.map((record) => (
            <div key={record.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-5 border border-gray-100">
              {/* 卡片头部 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-800">
                    {formatDateOnly(record.overtime_date)}
                  </span>
                  {record.is_compensated && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      已调休
                    </span>
                  )}
                </div>
                {getStatusBadge(record.status)}
              </div>

              {/* 卡片内容 */}
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span>
                    {formatTime(record.start_time)} - {formatTime(record.end_time)}
                    <span className="ml-1 font-medium text-blue-600">({record.hours} 小时)</span>
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="mt-0.5">📝</span>
                  <span className="flex-1 line-clamp-2">{record.reason}</span>
                </div>

                {record.approver_name && (
                  <div className="flex items-center gap-2">
                    <span>👤</span>
                    <span>{record.approver_name}</span>
                  </div>
                )}
              </div>


            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {pagination.total > 0 && (
        <div className="bg-white rounded-lg shadow mt-4 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-700">
                共 {pagination.total} 条记录
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">每页显示</label>
                <select
                  value={pagination.limit}
                  onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="10">10条</option>
                  <option value="20">20条</option>
                  <option value="50">50条</option>
                  <option value="100">100条</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                第 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)} 页
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
      )}
    </div>
  )
}
