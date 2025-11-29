import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import { getApiUrl } from '../utils/apiConfig'

function EmployeeChanges() {
  const [changes, setChanges] = useState([])
  const [filteredChanges, setFilteredChanges] = useState([])
  const [filter, setFilter] = useState('all')
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [searchFilteredPositions, setSearchFilteredPositions] = useState([])

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  // 搜索条件
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    position: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    fetchChanges()
    fetchDepartments()
    fetchPositions()
  }, [filter])

  const fetchChanges = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = filter === 'all'
        ? getApiUrl('/api/employee-changes')
        : getApiUrl(`/api/employee-changes?type=${filter}`)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('获取变动记录失败 - HTTP错误:', response.status, errorData)
        toast.error('获取变动记录失败')
        return
      }

      const data = await response.json()

      setChanges(data)
      setFilteredChanges(data)
    } catch (error) {
      console.error('获取变动记录失败 - 异常:', error)
      toast.error('获取变动记录失败')
    }
  }

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      // 移除 forManagement=true，使用正常的部门权限过滤
      const response = await fetch(getApiUrl('/api/departments'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setDepartments(data.filter(d => d.status === 'active'))
    } catch (error) {
      console.error('获取部门列表失败')
    }
  }

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/positions?limit=1000'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('获取职位列表失败 - HTTP错误:', response.status, errorData)
        setPositions([])
        return
      }

      const result = await response.json()

      const data = result.success ? result.data : []
      setPositions(data.filter(p => p.status === 'active'))
    } catch (error) {
      console.error('获取职位列表失败 - 异常:', error)
      setPositions([])
    }
  }

  // 根据部门筛选职位（搜索筛选用）
  useEffect(() => {
    if (searchFilters.department) {
      const filtered = positions.filter(p =>
        !p.department_id || p.department_id === parseInt(searchFilters.department)
      )
      setSearchFilteredPositions(filtered)
    } else {
      setSearchFilteredPositions(positions)
    }
  }, [searchFilters.department, positions])

  // 部门改变时清空职位选择
  const handleSearchDepartmentChange = (departmentId) => {
    setSearchFilters({
      ...searchFilters,
      department: departmentId,
      position: '' // 清空职位
    })
  }

  // 搜索过滤
  useEffect(() => {
    let filtered = [...changes]

    // 关键词搜索（姓名、工号）
    if (searchFilters.keyword) {
      const keyword = searchFilters.keyword.toLowerCase()
      filtered = filtered.filter(change =>
        change.real_name?.toLowerCase().includes(keyword) ||
        change.employee_no?.toLowerCase().includes(keyword)
      )
    }

    // 部门筛选
    if (searchFilters.department) {
      filtered = filtered.filter(change =>
        change.new_department_id === parseInt(searchFilters.department) ||
        change.old_department_id === parseInt(searchFilters.department)
      )
    }

    // 职位筛选
    if (searchFilters.position) {
      filtered = filtered.filter(change =>
        change.new_position === searchFilters.position ||
        change.old_position === searchFilters.position
      )
    }

    // 日期筛选（按变动日期）
    if (searchFilters.dateFrom) {
      filtered = filtered.filter(change => {
        if (!change.change_date) return false
        const changeDate = new Date(change.change_date).toISOString().split('T')[0]
        return changeDate >= searchFilters.dateFrom
      })
    }

    if (searchFilters.dateTo) {
      filtered = filtered.filter(change => {
        if (!change.change_date) return false
        const changeDate = new Date(change.change_date).toISOString().split('T')[0]
        return changeDate <= searchFilters.dateTo
      })
    }

    setFilteredChanges(filtered)
    setTotalPages(Math.ceil(filtered.length / pageSize))
    setCurrentPage(1)
  }, [searchFilters, changes, pageSize])

  // 获取当前页的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredChanges.slice(startIndex, endIndex)
  }

  // 分页控制
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
      department: '',
      position: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const getChangeTypeText = (type) => {
    const types = {
      hire: '入职',
      transfer: '调动',
      promotion: '晋升',
      resign: '辞职',
      terminate: '离职'
    }
    return types[type] || type
  }

  const getChangeTypeColor = (type) => {
    const colors = {
      hire: 'bg-green-100 text-green-800',
      transfer: 'bg-blue-100 text-blue-800',
      promotion: 'bg-purple-100 text-purple-800',
      resign: 'bg-orange-100 text-orange-800',
      terminate: 'bg-red-100 text-red-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">员工变动记录</h1>
        <p className="text-gray-500 text-sm mt-2">记录员工的入职、调动、晋升、离职等变动信息</p>
      </div>

      {/* 搜索筛选区 */}
      <div className="mb-6 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">筛选条件</h2>
        <div className="grid grid-cols-6 gap-4">
          <div>
            <input
              type="text"
              placeholder="姓名/工号"
              value={searchFilters.keyword}
              onChange={(e) => handleSearchChange('keyword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <select
              value={searchFilters.department}
              onChange={(e) => handleSearchDepartmentChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">全部部门</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={searchFilters.position}
              onChange={(e) => handleSearchChange('position', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              disabled={!searchFilters.department}
            >
              <option value="">全部职位</option>
              {searchFilteredPositions.map(pos => (
                <option key={pos.id} value={pos.name}>{pos.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="all">全部类型</option>
              <option value="hire">入职</option>
              <option value="transfer">调动</option>
              <option value="promotion">晋升</option>
              <option value="resign">辞职</option>
              <option value="terminate">离职</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={searchFilters.dateFrom}
              onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
              placeholder="开始日期"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm cursor-pointer"
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </div>
          <div>
            <input
              type="date"
              value={searchFilters.dateTo}
              onChange={(e) => handleSearchChange('dateTo', e.target.value)}
              placeholder="结束日期"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm cursor-pointer"
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </div>
        </div>
        {(searchFilters.keyword || searchFilters.department || searchFilters.position || searchFilters.dateFrom || searchFilters.dateTo) && (
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

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-8 mb-6 w-full">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-700 mb-1">本月入职</div>
              <div className="text-3xl font-bold text-green-800">
                {filteredChanges.filter(c => c.change_type === 'hire' &&
                  new Date(c.change_date).getMonth() === new Date().getMonth()).length}
              </div>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
              👤
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-md p-6 border-l-4 border-red-500 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-red-700 mb-1">本月离职</div>
              <div className="text-3xl font-bold text-red-800">
                {filteredChanges.filter(c => ['resign', 'terminate'].includes(c.change_type) &&
                  new Date(c.change_date).getMonth() === new Date().getMonth()).length}
              </div>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
              👋
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-blue-700 mb-1">本月调动</div>
              <div className="text-3xl font-bold text-blue-800">
                {filteredChanges.filter(c => c.change_type === 'transfer' &&
                  new Date(c.change_date).getMonth() === new Date().getMonth()).length}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg">
              🔄
            </div>
          </div>
        </div>
      </div>

      {/* 变动记录列表 */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
          <h2 className="text-lg font-semibold text-primary-800">变动记录列表</h2>
          <p className="text-sm text-primary-600 mt-1">共 {filteredChanges.length} 条记录</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">日期</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">员工信息</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">变动类型</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">变动内容</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">变动原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {getCurrentPageData().map((change, index) => (
                <tr key={change.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-all duration-200`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatDate(change.change_date)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-md">
                        {change.real_name?.charAt(0) || '员'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{change.real_name}</div>
                        <div className="text-xs text-gray-500">{change.employee_no}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${getChangeTypeColor(change.change_type)}`}>
                      {getChangeTypeText(change.change_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-700">
                      {change.change_type === 'hire' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">部门:</span>
                            <span className="font-medium text-green-700">{change.new_department_name || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">职位:</span>
                            <span className="font-medium text-green-700">{change.new_position || '-'}</span>
                          </div>
                        </div>
                      )}
                      {change.change_type === 'transfer' && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-600">{change.old_department_name || '-'}</span>
                          <span className="text-blue-500">→</span>
                          <span className="font-medium text-blue-700">{change.new_department_name || '-'}</span>
                        </div>
                      )}
                      {change.change_type === 'promotion' && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-600">{change.old_position || '-'}</span>
                          <span className="text-purple-500">→</span>
                          <span className="font-medium text-purple-700">{change.new_position || '-'}</span>
                        </div>
                      )}
                      {['resign', 'terminate'].includes(change.change_type) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">部门:</span>
                            <span className="font-medium text-red-700">{change.old_department_name || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">职位:</span>
                            <span className="font-medium text-red-700">{change.old_position || '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-xs">
                      {change.reason || <span className="text-gray-400 italic">无</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredChanges.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <div className="text-lg font-medium text-gray-600 mb-2">
                {changes.length === 0 ? '暂无变动记录' : '没有符合条件的记录'}
              </div>
              <div className="text-sm text-gray-400">
                {changes.length === 0 ? '当有员工入职、调动、晋升或离职时，记录会显示在这里' : '请尝试调整筛选条件'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 分页组件 */}
      {filteredChanges.length > 0 && (
        <div className="mt-4 flex items-center justify-between px-4">
          {/* 左侧：每页显示数量 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">每页显示</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">条</span>
            <span className="text-sm text-gray-600 ml-4">
              共 {filteredChanges.length} 条记录
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
    </div>
  )
}

export default EmployeeChanges
