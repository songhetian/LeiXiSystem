import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/apiConfig'
import { toast } from 'sonner';
import Modal from './Modal'

function UserDepartmentModal({ isOpen, onClose, user, onSuccess }) {
  const [departments, setDepartments] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      fetchDepartments()
      fetchUserDepartments()
    }
  }, [isOpen, user])

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // 使用新的 /api/departments/all 端点获取所有部门
      const response = await fetch(getApiUrl('/api/departments/all'), { headers })
      const result = await response.json()

      if (result.success) {
        setDepartments(result.data)
      } else {
        toast.error(result.message || '获取部门列表失败')
      }
    } catch (error) {
      logger.error('获取部门列表失败:', error)
      toast.error('获取部门列表失败')
    }
  }

  const fetchUserDepartments = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${user.id}/departments`), {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      })
      const result = await response.json()

      if (result.success) {
        setSelectedDepartments(result.data.map(d => d.id))
      }
    } catch (error) {
      logger.error('获取员工部门权限失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleDepartment = (deptId) => {
    if (selectedDepartments.includes(deptId)) {
      setSelectedDepartments(selectedDepartments.filter(id => id !== deptId))
    } else {
      setSelectedDepartments([...selectedDepartments, deptId])
    }
  }

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([])
    } else {
      setSelectedDepartments(departments.map(d => d.id))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${user.id}/departments`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ department_ids: selectedDepartments })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`部门权限设置成功，共 ${result.count} 个部门`)

        // 刷新用户权限信息
        await refreshUserPermissions();

        onSuccess?.()
        onClose()
      } else {
        toast.error(result.error || '设置失败')
      }
    } catch (error) {
      logger.error('设置部门权限失败:', error)
      toast.error('设置失败')
    } finally {
      setSaving(false)
    }
  }

  // 刷新用户权限信息
  const refreshUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // 获取用户详细权限信息
      const permissionResponse = await fetch(getApiUrl(`/api/users/${user.id}/permissions-detail`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const permissionData = await permissionResponse.json()
      if (permissionData.success) {
        // 更新本地存储的权限信息
        localStorage.setItem('permissions', JSON.stringify(permissionData.data.permissions || []))
        localStorage.setItem('permissionDetails', JSON.stringify(permissionData.data))
      }
    } catch (error) {
      logger.error('刷新用户权限失败:', error)
    }
  }

  if (!user) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`设置员工部门权限 - ${user.real_name}`}
      size="large"
    >
      <div className="space-y-4">
        {/* 说明 */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 text-lg">ℹ️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">部门权限说明</p>
              <p className="text-xs text-blue-700 mt-1">
                • 员工部门权限优先于角色部门权限
              </p>
              <p className="text-xs text-blue-700">
                • 如果不选择任何部门，将使用角色部门权限
              </p>
              <p className="text-xs text-blue-700">
                • 选择部门后，该员工可以查看所选部门的数据
              </p>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            已选择 <span className="font-semibold text-gray-900">{selectedDepartments.length}</span> / {departments.length} 个部门
          </div>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            {selectedDepartments.length === departments.length ? '取消全选' : '全选'}
          </button>
        </div>

        {/* 部门列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p>暂无可用部门</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
            {departments.map(dept => (
              <div
                key={dept.id}
                onClick={() => handleToggleDepartment(dept.id)}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedDepartments.includes(dept.id)
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
                  selectedDepartments.includes(dept.id)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedDepartments.includes(dept.id) && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{dept.name}</div>
                  {dept.description && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{dept.description}</div>
                  )}
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      dept.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {dept.status === 'active' ? '启用' : '禁用'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ backgroundColor: '#d1d5db', borderColor: '#d1d5db', color: '#1f2937' }}
            className="px-4 py-2 rounded-lg disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}
            className="px-4 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default UserDepartmentModal
