import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify'
import Modal from './Modal'
import RoleDepartmentModal from './RoleDepartmentModal'
import { getApiUrl } from '../utils/apiConfig'

// 权限模块中文名称映射
const MODULE_NAMES = {
  'user': '用户管理',
  'role': '角色管理',
  'department': '部门管理',
  'employee': '员工管理',
  'attendance': '考勤管理',
  'schedule': '排班管理',
  'leave': '请假管理',
  'quality': '质检管理',
  'exam': '考试管理',
  'assessment': '考核管理',
  'case': '案例管理',
  'knowledge': '知识库',
  'meal': '订餐管理',
  'chat': '聊天管理',
  'message': '消息管理',
  'system': '系统设置',
  'training': '培训考核'
}

function PermissionManagement() {
  const [activeTab, setActiveTab] = useState('roles')
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)

  // 模态框状态
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [isUserRoleModalOpen, setIsUserRoleModalOpen] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false)

  // 编辑状态
  const [editingRole, setEditingRole] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  // 表单数据
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    level: 1
  })

  // 搜索条件
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filteredRoles, setFilteredRoles] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])

  // 用户筛选条件
  const [userFilters, setUserFilters] = useState({
    department: '',
    position: '',
    role: '',
    dateFrom: '',
    dateTo: ''
  })

  // 根据部门筛选的职位列表
  const [filteredPositions, setFilteredPositions] = useState([])

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  // 批量选择
  const [selectedUsers, setSelectedUsers] = useState([])
  const [batchRole, setBatchRole] = useState('')

  // 快速权限模板
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  // 角色分配模态框搜索
  const [roleSearchKeyword, setRoleSearchKeyword] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  // 根据部门筛选职位
  useEffect(() => {
    if (userFilters.department) {
      const filtered = positions.filter(p =>
        !p.department_id || p.department_id === parseInt(userFilters.department)
      )
      setFilteredPositions(filtered)
    } else {
      setFilteredPositions(positions)
    }
  }, [userFilters.department, positions])

  useEffect(() => {
    if (activeTab === 'roles') {
      const filtered = roles.filter(role =>
        role.name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchKeyword.toLowerCase())
      )
      setFilteredRoles(filtered)
    } else {
      let filtered = [...users]

      // 关键词搜索
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        filtered = filtered.filter(user =>
          user.real_name?.toLowerCase().includes(keyword) ||
          user.username?.toLowerCase().includes(keyword)
        )
      }

      // 部门筛选
      if (userFilters.department) {
        filtered = filtered.filter(user => user.department_id === parseInt(userFilters.department))
      }

      // 职位筛选
      if (userFilters.position) {
        filtered = filtered.filter(user => user.position === userFilters.position)
      }

      // 角色筛选
      if (userFilters.role) {
        filtered = filtered.filter(user =>
          user.roles && user.roles.some(r => r.id === parseInt(userFilters.role))
        )
      }

      // 日期筛选（按创建时间）
      if (userFilters.dateFrom) {
        filtered = filtered.filter(user => {
          const userDate = new Date(user.created_at).toISOString().split('T')[0]
          return userDate >= userFilters.dateFrom
        })
      }

      if (userFilters.dateTo) {
        filtered = filtered.filter(user => {
          const userDate = new Date(user.created_at).toISOString().split('T')[0]
          return userDate <= userFilters.dateTo
        })
      }

      setFilteredUsers(filtered)
      setTotalPages(Math.ceil(filtered.length / pageSize))
      setCurrentPage(1)
    }
  }, [searchKeyword, roles, users, activeTab, userFilters, pageSize])

  // 获取当前页的用户数据
  const getCurrentPageUsers = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredUsers.slice(startIndex, endIndex)
  }

  // 批量分配角色
  const handleBatchAssignRole = () => {
    if (selectedUsers.length === 0) {
      toast.error('请先选择用户')
      return
    }
    setIsBatchModalOpen(true)
  }

  const handleBatchSubmit = async () => {
    if (!batchRole) {
      toast.error('请选择要分配的角色')
      return
    }

    try {
      for (const userId of selectedUsers) {
        await fetch(getApiUrl(`/api/users/${userId}/roles`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: batchRole })
        })
      }

      toast.success(`成功为 ${selectedUsers.length} 个用户分配角色`)
      setIsBatchModalOpen(false)
      setBatchRole('')
      setSelectedUsers([])
      fetchUsers()
    } catch (error) {
      toast.error('批量分配失败')
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked) => {
    if (checked) {
      const currentPageUserIds = getCurrentPageUsers().map(u => u.id)
      setSelectedUsers(currentPageUserIds)
    } else {
      setSelectedUsers([])
    }
  }

  // 单选
  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId])
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId))
    }
  }

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([
      fetchRoles(),
      fetchUsers(),
      fetchPermissions(),
      fetchDepartments(),
      fetchPositions()
    ])
    setLoading(false)
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

  const fetchRoles = async () => {
    try {
      const response = await fetch(getApiUrl('/api/roles'))
      const result = await response.json()
      let rolesData = []
      if (Array.isArray(result)) {
        rolesData = result
      } else if (result.success && Array.isArray(result.data)) {
        rolesData = result.data
      }
      setRoles(rolesData)
      setFilteredRoles(rolesData)
    } catch (error) {
      console.error('获取角色列表失败', error)
      toast.error('获取角色列表失败')
      setRoles([])
      setFilteredRoles([])
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/users/roles')) // Changed endpoint to match backend
      const result = await response.json()
      let usersData = []
      if (Array.isArray(result)) {
        usersData = result
      } else if (result.success && Array.isArray(result.data)) {
        usersData = result.data
      }
      setUsers(usersData)
      setFilteredUsers(usersData)
    } catch (error) {
      console.error('获取用户列表失败', error)
      toast.error('获取用户列表失败')
      setUsers([])
      setFilteredUsers([])
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await fetch(getApiUrl('/api/permissions'))
      const result = await response.json()
      let permissionsData = []
      if (Array.isArray(result)) {
        permissionsData = result
      } else if (result.success && Array.isArray(result.data)) {
        permissionsData = result.data
      }
      setPermissions(permissionsData)
    } catch (error) {
      console.error('获取权限列表失败', error)
      setPermissions([])
    }
  }

  // 角色管理
  const handleCreateRole = () => {
    setEditingRole(null)
    setRoleFormData({ name: '', description: '', level: 1 })
    setSelectedTemplate('custom')
    setIsRoleModalOpen(true)
  }

  const handleEditRole = (role) => {
    setEditingRole(role)
    setRoleFormData({
      name: role.name,
      description: role.description || '',
      level: role.level || 1
    })
    setIsRoleModalOpen(true)
  }

  const handleSaveRole = async () => {
    if (!roleFormData.name.trim()) {
      toast.error('请输入角色名称')
      return
    }

    try {
      const url = editingRole
        ? getApiUrl(`/api/roles/${editingRole.id}`)
        : getApiUrl('/api/roles')

      const response = await fetch(url, {
        method: editingRole ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleFormData)
      })

      if (response.ok) {
        toast.success(editingRole ? '角色更新成功' : '角色创建成功')
        setIsRoleModalOpen(false)
        fetchRoles()
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleDeleteRole = async (roleId) => {
    if (!confirm('确定要删除这个角色吗？')) return

    try {
      const response = await fetch(getApiUrl(`/api/roles/${roleId}`), {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('角色删除成功')
        fetchRoles()
      } else {
        const data = await response.json()
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 权限管理 - 简化版
  const handleManagePermissions = async (role) => {
    setSelectedRole(role)
    try {
      const response = await fetch(getApiUrl(`/api/roles/${role.id}/permissions`))
      const result = await response.json()
      let permissionsData = []
      if (Array.isArray(result)) {
        permissionsData = result
      } else if (result.success && Array.isArray(result.data)) {
        permissionsData = result.data
      }
      setSelectedRole({ ...role, permissions: permissionsData })
      setIsPermissionModalOpen(true)
    } catch (error) {
      toast.error('获取角色权限失败')
    }
  }

  // 部门权限管理
  const handleManageDepartments = (role) => {
    setSelectedRole(role)
    setIsDepartmentModalOpen(true)
  }

  const handleDepartmentSuccess = () => {
    fetchRoles()
  }

  // 一键设置模块权限
  const handleToggleModule = async (module, enable) => {
    const modulePerms = permissions.filter(p => p.module === module)

    try {
      for (const perm of modulePerms) {
        const hasPermission = selectedRole.permissions?.some(p => p.id === perm.id)

        if (enable && !hasPermission) {
          await fetch(getApiUrl(`/api/roles/${selectedRole.id}/permissions`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permission_id: perm.id })
          })
        } else if (!enable && hasPermission) {
          await fetch(getApiUrl(`/api/roles/${selectedRole.id}/permissions/${perm.id}`), {
            method: 'DELETE'
          })
        }
      }

      // 重新获取权限
      const res = await fetch(getApiUrl(`/api/roles/${selectedRole.id}/permissions`))
      const result = await res.json()
      let permissionsData = []
      if (Array.isArray(result)) {
        permissionsData = result
      } else if (result.success && Array.isArray(result.data)) {
        permissionsData = result.data
      }
      setSelectedRole({ ...selectedRole, permissions: permissionsData })
      toast.success(enable ? '模块权限已开启' : '模块权限已关闭')

      // 刷新当前用户的权限
      refreshCurrentUserPermissions()
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleTogglePermission = async (permissionId, hasPermission) => {
    try {
      const url = hasPermission
        ? getApiUrl(`/api/roles/${selectedRole.id}/permissions/${permissionId}`)
        : getApiUrl(`/api/roles/${selectedRole.id}/permissions`)

      const response = await fetch(url, {
        method: hasPermission ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: hasPermission ? undefined : JSON.stringify({ permission_id: permissionId })
      })

      if (response.ok) {
        const res = await fetch(getApiUrl(`/api/roles/${selectedRole.id}/permissions`))
        const result = await res.json()
        let permissionsData = []
        if (Array.isArray(result)) {
          permissionsData = result
        } else if (result.success && Array.isArray(result.data)) {
          permissionsData = result.data
        }
        setSelectedRole({ ...selectedRole, permissions: permissionsData })

        // 刷新当前用户的权限（如果修改的是当前用户的角色）
        refreshCurrentUserPermissions()
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  // 刷新当前用户的权限
  const refreshCurrentUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(getApiUrl('/api/auth/permissions'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        // 更新localStorage中的权限数据
        if (result.success && result.data) {
          localStorage.setItem('userPermissions', JSON.stringify(result.data))
        }
      }
    } catch (error) {
      console.error('刷新权限失败:', error)
    }
  }

  // 用户角色管理
  const handleManageUserRoles = async (user) => {
    setSelectedUser(user)
    try {
      const response = await fetch(getApiUrl(`/api/users/${user.id}/roles`))
      const data = await response.json()
      setSelectedUser({ ...user, userRoles: data })
      setIsUserRoleModalOpen(true)
    } catch (error) {
      toast.error('获取用户角色失败')
    }
  }

  const handleSetUserRole = async (roleId) => {
    try {
      // 使用 PUT 方法替换用户的所有角色
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}/roles`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds: [roleId] })
      })

      if (response.ok) {
        const res = await fetch(getApiUrl(`/api/users/${selectedUser.id}/roles`))
        const data = await res.json()
        setSelectedUser({ ...selectedUser, userRoles: data })
        fetchUsers()
        toast.success('角色已更新')

        // 如果修改的是当前用户，刷新权限
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
        if (currentUser.id === selectedUser.id) {
          refreshCurrentUserPermissions()
          // 移除提示信息，避免打扰
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || '操作失败')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  // 按模块分组权限
  const groupPermissionsByModule = () => {
    const grouped = {}
    permissions.forEach(perm => {
      const moduleName = MODULE_NAMES[perm.module] || perm.module
      if (!grouped[moduleName]) {
        grouped[moduleName] = {
          key: perm.module,
          permissions: []
        }
      }
      grouped[moduleName].permissions.push(perm)
    })
    return grouped
  }

  // 检查模块是否全部启用
  const isModuleEnabled = (moduleKey) => {
    const modulePerms = permissions.filter(p => p.module === moduleKey)
    if (modulePerms.length === 0) return false
    return modulePerms.every(p => Array.isArray(selectedRole?.permissions) && selectedRole.permissions.some(rp => rp.id === p.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">权限管理</h2>
            <p className="text-gray-500 text-sm mt-1">
              {activeTab === 'roles' ? `共 ${filteredRoles.length} 个角色` : `共 ${filteredUsers.length} 个用户`}
            </p>
          </div>
          {activeTab === 'roles' && (
            <button
              onClick={handleCreateRole}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>添加角色</span>
            </button>
          )}
        </div>

        {/* 标签页 */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'roles'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            角色管理
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            用户角色
          </button>
        </div>

        {/* 搜索框 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={activeTab === 'roles' ? '搜索角色名称或描述...' : '搜索用户姓名或用户名...'}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* 角色管理内容 */}
        {activeTab === 'roles' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map(role => (
              <div key={role.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{role.name}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{role.description || '暂无描述'}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700 ml-2">
                    级别 {role.level}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <span>{role.user_count || 0} 个用户</span>
                  <span>{role.permission_count || 0} 个权限</span>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleManagePermissions(role)}
                      className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                      配置权限
                    </button>
                    <button
                      onClick={() => handleManageDepartments(role)}
                      className="flex-1 px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                    >
                      部门权限
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditRole(role)}
                      className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                    >
                      编辑
                    </button>
                 {!role.is_system && (
                      <button
             onClick={() => handleDeleteRole(role.id)}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 用户角色内容 */}
        {activeTab === 'users' && (
          <div>
            {/* 筛选条件 */}
            {/* 筛选条件 */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <select
                value={userFilters.department}
                onChange={(e) => {
                  setUserFilters({
                    ...userFilters,
                    department: e.target.value,
                    position: '' // 清空职位选择
                  })
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">全部部门</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>

              <select
                value={userFilters.position}
                onChange={(e) => setUserFilters({ ...userFilters, position: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={!userFilters.department && filteredPositions.length === 0}
              >
                <option value="">全部职位</option>
                {filteredPositions.map(pos => (
                  <option key={pos.id} value={pos.name}>{pos.name}</option>
                ))}
              </select>

              <select
                value={userFilters.role}
                onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">全部角色</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>

              <input
                type="date"
                value={userFilters.dateFrom}
                onChange={(e) => setUserFilters({ ...userFilters, dateFrom: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="开始日期"
              />

              <input
                type="date"
                value={userFilters.dateTo}
                onChange={(e) => setUserFilters({ ...userFilters, dateTo: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="结束日期"
              />
            </div>

            {/* 批量操作按钮 */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-600">
                {selectedUsers.length > 0 && (
                  <span>已选择 <span className="font-semibold text-primary-600">{selectedUsers.length}</span> 个用户</span>
                )}
              </div>
              <button
                onClick={handleBatchAssignRole}
                disabled={selectedUsers.length === 0}
                className={`px-4 py-2 rounded-lg text-sm ${
                  selectedUsers.length > 0
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                批量分配角色
              </button>
            </div>

            {/* 用户表格 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-50 border-b border-primary-100">
                  <tr>
                    <th className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={getCurrentPageUsers().length > 0 && getCurrentPageUsers().every(u => selectedUsers.includes(u.id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">用户</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">部门</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">职位</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">角色</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">创建时间</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getCurrentPageUsers().map((user, index) => (
                    <tr key={user.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.real_name}</div>
                          <div className="text-xs text-gray-500">{user.username}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {user.department_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {user.position || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {user.roles && user.roles.length > 0 ? (
                            <>
                              {user.roles.slice(0, 2).map(role => (
                                <span key={role.id} className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                                  {role.name}
                                </span>
                              ))}
                              {user.roles.length > 2 && (
                                <div className="relative group">
                                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200 cursor-help">
                                    +{user.roles.length - 2}
                                  </span>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-48 bg-gray-800 text-white text-xs rounded p-2 shadow-lg">
                                    <div className="space-y-1">
                                      {user.roles.slice(2).map(role => (
                                        <div key={role.id}>{role.name}</div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">未分配角色</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">
                        {user.created_at ? formatDate(user.created_at) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleManageUserRoles(user)}
                          className="px-4 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
                        >
                          管理角色
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">每页显示</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-600">条</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  首页
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  上一页
                </button>

                <span className="px-4 py-1 text-sm text-gray-600">
                  第 {currentPage} / {totalPages} 页
                </span>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  末页
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 角色编辑模态框 */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? '编辑角色' : '添加角色'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              角色名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={roleFormData.name}
              onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="如：客服组长"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色描述</label>
            <textarea
              value={roleFormData.description}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="描述角色的职责和权限范围..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色级别</label>
            <input
              type="number"
              min="1"
              max="10"
              value={roleFormData.level}
              onChange={(e) => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">数字越大，级别越高（1-10）</p>
          </div>




          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsRoleModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveRole}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              {editingRole ? '更新' : '创建'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 权限管理模态框 - 简化版 */}
      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title={`配置权限 - ${selectedRole?.name}`}
        size="large"
      >
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              💡 提示：点击模块名称可以一键开启/关闭整个模块的所有权限
            </p>
          </div>

          {Object.entries(groupPermissionsByModule()).map(([moduleName, moduleData]) => {
            const isEnabled = isModuleEnabled(moduleData.key)
            return (
              <div key={moduleData.key} className="border rounded-lg overflow-hidden">
                {/* 模块标题 - 可点击 */}
                <div
                  className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleToggleModule(moduleData.key, !isEnabled)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {}}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <h4 className="font-medium text-gray-800 text-base">{moduleName}</h4>
                    <span className="text-xs text-gray-500">
                      ({moduleData.permissions.length}个权限)
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {isEnabled ? '已启用' : '未启用'}
                  </span>
                </div>

                {/* 权限列表 */}
                <div className="p-4 space-y-2 bg-white">
                  {moduleData.permissions.map(perm => {
                    const hasPermission = Array.isArray(selectedRole?.permissions) && selectedRole.permissions.some(p => p.id === perm.id)
                    return (
                      <label key={perm.id} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={hasPermission}
                          onChange={() => handleTogglePermission(perm.id, hasPermission)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{perm.name}</div>
                          {perm.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{perm.description}</div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* 批量分配角色模态框 */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false)
          setBatchRole('')
        }}
        title="批量分配角色"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              将为 <span className="font-semibold">{selectedUsers.length}</span> 个用户分配角色
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择角色 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {roles.map(role => (
                <label key={role.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded border">
                  <input
                    type="radio"
                    name="batchRole"
                    value={role.id}
                    checked={batchRole === role.id.toString()}
                    onChange={(e) => setBatchRole(e.target.value)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{role.name}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
                    级别 {role.level}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ 注意：批量分配将为选中的用户添加该角色，不会删除用户现有的角色
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsBatchModalOpen(false)
                setBatchRole('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleBatchSubmit}
              disabled={!batchRole}
              className={`px-4 py-2 rounded-lg ${
                batchRole
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              确认分配
            </button>
          </div>
        </div>
      </Modal>

      {/* 用户角色管理模态框 */}
      <Modal
        isOpen={isUserRoleModalOpen}
        onClose={() => {
          setIsUserRoleModalOpen(false)
          setRoleSearchKeyword('')
        }}
        title={`管理角色 - ${selectedUser?.real_name}`}
        size="large"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="font-medium">用户名：</span>{selectedUser?.username}</div>
              <div><span className="font-medium">部门：</span>{selectedUser?.department_name || '-'}</div>
            </div>
            <div className="w-64">
               <input
                type="text"
                placeholder="搜索角色..."
                value={roleSearchKeyword}
                onChange={(e) => setRoleSearchKeyword(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
            {roles
              .filter(role => role.name.toLowerCase().includes(roleSearchKeyword.toLowerCase()))
              .map(role => {
              const hasRole = selectedUser?.userRoles?.some(r => r.id === role.id)
              return (
                <label key={role.id} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-all ${
                  hasRole ? 'bg-primary-50 border-primary-200 ring-1 ring-primary-200' : 'hover:bg-gray-50 border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="userRole"
                    checked={hasRole}
                    onChange={() => handleSetUserRole(role.id)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div className={`text-sm font-medium ${hasRole ? 'text-primary-900' : 'text-gray-900'}`}>{role.name}</div>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${hasRole ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                            Lv.{role.level}
                        </span>
                    </div>
                    <div className={`text-xs mt-1 ${hasRole ? 'text-primary-700' : 'text-gray-500'}`}>{role.description || '暂无描述'}</div>
                  </div>
                </label>
              )
            })}
          </div>

          {roles.filter(role => role.name.toLowerCase().includes(roleSearchKeyword.toLowerCase())).length === 0 && (
             <div className="text-center py-8 text-gray-500">
                没有找到匹配的角色
             </div>
          )}
        </div>
      </Modal>

      {/* 部门权限管理模态框 */}
      <RoleDepartmentModal
        isOpen={isDepartmentModalOpen}
        onClose={() => {
          setIsDepartmentModalOpen(false)
          setSelectedRole(null)
        }}
        role={selectedRole}
        onSuccess={handleDepartmentSuccess}
      />
    </div>
  )
}

export default PermissionManagement
