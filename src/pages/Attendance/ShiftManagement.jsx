import React, { useState, useEffect } from 'react'
import api from '../../api'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'


export default function ShiftManagement() {
  const [shifts, setShifts] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [globalSettings, setGlobalSettings] = useState(null) // 全局考勤设置

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  })

  // 筛选状态
  const [filters, setFilters] = useState({
    department_id: '',
    is_active: '',
    keyword: ''
  })

  const [formData, setFormData] = useState({
    name: '',
    start_time: '',
    end_time: '',
    rest_duration: 60,
    work_hours: 8,
    late_threshold: 30,
    early_threshold: 30,
    use_global_threshold: false, // 使用布尔值明确标识是否使用全局设置
    is_active: true,
    department_id: '',
    description: '',
    color: '#3B82F6'
  })

  useEffect(() => {
    fetchDepartments()
    fetchShifts()
    fetchGlobalSettings()
  }, [pagination.page, pagination.limit, filters])

  // 获取全局考勤设置
  const fetchGlobalSettings = async () => {
    try {
      const response = await api.get('/api/attendance/settings')
      if (response.data.success) {
        setGlobalSettings(response.data.data)
      }
    } catch (error) {
      console.error('获取全局考勤设置失败:', error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments')
      // 部门 API 直接返回数组，不是 { success, data } 格式
      if (Array.isArray(response.data)) {
        setDepartments(response.data)
      } else if (response.data.success) {
        setDepartments(response.data.data)
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
    }
  }

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const params = {
        page: pagination.page,
        limit: pagination.limit
      }

      // 只添加非空的筛选条件
      if (filters.department_id) {
        params.department_id = filters.department_id
      }
      if (filters.is_active !== '') {
        params.is_active = filters.is_active
      }
      if (filters.keyword) {
        params.keyword = filters.keyword
      }

      const response = await api.get('/api/shifts', { params })
      if (response.data.success) {
        setShifts(response.data.data)
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }))
      }
    } catch (error) {
      toast.error('获取班次列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleAdd = () => {
    setEditingShift(null)
    setFormData({
      name: '',
      start_time: '',
      end_time: '',
      rest_duration: 60,
      work_hours: 8,
      late_threshold: 30,
      early_threshold: 30,
      use_global_threshold: false, // 默认使用自定义阈值
      is_active: true,
      department_id: '',
      description: '',
      color: '#3B82F6'
    })
    setShowModal(true)
  }

  const handleEdit = (shift) => {
    setEditingShift(shift)
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      rest_duration: shift.rest_duration || 60,
      work_hours: shift.work_hours,
      late_threshold: shift.late_threshold,
      early_threshold: shift.early_threshold,
      use_global_threshold: shift.use_global_threshold === 1 || shift.use_global_threshold === true, // 使用数据库中的真实字段
      is_active: shift.is_active === 1,
      department_id: shift.department_id || '',
      description: shift.description || '',
      color: shift.color || '#3B82F6'
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      // 准备提交的数据
      const submitData = {
        ...formData,
        // 如果使用全局设置，将阈值设置为null
        late_threshold: formData.use_global_threshold ? null : formData.late_threshold,
        early_threshold: formData.use_global_threshold ? null : formData.early_threshold
      };

      if (editingShift) {
        // 更新
        const response = await api.put(`/api/shifts/${editingShift.id}`, submitData)
        if (response.data.success) {
          toast.success('班次更新成功')
          setShowModal(false)
          fetchShifts()
        }
      } else {
        // 创建
        const response = await api.post('/api/shifts', submitData)
        if (response.data.success) {
          toast.success('班次创建成功')
          setShowModal(false)
          fetchShifts()
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '操作失败')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个班次吗？')) return

    try {
      const response = await api.delete(`/api/shifts/${id}`)
      if (response.data.success) {
        toast.success('班次删除成功')
        fetchShifts()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || '删除失败')
    }
  }

  const handleToggle = async (id) => {
    try {
      const response = await api.post(`/api/shifts/${id}/toggle`)
      if (response.data.success) {
        toast.success(response.data.message)
        fetchShifts()
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  return (
    <div className="p-6">
      {/* 头部 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">班次管理</h1>
          <p className="text-gray-600 mt-1">管理工作班次和时间设置</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          + 新建班次
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
            <select
              value={filters.department_id}
              onChange={(e) => handleFilterChange('department_id', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">全部部门</option>
              <option value="null">全公司通用</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filters.is_active}
              onChange={(e) => handleFilterChange('is_active', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">全部状态</option>
              <option value="1">启用中</option>
              <option value="0">已禁用</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              placeholder="班次名称"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ department_id: '', is_active: '', keyword: '' })
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              重置筛选
            </button>
          </div>
        </div>
      </div>

      {/* 班次列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : shifts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无班次</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="border-2 rounded-lg p-6 transition-all hover:shadow-md"
                  style={{
                    borderColor: shift.color || '#e5e7eb',
                    backgroundColor: shift.color ? `${shift.color}10` : '#f9fafb'
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{shift.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            shift.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {shift.is_active ? '启用中' : '已禁用'}
                        </span>
                        {shift.department_name && (
                          <span className="inline-block px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                            {shift.department_name}
                          </span>
                        )}
                        {!shift.department_id && (
                          <span className="inline-block px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            全公司
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <span>⏰</span>
                      <span>
                        {shift.start_time} - {shift.end_time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span>工作时长：{shift.work_hours} 小时</span>
                    </div>
                    {shift.rest_duration && (
                      <div className="flex items-center gap-2">
                        <span>☕</span>
                        <span>休息时长：{shift.rest_duration} 分钟</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>
                        {shift.use_global_threshold ? (
                          <span>
                            迟到：{globalSettings?.late_minutes || '--'}分钟 / 早退：{globalSettings?.early_leave_minutes || '--'}分钟
                            <span className="text-gray-400 ml-1">(全局)</span>
                          </span>
                        ) : (
                          <span>
                            迟到：{shift.late_threshold}分钟 / 早退：{shift.early_threshold}分钟
                          </span>
                        )}
                      </span>
                    </div>
                    {shift.description && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t">
                        <span>📝</span>
                        <span className="text-xs text-gray-500">{shift.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(shift)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition-colors text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleToggle(shift.id)}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded transition-colors text-sm"
                    >
                      {shift.is_active ? '禁用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="px-4 bg-red-500 hover:bg-red-600 text-white py-2 rounded transition-colors text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {pagination.total > 0 && (
              <div className="border-t p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    共 {pagination.total} 条记录
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-600 font-medium">每页</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                      className="bg-white border-2 border-blue-200 rounded-md px-3 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:border-blue-300 transition-colors"
                    >
                      <option value="6">6 条</option>
                      <option value="9">9 条</option>
                      <option value="12">12 条</option>
                      <option value="15">15 条</option>
                      <option value="18">18 条</option>
                      <option value="24">24 条</option>
                      <option value="30">30 条</option>
                    </select>
                    <span className="text-xs text-gray-500">({Math.ceil(pagination.limit / 3)} 行)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    第 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)} 页
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                    className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 编辑模态框 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingShift ? '编辑班次' : '新建班次'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    班次名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例如：早班"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属部门
                  </label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">全公司通用</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">不选择部门则为全公司通用班次</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      上班时间 <span className="text-red-500">*</span>
                    </label>
                    <TimePicker
                      value={formData.start_time}
                      onChange={(value) => setFormData({ ...formData, start_time: value })}
                      placeholder="请选择上班时间"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      下班时间 <span className="text-red-500">*</span>
                    </label>
                    <TimePicker
                      value={formData.end_time}
                      onChange={(value) => setFormData({ ...formData, end_time: value })}
                      placeholder="请选择下班时间"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休息时长（分钟）
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={formData.rest_duration}
                    onChange={(e) => {
                      const restDuration = parseInt(e.target.value) || 0
                      setFormData({ ...formData, rest_duration: restDuration })
                    }}
                    className="w-full border rounded px-3 py-2"
                    placeholder="例如：60"
                  />
                  <p className="text-xs text-gray-500 mt-1">中午休息或其他休息时间，默认60分钟</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工作时长（小时）
                  </label>
                  <div className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-700 font-semibold">
                    {(() => {
                      if (!formData.start_time || !formData.end_time) return '0.0'
                      const [startHour, startMinute] = formData.start_time.split(':').map(Number)
                      const [endHour, endMinute] = formData.end_time.split(':').map(Number)
                      let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
                      if (totalMinutes < 0) totalMinutes += 24 * 60
                      const restMinutes = formData.rest_duration || 0
                      const workHours = Math.max(0, (totalMinutes - restMinutes) / 60)
                      return workHours.toFixed(1)
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">自动计算：下班时间 - 上班时间 - 休息时长</p>
                </div>

                {!formData.use_global_threshold && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        迟到阈值（分钟）
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.late_threshold}
                        onChange={(e) => setFormData({ ...formData, late_threshold: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        早退阈值（分钟）
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.early_threshold}
                        onChange={(e) => setFormData({ ...formData, early_threshold: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                )}

                {/* 阈值设置选项 */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">⏰ 阈值设置</h4>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">
                        {formData.use_global_threshold ? '使用全局设置' : '使用自定义'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          use_global_threshold: !formData.use_global_threshold,
                          // 当切换到使用全局设置时，重置阈值为0（表示使用全局设置）
                          // 当切换到自定义时，设置默认值30分钟
                          late_threshold: !formData.use_global_threshold ? 0 : 30,
                          early_threshold: !formData.use_global_threshold ? 0 : 30
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          formData.use_global_threshold ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.use_global_threshold ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {formData.use_global_threshold ? (
                    <div className="text-sm text-gray-600 bg-blue-100 p-3 rounded">
                      <p>✅ 当前班次将使用全局考勤设置中的阈值</p>
                      <div className="mt-2 text-xs font-semibold text-blue-800">
                         迟到：{globalSettings?.late_minutes || '--'}分钟 / 早退：{globalSettings?.early_leave_minutes || '--'}分钟
                      </div>
                      <p className="mt-1">如需自定义，请切换开关</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 bg-green-100 p-3 rounded">
                      <p>✅ 当前班次使用自定义阈值设置</p>
                      <p className="mt-1">如需使用全局设置，请切换开关</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    班次描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows="3"
                    placeholder="可选，描述班次的特点或适用场景"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    班次颜色
                  </label>

                  {/* 当前颜色和随机按钮 */}
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-20 p-1 rounded border cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // 鲜艳的随机颜色
                        const vibrantColors = [
                          '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
                          '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
                          '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12',
                          '#E67E22', '#16A085', '#27AE60', '#2980B9', '#8E44AD',
                          '#FF85A2', '#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD',
                          '#F0E68C', '#B0E0E6', '#FFDAB9', '#E0BBE4', '#FFDFD3',
                          '#FFD700', '#FF1493'
                        ]
                        const randomColor = vibrantColors[Math.floor(Math.random() * vibrantColors.length)]
                        setFormData({ ...formData, color: randomColor })
                      }}
                      className="px-4 py-2 border-2 border-gray-300 hover:border-blue-400 rounded-lg shadow-sm hover:shadow-md transition-all text-white font-medium"
                      style={{ backgroundColor: formData.color }}
                    >
                      随机
                    </button>
                  </div>

                  {/* 鲜艳色系推荐 */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 mb-2">鲜艳色系推荐：</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '0.5rem' }}>
                      {[
                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
                        '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12', '#E67E22',
                        '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#FF85A2', '#FFB6C1', '#87CEEB', '#98FB98',
                        '#DDA0DD', '#F0E68C', '#B0E0E6', '#FFDAB9', '#E0BBE4', '#FFDFD3', '#FFD700', '#FF1493'
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`h-8 w-8 rounded border-2 transition-all hover:scale-110 ${
                            formData.color === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    启用此班次
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition-colors"
                >
                  {editingShift ? '更新' : '创建'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// 在文件末尾添加 TimePicker 组件
const TimePicker = ({ value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [hour, minute] = value ? value.split(':').map(Number) : [null, null];

  // 预设时间选项
  const presetTimes = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '21:00', '22:00',
    '23:00', '00:00'
  ];

  // 快捷选项（整点）
  const quickHours = Array.from({ length: 24 }, (_, i) => i);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    // 验证时间格式
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
      // 注意：这里不再直接调用 onChange，而是在失去焦点时才调用
    }
  };

  const handleInputBlur = () => {
    // 验证时间格式并在失去焦点时才调用 onChange
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(inputValue)) {
      onChange(inputValue);
    } else {
      // 如果格式不正确，恢复原来的值
      setInputValue(value || '');
    }
  };

  const handleSelectTime = (time) => {
    onChange(time);
    setInputValue(time);
    setIsOpen(false);
  };

  const handleHourSelect = (h) => {
    const m = minute !== null ? minute : 0;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(time);
    setInputValue(time);
    setIsOpen(false);
  };

  const handleMinuteSelect = (m) => {
    const h = hour !== null ? hour : 0;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(time);
    setInputValue(time);
    setIsOpen(false);
  };

  const handleNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const time = `${h}:${m}`;
    onChange(time);
    setInputValue(time);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder || "请选择时间"}
        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* 快捷操作 */}
          <div className="p-3 border-b border-gray-200">
            <button
              type="button"
              onClick={handleNow}
              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded mr-2"
            >
              此刻
            </button>
            <span className="text-xs text-gray-500">快速选择:</span>
          </div>

          {/* 快捷小时选择 */}
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs text-gray-500 mb-2">整点:</div>
            <div className="grid grid-cols-8 gap-1">
              {quickHours.map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => handleHourSelect(h)}
                  className={`text-xs px-2 py-1 rounded ${
                    hour === h
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* 分钟选择 */}
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs text-gray-500 mb-2">分钟:</div>
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => handleMinuteSelect(m)}
                  className={`text-xs px-1 py-1 rounded ${
                    minute === m
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* 预设时间 */}
          <div className="p-3 max-h-40 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">预设时间:</div>
            <div className="grid grid-cols-4 gap-1">
              {presetTimes.map((time) => (
                <button
                  type="button"
                  key={time}
                  onClick={() => handleSelectTime(time)}
                  className={`text-xs px-2 py-1 rounded ${
                    value === time
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
