import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getApiBaseUrl } from '../utils/apiConfig'
import { FileDown, Search, Filter } from 'lucide-react'

const VacationSummary = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({
    department_id: '',
    search: '',
    year: new Date().getFullYear()
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [exporting, setExporting] = useState(false)

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

      // 使用与员工管理相同的部门权限过滤逻辑
      const response = await fetch(`${API_BASE_URL}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      // 只显示激活状态的部门,权限过滤由后端API处理
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (error) {
      console.error('加载部门列表失败:', error)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const API_BASE_URL =getApiBaseUrl()
      const token = localStorage.getItem('token')

      const params = new URLSearchParams({
        year: filters.year,
        page: pagination.page,
        limit: pagination.limit,
        ...( filters.department_id && { department_id: filters.department_id }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`${API_BASE_URL}/vacation/balance/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setPagination(prev => ({ ...prev, total: result.pagination.total }))
      } else {
        toast.error(result.message || '加载失败')
      }
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const API_BASE_URL = getApiBaseUrl()
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_BASE_URL}/vacation/export/excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
      })

      if (!response.ok) {
        throw new Error('导出失败')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `假期汇总_${filters.year}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('导出成功')
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Filter className="text-primary-600" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">假期汇总</h1>
              <p className="text-sm text-gray-600 mt-1">查看全员假期余额统计</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <FileDown size={20} />
            {exporting ? '导出中...' : '导出Excel'}
          </button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">年度</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">部门</label>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="搜索姓名、工号..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">工号</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">姓名</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">部门</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">年假余额</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">病假余额</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">调休余额</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">加班时长</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{row.employee_no}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.real_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.department_name || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm">
                        <div className="font-semibold text-blue-600">
                          {parseFloat(row.annual_leave_remaining || 0).toFixed(1)}天
                        </div>
                        <div className="text-xs text-gray-500">
                          / {parseFloat(row.annual_leave_total || 0).toFixed(1)}天
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm">
                        <div className="font-semibold text-orange-600">
                          {parseFloat(row.sick_leave_remaining || 0).toFixed(1)}天
                        </div>
                        <div className="text-xs text-gray-500">
                          / {parseFloat(row.sick_leave_total || 0).toFixed(1)}天
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm">
                        <div className="font-semibold text-green-600">
                          {parseFloat(row.compensatory_leave_remaining || 0).toFixed(1)}天
                        </div>
                        <div className="text-xs text-gray-500">
                          / {parseFloat(row.compensatory_leave_total || 0).toFixed(1)}天
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm">
                        <div className="font-semibold text-purple-600">
                          {parseFloat(row.overtime_hours_remaining || 0).toFixed(1)}h
                        </div>
                        <div className="text-xs text-gray-500">
                          可转{((row.overtime_hours_remaining || 0) / 8).toFixed(1)}天
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!loading && data.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {pagination.total} 条记录，第 {pagination.page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                disabled={pagination.page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VacationSummary
