import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'  // 添加导入
import RoleDepartmentModal from './RoleDepartmentModal'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiClient'

// 权限模块中文名称映射
const MODULE_NAMES = {
  'user': '员工管理',
  'organization': '组织架构',
  'messaging': '信息系统',
  'attendance': '考勤管理',
  'vacation': '假期管理',
  'quality': '质检管理',
  'knowledge': '知识库',
  'assessment': '考核系统',
  'system': '系统管理'
}

// 数据库中的模块名到前端模块名的映射
const MODULE_MAPPING = {
  'employee': 'user',  // 数据库中的employee模块对应前端的user模块
  'user': 'system',    // 数据库中的user权限属于system模块
  'role': 'system',    // 数据库中的role权限属于system模块
  'department': 'organization',  // 数据库中的department权限属于organization模块
  'position': 'organization',    // 数据库中的position权限属于organization模块
  'broadcast': 'messaging',      // 数据库中的broadcast权限属于messaging模块
  'schedule': 'attendance',      // 数据库中的schedule权限属于attendance模块
  'exam': 'training',            // 数据库中的exam权限属于training模块
  'training': 'assessment'       // 数据库中的training模块在前端显示为assessment模块
}

const PERMISSION_TEMPLATES = [
  { key: 'customer_basic', name: '客服基础', modules: ['messaging', 'knowledge'] },
  { key: 'attendance_admin', name: '考勤管理员', modules: ['attendance'] },
  { key: 'qa_manager', name: '质检管理员', modules: ['quality'] },
  { key: 'org_admin', name: '组织管理员', modules: ['organization'] },
  { key: 'full_access', name: '全权限', modules: Object.keys(MODULE_NAMES) }
]

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

  // 添加确认对话框状态
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({
    title: '',
    message: '',
    onConfirm: null
  })

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
  const [selectedRoleIds, setSelectedRoleIds] = useState([])
  const [isBatchRoleDeptModalOpen, setIsBatchRoleDeptModalOpen] = useState(false)
  const [batchSelectedDepartments, setBatchSelectedDepartments] = useState([])
  const [batchModuleKey, setBatchModuleKey] = useState('')
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')
  const [templateApplyMode, setTemplateApplyMode] = useState('merge')
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [clonePrefix, setClonePrefix] = useState('')
  const [cloneSuffix, setCloneSuffix] = useState('副本')
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [customTemplates, setCustomTemplates] = useState([])
  const [isTemplateManageOpen, setIsTemplateManageOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permission_ids: [] })
  const [cloneCopyDepartments, setCloneCopyDepartments] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  // URL 同步选择集（初始化）
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const selUsers = params.get('selUsers')
      const selRoles = params.get('selRoles')
      if (selUsers) {
        const arr = selUsers.split(',').map(id => parseInt(id)).filter(n => Number.isFinite(n))
        if (arr.length > 0) setSelectedUsers(arr)
      }
      if (selRoles) {
        const arr = selRoles.split(',').map(id => parseInt(id)).filter(n => Number.isFinite(n))
        if (arr.length > 0) setSelectedRoleIds(arr)
      }
    } catch {}
  }, [])

  // URL 同步选择集（变化时写入）
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (selectedUsers.length > 0) params.set('selUsers', selectedUsers.join(','))
      else params.delete('selUsers')
      if (selectedRoleIds.length > 0) params.set('selRoles', selectedRoleIds.join(','))
      else params.delete('selRoles')
      const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
      window.history.replaceState(null, '', newUrl)
    } catch {}
  }, [selectedUsers, selectedRoleIds])

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
      setIsProcessingBatch(true)
      setBatchProgress({ done: 0, total: selectedUsers.length })
      for (const userId of selectedUsers) {
        await withRetry(() => apiPost(`/api/users/${userId}/roles`, { role_id: batchRole }))
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }

      toast.success(`成功为 ${selectedUsers.length} 个用户分配角色`)
      setIsBatchModalOpen(false)
      setBatchRole('')
      setSelectedUsers([])
      fetchUsers()
    } catch (error) {
      toast.error('批量分配失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchProgress({ done: 0, total: 0 })
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
      fetchPositions(),
      fetchPermissionTemplates()
    ])
    setLoading(false)
  }

  const fetchDepartments = async () => {
    try {
      const result = await apiGet('/api/departments')
      const data = Array.isArray(result) ? result : (result.data || result)
      setDepartments((data || []).filter(d => d.status === 'active'))
    } catch (error) {
      logger.error('获取部门列表失败')
      setDepartments([])
    }
  }

  const fetchPositions = async () => {
    try {
      const result = await apiGet('/api/positions?limit=1000')
      const data = result.success ? (result.data || []) : (Array.isArray(result) ? result : [])
      setPositions((data || []).filter(p => p.status === 'active'))
    } catch (error) {
      logger.error('获取职位列表失败 - 异常:', error)
      setPositions([])
    }
  }

  const fetchRoles = async () => {
    try {
      const result = await apiGet('/api/roles')
      const rolesData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
      setRoles(rolesData)
      setFilteredRoles(rolesData)
    } catch (error) {
      logger.error('获取角色列表失败', error)
      toast.error('获取角色列表失败')
      setRoles([])
      setFilteredRoles([])
    }
  }

  const fetchUsers = async () => {
    try {
      const result = await apiGet('/api/users/roles')
      const usersData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
      setUsers(usersData)
      setFilteredUsers(usersData)
    } catch (error) {
      logger.error('获取用户列表失败', error)
      toast.error('获取用户列表失败')
      setUsers([])
      setFilteredUsers([])
    }
  }

  const fetchPermissions = async () => {
    try {
      const result = await apiGet('/api/permissions')
      const permissionsData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
      setPermissions(permissionsData)
    } catch (error) {
      logger.error('获取权限列表失败', error)
      setPermissions([])
    }
  }

  const wait = (ms) => new Promise(res => setTimeout(res, ms))
  const withRetry = async (fn, retries = 2, delayMs = 300) => {
    let lastErr
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        if (i < retries) await wait(delayMs)
      }
    }
    throw lastErr
  }

  const fetchPermissionTemplates = async () => {
    try {
      const result = await apiGet('/api/permission-templates')
      const data = result.success && Array.isArray(result.data) ? result.data : []
      setCustomTemplates(data)
    } catch (error) {
      setCustomTemplates([])
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
      if (editingRole) {
        await apiPut(`/api/roles/${editingRole.id}`, roleFormData)
        toast.success('角色更新成功')
      } else {
        await apiPost('/api/roles', roleFormData)
        toast.success('角色创建成功')
      }
      setIsRoleModalOpen(false)
      fetchRoles()
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleDeleteRole = async (roleId) => {
    // 使用模态框替换原生confirm
    setConfirmDialogConfig({
      title: '删除角色',
      message: '确定要删除这个角色吗？',
      onConfirm: async () => {
        try {
          const result = await apiDelete(`/api/roles/${roleId}`)
          // 若后端未实现该接口，result 可能为错误，上层捕获
          toast.success('角色删除成功')
          fetchRoles()
        } catch (error) {
          toast.error('删除失败')
        }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const toggleSelectRole = (roleId, checked) => {
    if (checked) {
      setSelectedRoleIds(prev => Array.from(new Set([...prev, roleId])))
    } else {
      setSelectedRoleIds(prev => prev.filter(id => id !== roleId))
    }
  }

  const handleSelectAllRoles = (checked) => {
    if (checked) {
      setSelectedRoleIds(filteredRoles.map(r => r.id))
    } else {
      setSelectedRoleIds([])
    }
  }

  const handleBatchDeleteRoles = async () => {
    if (selectedRoleIds.length === 0) return
    // 使用模态框替换原生confirm
    setConfirmDialogConfig({
      title: '批量删除角色',
      message: `确定删除选中的 ${selectedRoleIds.length} 个角色？`,
      onConfirm: async () => {
        setIsProcessingBatch(true)
        try {
          for (const roleId of selectedRoleIds) {
            const role = roles.find(r => r.id === roleId)
            if (role && !role.is_system) {
              await apiDelete(`/api/roles/${roleId}`)
            }
          }
          toast.success('批量删除完成')
          setSelectedRoleIds([])
          fetchRoles()
        } catch (e) {
          toast.error('批量删除失败')
        } finally {
          setIsProcessingBatch(false)
        }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const handleBatchToggleModule = async (enable) => {
    if (!batchModuleKey) {
      toast.error('请选择模块')
      return
    }
    if (selectedRoleIds.length === 0) {
      toast.error('请先选择角色')
      return
    }
    const modulePerms = permissions.filter(p => {
      let frontendModule = MODULE_MAPPING[p.module] || p.module
      if (frontendModule === 'training') frontendModule = 'assessment'
      return frontendModule === batchModuleKey
    })
    setIsProcessingBatch(true)
    setBatchProgress({ done: 0, total: selectedRoleIds.length * modulePerms.length })
    try {
      for (const roleId of selectedRoleIds) {
        for (const perm of modulePerms) {
          if (enable) {
            await withRetry(() => apiPost(`/api/roles/${roleId}/permissions`, { permission_id: perm.id }))
          } else {
            await withRetry(() => apiDelete(`/api/roles/${roleId}/permissions/${perm.id}`))
          }
          setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
        }
      }
      await fetchRoles()
      toast.success(enable ? '批量开启模块权限完成' : '批量关闭模块权限完成')
    } catch (e) {
      toast.error('批量操作失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchProgress({ done: 0, total: 0 })
    }
  }

  const openBatchDepartmentModal = () => {
    if (selectedRoleIds.length === 0) {
      toast.error('请先选择角色')
      return
    }
    setBatchSelectedDepartments([])
    setIsBatchRoleDeptModalOpen(true)
  }

  const handleBatchDepartmentsSave = async () => {
    if (!batchSelectedDepartments) return
    setIsProcessingBatch(true)
    setBatchProgress({ done: 0, total: selectedRoleIds.length })
    try {
      for (const roleId of selectedRoleIds) {
        await withRetry(() => apiPut(`/api/roles/${roleId}/departments`, { department_ids: batchSelectedDepartments }))
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }
      setIsBatchRoleDeptModalOpen(false)
      setSelectedRoleIds([])
      await fetchRoles()
      toast.success('批量设置部门权限完成')
    } catch (e) {
      toast.error('批量设置失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchProgress({ done: 0, total: 0 })
    }
  }

  const getTemplatePermissionIds = (templateKey) => {
    if (!templateKey) return []
    if (templateKey.startsWith('custom:')) {
      const id = parseInt(templateKey.split(':')[1])
      const tpl = customTemplates.find(t => t.id === id)
      return Array.isArray(tpl?.permission_ids) ? tpl.permission_ids : []
    }
    const tpl = PERMISSION_TEMPLATES.find(t => t.key === templateKey)
    if (!tpl) return []
    return permissions
      .filter(p => {
        let frontendModule = MODULE_MAPPING[p.module] || p.module
        if (frontendModule === 'training') frontendModule = 'assessment'
        return tpl.modules.includes(frontendModule)
      })
      .map(p => p.id)
  }

  const handleApplyTemplateToSelectedRoles = async () => {
    if (!selectedTemplateKey) {
      toast.error('请选择模板')
      return
    }
    if (selectedRoleIds.length === 0) {
      toast.error('请先选择角色')
      return
    }
    const tplPermIds = getTemplatePermissionIds(selectedTemplateKey)
    if (tplPermIds.length === 0) {
      toast.error('模板没有可用权限')
      return
    }
    setIsProcessingBatch(true)
    setBatchProgress({ done: 0, total: selectedRoleIds.length })
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId)
        if (!role) continue
        if (templateApplyMode === 'replace') {
          await withRetry(() => apiPut(`/api/roles/${roleId}`, { name: role.name, description: role.description, permissionIds: tplPermIds }))
        } else {
          const existingIds = (role.permissions || []).map(p => p.id)
          const toAdd = tplPermIds.filter(id => !existingIds.includes(id))
          for (const pid of toAdd) {
            await withRetry(() => apiPost(`/api/roles/${roleId}/permissions`, { permission_id: pid }))
          }
        }
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }
      await fetchRoles()
      setIsTemplateModalOpen(false)
      setSelectedTemplateKey('')
      toast.success(templateApplyMode === 'replace' ? '模板已覆盖到选中角色' : '模板已应用到选中角色')
    } catch (e) {
      toast.error('应用模板失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchProgress({ done: 0, total: 0 })
    }
  }

  const handleCloneSelectedRoles = async () => {
    if (selectedRoleIds.length === 0) return
    setIsProcessingBatch(true)
    setBatchProgress({ done: 0, total: selectedRoleIds.length })
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId)
        if (!role) continue
        const newName = `${clonePrefix || ''}${role.name}${cloneSuffix || ''}`
        const permissionIds = (role.permissions || []).map(p => p.id)
        const res = await withRetry(() => apiPost('/api/roles', { name: newName, description: role.description, permissionIds }))
        const newRoleId = res?.roleId || res?.id
        if (cloneCopyDepartments && newRoleId) {
          try {
            const deptRes = await withRetry(() => apiGet(`/api/roles/${roleId}/departments`))
            const deptIds = (deptRes?.data || []).map(d => d.id)
            if (deptIds.length > 0) {
              await withRetry(() => apiPut(`/api/roles/${newRoleId}/departments`, { department_ids: deptIds }))
            }
          } catch {}
        }
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }))
      }
      await fetchRoles()
      setIsCloneModalOpen(false)
      setClonePrefix('')
      setCloneSuffix('副本')
      setCloneCopyDepartments(false)
      setSelectedRoleIds([])
      toast.success('克隆完成')
    } catch (e) {
      toast.error('克隆失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchProgress({ done: 0, total: 0 })
    }
  }

  // 权限管理 - 简化版
  const handleManagePermissions = async (role) => {
    setSelectedRole(role)
    try {
      const result = await apiGet(`/api/roles/${role.id}/permissions`)
      const permissionsData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
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
    const modulePerms = permissions.filter(p => {
      let frontendModule = MODULE_MAPPING[p.module] || p.module
      if (frontendModule === 'training') frontendModule = 'assessment'
      return frontendModule === module
    })

    try {
      for (const perm of modulePerms) {
        const hasPermission = selectedRole.permissions?.some(p => p.id === perm.id)

        if (enable && !hasPermission) {
          await apiPost(`/api/roles/${selectedRole.id}/permissions`, { permission_id: perm.id })
        } else if (!enable && hasPermission) {
          await apiDelete(`/api/roles/${selectedRole.id}/permissions/${perm.id}`)
        }
      }

      // 重新获取权限
      const result = await apiGet(`/api/roles/${selectedRole.id}/permissions`)
      const permissionsData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
      setSelectedRole({ ...selectedRole, permissions: permissionsData })
      toast.success(enable ? '模块权限已开启' : '模块权限已关闭')

      // 刷新当前用户的权限
      refreshCurrentUserPermissions()
      // 强制刷新页面以确保权限更新生效
      window.location.reload()
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleTogglePermission = async (permissionId, hasPermission) => {
    try {
      if (hasPermission) {
        await apiDelete(`/api/roles/${selectedRole.id}/permissions/${permissionId}`)
      } else {
        await apiPost(`/api/roles/${selectedRole.id}/permissions`, { permission_id: permissionId })
      }

      const result = await apiGet(`/api/roles/${selectedRole.id}/permissions`)
      const permissionsData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : [])
      setSelectedRole({ ...selectedRole, permissions: permissionsData })

      // 刷新当前用户的权限（如果修改的是当前用户的角色）
      refreshCurrentUserPermissions()
      // 强制刷新页面以确保权限更新生效
      window.location.reload()
    } catch (error) {
      toast.error('操作失败')
    }
  }

  // 刷新当前用户的权限
  const refreshCurrentUserPermissions = async () => {
    try {
      const result = await apiGet('/api/auth/permissions')
      if (result.success && result.data) {
        localStorage.setItem('userPermissions', JSON.stringify(result.data))
        localStorage.setItem('permissions', JSON.stringify(result.data.permissions || []))
        localStorage.setItem('permissionDetails', JSON.stringify(result.data))
      }
    } catch (error) {
      logger.error('刷新权限失败:', error)
    }
  }

  // 用户角色管理
  const handleManageUserRoles = async (user) => {
    setSelectedUser(user)
    try {
      const data = await apiGet(`/api/users/${user.id}/roles`)
      setSelectedUser({ ...user, userRoles: data })
      setIsUserRoleModalOpen(true)
    } catch (error) {
      toast.error('获取用户角色失败')
    }
  }

  const handleSetUserRole = async (roleId) => {
    try {
      await apiPut(`/api/users/${selectedUser.id}/roles`, { roleIds: [roleId] })
      const data = await apiGet(`/api/users/${selectedUser.id}/roles`)
      setSelectedUser({ ...selectedUser, userRoles: data })
      fetchUsers()
      toast.success('角色已更新')

      // 如果修改的是当前用户，刷新权限
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      if (currentUser.id === selectedUser.id) {
        refreshCurrentUserPermissions()
        // 刷新后强制更新PermissionContext中的权限
        window.location.reload()
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  // 按模块分组权限
  const groupPermissionsByModule = () => {
    const grouped = {}
    permissions.forEach(perm => {
      // 使用映射转换模块名
      const dbModule = perm.module
      let frontendModule = MODULE_MAPPING[dbModule] || dbModule

      // 特殊处理：training模块在前端显示为assessment
      if (frontendModule === 'training') {
        frontendModule = 'assessment'
      }

      const displayModuleName = MODULE_NAMES[frontendModule] || frontendModule

      if (!grouped[displayModuleName]) {
        grouped[displayModuleName] = {
          key: frontendModule,
          permissions: []
        }
      }
      grouped[displayModuleName].permissions.push(perm)
    })
    return grouped
  }

  // 检查模块是否全部启用
  const isModuleEnabled = (moduleKey) => {
    const modulePerms = permissions.filter(p => {
      // 使用映射转换模块名
      const dbModule = p.module
      let frontendModule = MODULE_MAPPING[dbModule] || dbModule

      // 特殊处理：training模块在前端显示为assessment
      if (frontendModule === 'training') {
        frontendModule = 'assessment'
      }

      return frontendModule === moduleKey
    })

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
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.length === filteredRoles.length && filteredRoles.length > 0}
                    onChange={(e) => handleSelectAllRoles(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  全选角色
                </label>
                <span className="text-sm text-gray-600">已选 {selectedRoleIds.length} / {filteredRoles.length}</span>
              </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              disabled={selectedRoleIds.length === 0}
              className={`px-3 py-2 rounded-lg text-sm ${selectedRoleIds.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              应用权限模板
            </button>
            <button
              onClick={() => setIsCloneModalOpen(true)}
              disabled={selectedRoleIds.length === 0}
              className={`px-3 py-2 rounded-lg text-sm ${selectedRoleIds.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
            >
              批量克隆角色
            </button>
            <button
              onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({ name: '', description: '', permission_ids: [] })
                setIsTemplateManageOpen(true)
              }}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              模板管理
            </button>
            <select
              value={batchModuleKey}
              onChange={(e) => setBatchModuleKey(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
                  <option value="">选择模块</option>
                  {Object.entries(MODULE_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleBatchToggleModule(true)}
                  disabled={!batchModuleKey || selectedRoleIds.length === 0 || isProcessingBatch}
                  className={`px-3 py-2 rounded-lg text-sm ${!batchModuleKey || selectedRoleIds.length === 0 || isProcessingBatch ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  批量开启模块
                </button>
                <button
                  onClick={() => handleBatchToggleModule(false)}
                  disabled={!batchModuleKey || selectedRoleIds.length === 0 || isProcessingBatch}
                  className={`px-3 py-2 rounded-lg text-sm ${!batchModuleKey || selectedRoleIds.length === 0 || isProcessingBatch ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}
                >
                  批量关闭模块
                </button>
                <button
                  onClick={openBatchDepartmentModal}
                  disabled={selectedRoleIds.length === 0 || isProcessingBatch}
                  className={`px-3 py-2 rounded-lg text-sm ${selectedRoleIds.length === 0 || isProcessingBatch ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                >
                  批量部门权限
                </button>
            <button
              onClick={handleBatchDeleteRoles}
              disabled={selectedRoleIds.length === 0 || isProcessingBatch}
              className={`px-3 py-2 rounded-lg text-sm ${selectedRoleIds.length === 0 || isProcessingBatch ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              批量删除
            </button>
            {isProcessingBatch && (
              <span className="ml-2 text-sm text-gray-600">处理中 {batchProgress.done} / {batchProgress.total}</span>
            )}
          </div>
        </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map(role => (
              <div key={role.id} className={`border rounded-xl p-4 hover:shadow-lg transition-all ${selectedRoleIds.includes(role.id) ? 'ring-2 ring-primary-300 bg-primary-50/50' : 'bg-white'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={(e) => toggleSelectRole(role.id, e.target.checked)}
                      className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{role.name}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{role.description || '暂无描述'}</p>
                    </div>
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
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      配置权限
                    </button>
                    <button
                      onClick={() => handleManageDepartments(role)}
                      className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      部门权限
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditRole(role)}
                      className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      编辑
                    </button>
                    {!role.is_system && (
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // 全选全部（当前筛选结果中的所有用户）
                  setSelectedUsers(filteredUsers.map(u => u.id))
                }}
                className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                全选全部
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                清空选择
              </button>
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
              {isProcessingBatch && (
                <span className="ml-2 text-sm text-gray-600">处理中 {batchProgress.done} / {batchProgress.total}</span>
              )}
            </div>
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

      <Modal
        isOpen={isBatchRoleDeptModalOpen}
        onClose={() => setIsBatchRoleDeptModalOpen(false)}
        title={"批量设置角色部门权限"}
        size="large"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">已选择 {selectedRoleIds.length} 个角色</div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">已选择 <span className="font-semibold text-gray-900">{batchSelectedDepartments.length}</span> / {departments.length} 个部门</div>
            <button
              onClick={() => {
                if (batchSelectedDepartments.length === departments.length) {
                  setBatchSelectedDepartments([])
                } else {
                  setBatchSelectedDepartments(departments.map(d => d.id))
                }
              }}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
            >
              {batchSelectedDepartments.length === departments.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
            {departments.map(dept => (
              <label
                key={dept.id}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${batchSelectedDepartments.includes(dept.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={batchSelectedDepartments.includes(dept.id)}
                  onChange={() => {
                    if (batchSelectedDepartments.includes(dept.id)) {
                      setBatchSelectedDepartments(batchSelectedDepartments.filter(id => id !== dept.id))
                    } else {
                      setBatchSelectedDepartments([...batchSelectedDepartments, dept.id])
                    }
                  }}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{dept.name}</div>
                  {dept.description && (
                    <div className="text-xs text-gray-500 mt-0.5">{dept.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setIsBatchRoleDeptModalOpen(false)}
              disabled={isProcessingBatch}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleBatchDepartmentsSave}
              disabled={isProcessingBatch}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={"应用权限模板到选中角色"}
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">选择模板</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_TEMPLATES.map(tpl => (
                <label key={tpl.key} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedTemplateKey === tpl.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="permissionTemplate" value={tpl.key} checked={selectedTemplateKey === tpl.key} onChange={(e) => setSelectedTemplateKey(e.target.value)} />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                    <div className="text-xs text-gray-500">{tpl.modules.map(m => MODULE_NAMES[m]).join('、')}</div>
                  </div>
                </label>
              ))}
              {customTemplates.map(tpl => (
                <label key={`custom-${tpl.id}`} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedTemplateKey === `custom:${tpl.id}` ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="permissionTemplate" value={`custom:${tpl.id}`} checked={selectedTemplateKey === `custom:${tpl.id}`} onChange={(e) => setSelectedTemplateKey(e.target.value)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                    <div className="text-xs text-gray-500">{tpl.description || '自定义模板'}</div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">{Array.isArray(tpl.permission_ids) ? tpl.permission_ids.length : 0} 项</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">模板预览</div>
            <div className="max-h-40 overflow-y-auto text-sm text-gray-600">
              {getTemplatePermissionIds(selectedTemplateKey).map(pid => {
                const p = permissions.find(x => x.id === pid)
                return (
                  <div key={pid}>{p?.name || `权限 #${pid}`}</div>
                )
              })}
              {getTemplatePermissionIds(selectedTemplateKey).length === 0 && (
                <div className="text-gray-400">未选择模板或模板为空</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">应用方式</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="applyMode" value="merge" checked={templateApplyMode === 'merge'} onChange={() => setTemplateApplyMode('merge')} />
                合并追加（不删除已有权限）
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="applyMode" value="replace" checked={templateApplyMode === 'replace'} onChange={() => setTemplateApplyMode('replace')} />
                覆盖替换（将替换为模板权限）
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={handleApplyTemplateToSelectedRoles} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">应用模板</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        title={"批量克隆选中角色"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">前缀</label>
              <input value={clonePrefix} onChange={(e) => setClonePrefix(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="如：复制-" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">后缀</label>
              <input value={cloneSuffix} onChange={(e) => setCloneSuffix(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="如：-副本" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cloneCopyDepartments} onChange={(e) => setCloneCopyDepartments(e.target.checked)} />
            克隆时复制部门可见范围
          </label>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">将克隆 {selectedRoleIds.length} 个角色，保留描述与权限</div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setIsCloneModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={handleCloneSelectedRoles} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">开始克隆</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTemplateManageOpen}
        onClose={() => setIsTemplateManageOpen(false)}
        title={editingTemplate ? '编辑模板' : '新建模板'}
        size="large"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">模板名称</label>
              <input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">模板描述</label>
              <input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700">选择权限</div>
          <div className="max-h-64 overflow-y-auto space-y-3">
            {Object.entries(groupPermissionsByModule()).map(([moduleName, moduleData]) => (
              <div key={moduleData.key} className="border rounded">
                <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-800">{moduleName}</div>
                  <button
                    onClick={() => {
                      const ids = moduleData.permissions.map(p => p.id)
                      const hasAll = ids.every(id => templateForm.permission_ids.includes(id))
                      setTemplateForm({
                        ...templateForm,
                        permission_ids: hasAll
                          ? templateForm.permission_ids.filter(id => !ids.includes(id))
                          : Array.from(new Set([...templateForm.permission_ids, ...ids]))
                      })
                    }}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    全选/取消
                  </button>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2 bg-white">
                  {moduleData.permissions.map(perm => {
                    const checked = templateForm.permission_ids.includes(perm.id)
                    return (
                      <label key={perm.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          setTemplateForm({
                            ...templateForm,
                            permission_ids: e.target.checked
                              ? [...templateForm.permission_ids, perm.id]
                              : templateForm.permission_ids.filter(id => id !== perm.id)
                          })
                        }} />
                        <span>{perm.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">已选择 {templateForm.permission_ids.length} 项</div>
            <div className="flex gap-2">
              {editingTemplate && (
                <button
                  onClick={async () => {
                    try {
                      await apiDelete(`/api/permission-templates/${editingTemplate.id}`)
                      await fetchPermissionTemplates()
                      setIsTemplateManageOpen(false)
                      setEditingTemplate(null)
                      toast.success('模板已删除')
                    } catch (e) {
                      toast.error('删除失败')
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  删除
                </button>
              )}
              <button
                onClick={async () => {
                  if (!templateForm.name.trim()) {
                    toast.error('请输入模板名称')
                    return
                  }
                  try {
                    if (editingTemplate) {
                      await apiPut(`/api/permission-templates/${editingTemplate.id}`, templateForm)
                    } else {
                      await apiPost('/api/permission-templates', templateForm)
                    }
                    await fetchPermissionTemplates()
                    setIsTemplateManageOpen(false)
                    setEditingTemplate(null)
                    setTemplateForm({ name: '', description: '', permission_ids: [] })
                    toast.success('已保存模板')
                  } catch (e) {
                    toast.error('保存失败')
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                保存
              </button>
            </div>
          </div>
          <div className="pt-4 border-t">
            <div className="text-sm font-medium text-gray-700 mb-2">已有模板</div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {customTemplates.map(tpl => (
                <label key={tpl.id} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="tplPick" onChange={() => {
                    setEditingTemplate(tpl)
                    setTemplateForm({ name: tpl.name, description: tpl.description || '', permission_ids: tpl.permission_ids || [] })
                  }} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                    <div className="text-xs text-gray-500">{tpl.description || ''}</div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">{Array.isArray(tpl.permission_ids) ? tpl.permission_ids.length : 0} 项</span>
                </label>
              ))}
              {customTemplates.length === 0 && (
                <div className="text-sm text-gray-400">暂无模板</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 添加确认对话框 */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={confirmDialogConfig.onConfirm}
        title={confirmDialogConfig.title}
        message={confirmDialogConfig.message}
      />
    </div>
  )
}

export default PermissionManagement
