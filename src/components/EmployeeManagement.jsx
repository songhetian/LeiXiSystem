import React, { useState, useEffect } from 'react'
import { toast } from 'sonner';
import Modal from './Modal'
import EmployeeDetail from './EmployeeDetail'
import EmployeeBatchOperations from './EmployeeBatchOperations'
import UserDepartmentModal from './UserDepartmentModal'  // 添加这一行
import { getApiUrl, getFileUrl } from '../utils/apiConfig'
import { formatDate, getBeijingDateString, getLocalDateString } from '../utils/date'
import { Switch } from 'antd'

function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [roles, setRoles] = useState([])
  const [filteredPositions, setFilteredPositions] = useState([])
  const [searchFilteredPositions, setSearchFilteredPositions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState(null)
  const [viewingEmp, setViewingEmp] = useState(null)
  const [deletingEmp, setDeletingEmp] = useState(null)
  const [statusChangingEmp, setStatusChangingEmp] = useState(null)
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
  const [managerChangingEmp, setManagerChangingEmp] = useState(null)
  const [managerChangeValue, setManagerChangeValue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusChangeData, setStatusChangeData] = useState({
    newStatus: '',
    changeDate: new Date().toISOString().split('T')[0],
    reason: ''
  })
  const [dbError, setDbError] = useState(false);
  const [dbErrorMessage, setDbErrorMessage] = useState('');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  // 员工部门权限状态
  const [isUserDepartmentModalOpen, setIsUserDepartmentModalOpen] = useState(false);
  const [selectedUserForDepartment, setSelectedUserForDepartment] = useState(null);

  // 批量操作状态
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState('');

  // 资产确认模态框状态
  const [isAssetConfirmModalOpen, setIsAssetConfirmModalOpen] = useState(false);
  const [assetConfirmData, setAssetConfirmData] = useState({ count: 0, deviceNos: '' });
  const [pendingAction, setPendingAction] = useState(null);

  // 搜索条件
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    department: '',
    position: '',
    status: 'active', // 默认显示在职员工
    rating: '',
    dateFrom: '',
    dateTo: ''
  })
  const [formData, setFormData] = useState({
    employee_no: '',
    real_name: '',
    email: '',
    phone: '',
    department_id: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    rating: 3,
    status: 'active',
    avatar: '',
    emergency_contact: '',
    emergency_phone: '',
    address: '',
    education: '',
    skills: '',
    remark: '',
    role_id: '', // 修改为单个角色ID
    is_department_manager: false,
    username: ''
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [avatarPreview, setAvatarPreview] = useState('')

  useEffect(() => {
    fetchEmployees()
    fetchDepartments()
    fetchPositions()
    fetchRoles()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      // 构建查询参数
      const params = new URLSearchParams();
      if (searchFilters.keyword) params.append('keyword', searchFilters.keyword);
      if (searchFilters.department) params.append('department_id', searchFilters.department);
      if (searchFilters.position) params.append('position', searchFilters.position);
      if (searchFilters.status) params.append('status', searchFilters.status);
      if (searchFilters.rating) params.append('rating', searchFilters.rating);
      if (searchFilters.dateFrom) params.append('date_from', searchFilters.dateFrom);
      if (searchFilters.dateTo) params.append('date_to', searchFilters.dateTo);

      const queryString = params.toString();
      const url = queryString ? `/api/employees?${queryString}` : '/api/employees';

      const response = await fetch(getApiUrl(url), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json()
      setEmployees(data)
      setFilteredEmployees(data) // 使用后端返回的数据，不再需要前端过滤
      setDbError(false);
      setDbErrorMessage('');
    } catch (error) {
      // 检查是否是连接错误
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        const errorMsg = '无法连接到后端服务器,请确保后端服务已启动 (npm run server)';
        toast.error(errorMsg, {
          autoClose: 5000
        })
        setDbError(true);
        setDbErrorMessage(errorMsg);
      } else {
        toast.error('获取员工列表失败')
        setDbError(true);
        setDbErrorMessage('获取员工列表失败');
      }
      console.error('获取员工列表失败:', error)
      // 在无法获取数据时显示友好的提示信息
      setEmployees([])
      setFilteredEmployees([])
    } finally {
      setLoading(false)
    }
  }

  // 搜索过滤 - 现在通过后端API处理
  useEffect(() => {
    // 每次搜索条件变化时重新获取数据
    fetchEmployees();
  }, [searchFilters, pageSize])

  // 获取当前页的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredEmployees.slice(startIndex, endIndex)
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
      rating: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      // 使用带权限控制的部门列表接口
      const response = await fetch(getApiUrl('/api/departments/list'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      console.log('获取部门列表结果:', result);
      if (result.success) {
        setDepartments(result.data.filter(d => d.status === 'active'));
      } else {
        // 如果/api/departments/list不可用，回退到普通端点
        const fallbackResponse = await fetch(getApiUrl('/api/departments'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const fallbackData = await fallbackResponse.json();
        setDepartments(Array.isArray(fallbackData) ? fallbackData.filter(d => d.status === 'active') : []);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
      // 出错时设置为空数组或默认值
      setDepartments([]);
    }
  };

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
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/roles'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      if (Array.isArray(result)) {
        setRoles(result)
      } else if (result.success && Array.isArray(result.data)) {
        setRoles(result.data)
      } else {
        setRoles([])
      }
    } catch (error) {
      console.error('获取角色列表失败', error)
      setRoles([])
    }
  }

  // 根据部门筛选职位（表单用）
  useEffect(() => {
    if (formData.department_id) {
      const filtered = positions.filter(p =>
        !p.department_id || p.department_id === parseInt(formData.department_id)
      )
      setFilteredPositions(filtered)
    } else {
      setFilteredPositions(positions)
    }
  }, [formData.department_id, positions])

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

  // 部门改变时清空职位选择（表单）
  const handleDepartmentChange = (departmentId) => {
    setFormData({
      ...formData,
      department_id: departmentId,
      position: '' // 清空职位
    })
  }

  // 部门改变时清空职位选择（搜索筛选）
  const handleSearchDepartmentChange = (departmentId) => {
    setSearchFilters({
      ...searchFilters,
      department: departmentId,
      position: '' // 清空职位
    })
  }

  // --- 新增：处理主管身份快速切换 ---
  const handleManagerToggle = async (checked, emp) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${emp.user_id}/department-manager`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDepartmentManager: checked })
      })
      const result = await response.json()
      if (result.success) {
        toast.success(`已${checked ? '授权' : '撤销'}主管身份`);
        // 立即刷新列表以反映最新状态
        fetchEmployees();
      } else {
        toast.error(result.message || '更新失败');
      }
    } catch (e) {
      console.error(e);
      toast.error('网络通讯失败');
    }
  }

  const performSubmit = async () => {
    try {
      const url = editingEmp
        ? getApiUrl(`/api/employees/${editingEmp.id}`)
        : getApiUrl('/api/employees')

      const response = await fetch(url, {
        method: editingEmp ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const result = await response.json()
        const userId = editingEmp ? editingEmp.user_id : result.id

        // 如果是编辑员工，且部门或职位发生变化，记录到变动表
        if (editingEmp) {
          const isDeptChanged = parseInt(formData.department_id) !== editingEmp.department_id;
          const isPosChanged = formData.position !== editingEmp.position_name;

          if (isDeptChanged || isPosChanged) {
            try {
              const changeData = {
                employee_id: editingEmp.id,
                user_id: editingEmp.user_id,
                change_type: 'transfer',
                change_date: getLocalDateString(),
                old_department_id: editingEmp.department_id,
                new_department_id: formData.department_id,
                old_position: editingEmp.position_name,
                new_position: formData.position,
                reason: '信息变更'
              };

              await fetch(getApiUrl('/api/employee-changes/create'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(changeData)
              });
            } catch (err) {
              console.error('记录员工变动失败:', err);
            }
          }
        } else if (result.id) {
          // 如果是新增员工，记录入职记录
          try {
            const changeData = {
              employee_id: result.id,
              user_id: result.user_id || result.id,
              change_type: 'hire',
              change_date: formData.hire_date || getLocalDateString(),
              old_department_id: null,
              new_department_id: formData.department_id,
              old_position: null,
              new_position: formData.position,
              reason: '新员工入职'
            };

            await fetch(getApiUrl('/api/employee-changes/create'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(changeData)
            });
          } catch (err) {
            console.error('记录入职记录失败:', err);
          }
        }

        // 更新用户角色（单个角色）
        if (formData.role_id) {
          try {
            // 先获取当前角色
            const currentRolesRes = await fetch(getApiUrl(`/api/users/${userId}/roles`), {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
            const currentRoles = await currentRolesRes.json()

            // 删除所有现有角色
            for (const role of currentRoles) {
              await fetch(getApiUrl(`/api/users/${userId}/roles/${role.id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
              })
            }

            // 添加新角色
            await fetch(getApiUrl(`/api/users/${userId}/roles`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ roleId: formData.role_id })
            })
          } catch (roleErr) {
            console.error('更新角色失败:', roleErr);
          }
        }

        // 更新部门主管标识
        if (userId) {
          try {
            await fetch(getApiUrl(`/api/users/${userId}/department-manager`), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ isDepartmentManager: formData.is_department_manager })
            })
          } catch (mgrErr) {
            console.error('更新主管标识失败:', mgrErr);
          }
        }

        toast.success(editingEmp ? '员工更新成功' : '员工创建成功')
        
        // 🚨 同步更新当前登录用户的 localStorage 缓存
        if (editingEmp && userId) {
          const savedUserStr = localStorage.getItem('user');
          if (savedUserStr) {
            try {
              const savedUser = JSON.parse(savedUserStr);
              // 如果修改的是当前登录用户
              if (parseInt(savedUser.id) === parseInt(userId)) {
                console.log('检测到正在修改当前登录用户的资料，同步更新 localStorage...');
                const updatedUser = {
                  ...savedUser,
                  real_name: formData.real_name,
                  email: formData.email,
                  phone: formData.phone,
                  avatar: formData.avatar,
                  department_id: formData.department_id,
                  // 这里可以根据需要增加更多同步字段
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                // 触发 storage 事件，通知 App.jsx, Sidebar, TopNavbar 等组件更新状态
                window.dispatchEvent(new Event('storage'));
                // 同时触发一个自定义事件，以防万一
                window.dispatchEvent(new CustomEvent('userInfoUpdated', { detail: updatedUser }));
              }
            } catch (e) {
              console.error('同步更新 localStorage 失败:', e);
            }
          }
        }

        setIsModalOpen(false)
        fetchEmployees()
        resetForm()
      }
    } catch (error) {
      console.error(error);
      toast.error('操作失败')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 表单校验
    const errors = {}
    if (!formData.real_name) errors.real_name = true
    if (!formData.phone) errors.phone = true
    if (!formData.department_id) errors.department_id = true
    if (!formData.position) errors.position = true

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast.error('请填写必填项')
      return
    }

    try {
      // 如果是离职/停用操作，先检查名下资产
      if (editingEmp && formData.status !== 'active' && editingEmp.status === 'active') {
        try {
          const token = localStorage.getItem('token')
          const assetRes = await fetch(getApiUrl(`/api/assets/employee/${editingEmp.user_id}`), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const assetData = await assetRes.json();

          if (assetData.success && assetData.data && assetData.data.length > 0) {
            const deviceNos = assetData.data.map(d => d.asset_no).join(', ');
            setAssetConfirmData({ count: assetData.data.length, deviceNos });
            setPendingAction(() => performSubmit);
            setIsAssetConfirmModalOpen(true);
            return;
          }
        } catch (err) {
          console.error('资产校验失败:', err);
        }
      }

      await performSubmit();
    } catch (error) {
      toast.error('提交表单失败')
    }
  }

  const handleEdit = async (emp) => {
    try {
      // 获取用户的角色信息
      const token = localStorage.getItem('token')
      const roleResponse = await fetch(getApiUrl(`/api/users/${emp.user_id}/roles`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const roleData = await roleResponse.json()
      const userRoles = roleData.success ? roleData.data : []

      setEditingEmp(emp)
      setFormData({
        employee_no: emp.employee_no || '',
        real_name: emp.real_name || '',
        email: emp.email || '',
        phone: emp.phone || '',
        department_id: emp.department_id || '',
        position: emp.position_name || '',
        hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
        rating: emp.rating || 3,
        status: emp.status || 'active',
        avatar: emp.avatar || '',
        emergency_contact: emp.emergency_contact || '',
        emergency_phone: emp.emergency_phone || '',
        address: emp.address || '',
        education: emp.education || '',
        skills: emp.skills || '',
        remark: emp.remark || '',
        role_id: userRoles.length > 0 ? userRoles[0].id : '',
        is_department_manager: emp.is_department_manager === 1 || emp.is_department_manager === true,
        username: emp.username || ''
      })
      setAvatarPreview(emp.avatar || '')
      setIsModalOpen(true)
    } catch (error) {
      console.error('获取员工角色信息失败:', error)
      toast.error('获取员工信息失败')
    }
  }

  const handleDeleteClick = (emp) => {
    setDeletingEmp(emp)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingEmp) return

    try {
      const response = await fetch(getApiUrl(`/api/employees/${deletingEmp.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        toast.success('员工删除成功')
        setIsDeleteModalOpen(false)
        setDeletingEmp(null)
        fetchEmployees()
      } else {
        toast.error('删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleStatusClick = (emp) => {
    setStatusChangingEmp(emp)
    setStatusChangeData({
      newStatus: emp.status,
      changeDate: getLocalDateString(),
      reason: ''
    })
    setIsStatusModalOpen(true)
  }

    const handleStatusChange = async () => {
      if (!statusChangingEmp || !statusChangeData.newStatus) return

      const performStatusChange = async () => {
        try {
          const response = await fetch(getApiUrl(`/api/employees/${statusChangingEmp.id}/status-closure`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              status: statusChangeData.newStatus,
              reason: statusChangeData.reason,
              changeDate: statusChangeData.changeDate
            })
          })
          if (response.ok) {
            toast.success('状态更新成功，操作已审计');
            setIsStatusModalOpen(false)
            fetchEmployees()
          }
        } catch (error) {
          console.error(error);
          toast.error('提交失败')
        }
      }

      // 如果是离职/停用操作，先检查名下资产
      if (statusChangeData.newStatus !== 'active') {
        try {
          const token = localStorage.getItem('token')
          const assetRes = await fetch(getApiUrl(`/api/assets/employee/${statusChangingEmp.user_id}`), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const assetData = await assetRes.json();

          if (assetData.success && assetData.data && assetData.data.length > 0) {
            const deviceNos = assetData.data.map(d => d.asset_no).join(', ');
            setAssetConfirmData({ count: assetData.data.length, deviceNos });
            setPendingAction(() => performStatusChange);
            setIsAssetConfirmModalOpen(true);
            return;
          }
        } catch (err) {
          console.error('资产校验失败:', err);
        }
      }

      await performStatusChange();
    }

  // 批量操作功能 (调用新接口)
  const handleBatchStatusUpdate = async () => {
    if (selectedEmployeeIds.length === 0) return
    try {
      const token = localStorage.getItem('token')
      // 统一使用 batch-closure 接口处理所有状态变更
      let endpoint = `/api/employees/batch-closure`;
      let method = 'POST';
      let body = {
        ids: selectedEmployeeIds,
        status: batchOperationType,
        reason: '批量后台操作'
      };

      const response = await fetch(getApiUrl(endpoint), {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const statusText = batchOperationType === 'active' ? '恢复' : (batchOperationType === 'resigned' ? '离职' : '停用');
        toast.success(`成功批量${statusText} ${selectedEmployeeIds.length} 名员工`);
        setIsBatchModalOpen(false)
        setSelectedEmployeeIds([])
        fetchEmployees()
      }
    } catch (error) { toast.error('批量操作失败') }
  }



  // 批量强制下线功能
  const handleBatchLogout = async () => {
    if (selectedEmployeeIds.length === 0) return

    try {
      const selectedEmployees = employees.filter(emp => selectedEmployeeIds.includes(emp.id))
      const userIds = selectedEmployees.map(emp => emp.user_id).filter(Boolean)

      if (userIds.length === 0) {
        toast.error('选中的员工没有关联的用户账号')
        return
      }

      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl('/api/auth/batch-logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userIds })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || '操作成功')
        setSelectedEmployeeIds([])
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || '批量下线失败')
      }
    } catch (error) {
      console.error('批量下线失败:', error)
      toast.error('操作异常: ' + error.message)
    }
  }

  const handleManagerClick = (emp) => {
    setManagerChangingEmp(emp)
    setManagerChangeValue(emp.is_department_manager === 1 || emp.is_department_manager === true)
    setIsManagerModalOpen(true)
  }

  const handleManagerChangeConfirm = async () => {
    if (!managerChangingEmp || !managerChangingEmp.user_id) {
      toast.error('无法获取用户ID')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${managerChangingEmp.user_id}/department-manager`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDepartmentManager: managerChangeValue })
      })

      if (response.ok) {
        toast.success('部门主管状态更新成功')
        setIsManagerModalOpen(false)
        setManagerChangingEmp(null)
        fetchEmployees()
      } else {
        toast.error('更新失败')
      }
    } catch (error) {
      console.error('更新部门主管状态失败:', error)
      toast.error('更新失败')
    }
  }

  const handleViewDetail = (emp) => {
    setViewingEmp(emp)
    setIsDetailOpen(true)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件')
        return
      }

      // 验证文件大小（限制2MB）
      if (file.size > 2 * 1024 * 1024) {
        toast.error('图片大小不能超过2MB')
        return
      }

      // 读取文件并转换为Base64
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result
        setFormData({ ...formData, avatar: base64String })
        setAvatarPreview(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setFormData({ ...formData, avatar: '' })
    setAvatarPreview('')
  }

  const resetForm = () => {
    setFormData({
      employee_no: '',
      real_name: '',
      email: '',
      phone: '',
      department_id: '',
      position: '',
      hire_date: new Date().toISOString().split('T')[0],
      rating: 3,
      status: 'active',
      avatar: '',
      emergency_contact: '',
      emergency_phone: '',
      address: '',
      education: '',
      skills: '',
      remark: '',
      role_id: '',
      is_department_manager: false,
      username: ''
    })
    setValidationErrors({})
    setAvatarPreview('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    )
  }

  if (dbError) {
    return (
      <div className="p-6 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-xl mx-auto">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">数据库连接问题</h2>
          <p className="text-xs text-amber-800 mb-4">{dbErrorMessage}</p>
          <div className="bg-white p-4 border border-amber-100 rounded text-left text-xs text-gray-600">
            <h3 className="font-semibold mb-3 text-gray-700">解决方案：</h3>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>确保已复制整个项目文件夹，而不仅仅是exe文件</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>在项目根目录运行 <code className="bg-gray-100 px-2 py-0.5 rounded text-amber-900 font-mono">npm run server</code> 启动后端服务</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>检查.env文件中的数据库配置是否正确</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>确认MySQL数据库服务正在运行</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 处理员工部门权限管理
  const handleManageUserDepartments = (emp) => {
    console.log('打开员工部门权限管理:', emp);
    // 适配 UserDepartmentModal，它期望 id 是用户 ID
    const userObj = {
      ...emp,
      id: emp.user_id
    };
    setSelectedUserForDepartment(userObj);
    setIsUserDepartmentModalOpen(true);
  };

  // 员工部门权限设置成功回调
  const handleUserDepartmentSuccess = () => {
    console.log('员工部门权限设置成功');
    toast.success('员工部门权限设置成功');
    // 刷新员工列表
    fetchEmployees();
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">员工管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理公司员工信息、权限与状态</p>
          </div>
          <div className="flex items-center gap-3">
            <EmployeeBatchOperations onImportSuccess={fetchEmployees} />
            <button
              onClick={() => {
                resetForm();
                setEditingEmp(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm font-medium rounded-lg hover:from-gray-800 hover:to-gray-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="text-lg">+</span>
              <span>新增员工</span>
            </button>
            <button
              onClick={() => {
                // 构建查询参数
                let exportUrl = `/api/export/employees`;
                const params = new URLSearchParams();

                if (searchFilters.status) params.append('status', searchFilters.status);
                if (searchFilters.department) params.append('department_id', searchFilters.department);
                if (searchFilters.position) params.append('position', searchFilters.position);
                if (searchFilters.keyword) params.append('keyword', searchFilters.keyword);

                if (params.toString()) {
                  exportUrl += '?' + params.toString();
                }

                window.open(getApiUrl(exportUrl), '_blank');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-lg hover:from-green-700 hover:to-green-800 hover:shadow-lg transition-all duration-200"
            >
              <span>📤</span>
              <span>导出员工</span>
            </button>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          {/* 批量操作按钮区域 */}
          {selectedEmployeeIds.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="text-sm text-blue-700">
                已选择 <span className="font-bold">{selectedEmployeeIds.length}</span> 名员工
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBatchOperationType('active')
                    setIsBatchModalOpen(true)
                  }}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                >
                  一键在职
                </button>
                <button
                  onClick={() => {
                    setBatchOperationType('inactive')
                    setIsBatchModalOpen(true)
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 transition-colors"
                >
                  一键停用
                </button>
                <button
                  onClick={() => {
                    setBatchOperationType('resigned')
                    setIsBatchModalOpen(true)
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                >
                  一键离职
                </button>
                <button
                  onClick={handleBatchLogout}
                  className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-black transition-colors"
                >
                  一键下线
                </button>
                <button
                  onClick={() => setSelectedEmployeeIds([])}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
                >
                  取消选择
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">搜索</label>
              <input
                type="text"
                placeholder="姓名 / 工号 / 手机号"
                value={searchFilters.keyword}
                onChange={(e) => handleSearchChange('keyword', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">部门</label>
              <select
                value={searchFilters.department}
                onChange={(e) => handleSearchDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
              >
                <option value="">全部</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">职位</label>
              <select
                value={searchFilters.position}
                onChange={(e) => handleSearchChange('position', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
                disabled={!searchFilters.department}
              >
                <option value="">全部</option>
                {searchFilteredPositions.map(pos => (
                  <option key={pos.id} value={pos.name}>{pos.name}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">状态</label>
              <select value={searchFilters.status} onChange={(e) => handleSearchChange('status', e.target.value)} className="w-full px-3 py-2 border border-gray-200 text-sm rounded bg-white">
                <option value="active">在职</option>
                <option value="inactive">停用</option>
                <option value="resigned">离职</option>
                <option value="deleted">已删除</option>
                <option value="">全部</option>
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">评级</label>
              <select
                value={searchFilters.rating}
                onChange={(e) => handleSearchChange('rating', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
              >
                <option value="">全部</option>
                <option value="5">5星</option>
                <option value="4">4星</option>
                <option value="3">3星</option>
                <option value="2">2星</option>
                <option value="1">1星</option>
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">入职开始</label>
              <input
                type="date"
                value={searchFilters.dateFrom}
                onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 tracking-wide uppercase">入职结束</label>
              <input
                type="date"
                value={searchFilters.dateTo}
                onChange={(e) => handleSearchChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
              />
            </div>
            {(searchFilters.keyword || searchFilters.department || searchFilters.position || searchFilters.status || searchFilters.rating || searchFilters.dateFrom || searchFilters.dateTo) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-200 rounded hover:border-gray-300 hover:bg-white transition-all"
              >
                清空筛选
              </button>
            )}
          </div>

          {/* 快捷时间选择按钮 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">快捷选择：</span>
            <button
              onClick={() => {
                const today = getLocalDateString()
                setSearchFilters({ ...searchFilters, dateFrom: today, dateTo: today })
              }}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                searchFilters.dateFrom === searchFilters.dateTo && searchFilters.dateFrom === getLocalDateString()
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              今天
            </button>
            <button
              onClick={() => {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                const dateStr = getLocalDateString(yesterday)
                setSearchFilters({ ...searchFilters, dateFrom: dateStr, dateTo: dateStr })
              }}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                (() => {
                  const yesterday = new Date()
                  yesterday.setDate(yesterday.getDate() - 1)
                  const dateStr = getLocalDateString(yesterday)
                  return searchFilters.dateFrom === searchFilters.dateTo && searchFilters.dateFrom === dateStr
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                })()
              }`}
            >
              昨天
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const threeDaysAgo = new Date(now)
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 2)
                setSearchFilters({
                  ...searchFilters,
                  dateFrom: getLocalDateString(threeDaysAgo),
                  dateTo: getLocalDateString(now)
                })
              }}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              近3天
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const sevenDaysAgo = new Date(now)
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
                setSearchFilters({
                  ...searchFilters,
                  dateFrom: getLocalDateString(sevenDaysAgo),
                  dateTo: getLocalDateString(now)
                })
              }}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              近7天
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const thirtyDaysAgo = new Date(now)
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
                setSearchFilters({
                  ...searchFilters,
                  dateFrom: getLocalDateString(thirtyDaysAgo),
                  dateTo: getLocalDateString(now)
                })
              }}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              近30天
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                setSearchFilters({
                  ...searchFilters,
                  dateFrom: getLocalDateString(firstDayOfMonth),
                  dateTo: getLocalDateString(now)
                })
              }}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              本月
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
                setSearchFilters({
                  ...searchFilters,
                  dateFrom: getLocalDateString(firstDayLastMonth),
                  dateTo: getLocalDateString(lastDayLastMonth)
                })
              }}
              className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              上月
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3.5 text-center w-12">
                  <input
                    type="checkbox"
                    checked={getCurrentPageData().length > 0 && getCurrentPageData().every(emp => selectedEmployeeIds.includes(emp.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const currentPageIds = getCurrentPageData().map(emp => emp.id)
                        setSelectedEmployeeIds([...new Set([...selectedEmployeeIds, ...currentPageIds])])
                      } else {
                        const currentPageIds = getCurrentPageData().map(emp => emp.id)
                        setSelectedEmployeeIds(selectedEmployeeIds.filter(id => !currentPageIds.includes(id)))
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 tracking-wide uppercase">员工信息</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">登录账号</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">部门</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">职位</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">联系方式</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">可查看部门</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">评级</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">部门主管</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">状态</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 tracking-wide uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-5 py-16 text-center">
                    <p className="text-gray-400 text-sm">{employees.length === 0 ? '暂无员工数据' : '没有符合条件的员工'}</p>
                  </td>
                </tr>
              ) : (
                getCurrentPageData().map((emp, index) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployeeIds([...selectedEmployeeIds, emp.id])
                          } else {
                            setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 cursor-pointer overflow-hidden flex-shrink-0 hover:shadow-md transition-shadow"
                          onClick={() => handleViewDetail(emp)}
                        >
                          {emp.avatar ? (
                            <img src={getFileUrl(emp.avatar)} alt={emp.real_name} className="w-full h-full object-cover" />
                          ) : (
                            emp.real_name?.charAt(0) || '-'
                          )}
                        </div>
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleViewDetail(emp)}>
                          <div className="text-sm font-medium text-gray-900 truncate">{emp.real_name}</div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">{emp.employee_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-gray-600">
                      <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-medium">{emp.username || '-'}</span>
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-gray-600">
                      {emp.department_name || '-'}
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-gray-600">
                      {emp.position_name || '-'}
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-gray-600">
                      {emp.phone || emp.email || '-'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {emp.departments && emp.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {emp.departments.slice(0, 2).map(dept => (
                            <span key={dept.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {dept.name}
                            </span>
                          ))}
                          {emp.departments.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">
                              +{emp.departments.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                          默认权限
                        </span>
                      )}
                    </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-black border border-amber-100">{emp.rating}星</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Switch
                      size="small"
                      checked={emp.is_department_manager === 1}
                      onChange={(checked) => handleManagerToggle(checked, emp)}
                      className={emp.is_department_manager ? 'bg-blue-600' : 'bg-gray-200'}
                    />
                  </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleStatusClick(emp)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${emp.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.status === 'resigned'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {emp.status === 'active' ? '在职' : emp.status === 'resigned' ? '离职' : '停用'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleManageUserDepartments(emp)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors"
                        >
                          部门权限
                        </button>
                        <button
                          onClick={() => handleEdit(emp)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteClick(emp)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页组件 */}
        {filteredEmployees.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2.5 py-1.5 border border-gray-200 text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>条，共 {filteredEmployees.length} 条</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-all"
              >
                首页
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-all"
              >
                上一页
              </button>

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
                      className={`px-3 py-1.5 text-sm border rounded transition-all ${currentPage === pageNum
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-200 hover:bg-white hover:border-gray-300'
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
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-all"
              >
                下一页
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-all"
              >
                末页
              </button>

              <span className="text-sm text-gray-500 ml-2">
                {currentPage} / {totalPages}
              </span>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          resetForm()
        }}
        title={editingEmp ? '编辑员工' : '新增员工'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-gray-500">
            <span className="text-red-500">*</span> 为必填项
          </div>

          {/* 头像上传区域 */}
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div className="relative">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-2xl font-medium text-gray-600 overflow-hidden border border-gray-200">
                {avatarPreview ? (
                  <img src={getFileUrl(avatarPreview)} alt="头像预览" className="w-full h-full object-cover" />
                ) : (
                  <span>{formData.real_name?.charAt(0) || '员'}</span>
                )}
              </div>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full text-xs hover:bg-gray-900 transition-colors"
                  title="删除头像"
                >
                  ×
                </button>
              )}
            </div>
            <div>
              <label className="px-4 py-2 bg-gray-900 text-white text-sm cursor-pointer hover:bg-gray-800 inline-block rounded transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                选择图片
              </label>
              <p className="text-xs text-gray-400 mt-2">支持 JPG、PNG，不超过 2MB</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 tracking-wide uppercase ${validationErrors.real_name ? 'text-red-500' : 'text-gray-700'}`}>
                姓名 <span className="text-red-500 ml-1">*(必填)</span>
              </label>
              <input
                type="text"
                required
                value={formData.real_name}
                onChange={(e) => {
                  setFormData({ ...formData, real_name: e.target.value });
                  if (validationErrors.real_name) setValidationErrors(prev => ({ ...prev, real_name: false }));
                }}
                className={`w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all ${validationErrors.real_name ? 'border-red-500 bg-red-50/30' : ''}`}
                placeholder="请输入员工姓名"
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 tracking-wide uppercase ${validationErrors.username ? 'text-red-500' : 'text-gray-700'}`}>
                登录账号 {!editingEmp && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => {
                  setFormData({ ...formData, username: e.target.value });
                  if (validationErrors.username) setValidationErrors(prev => ({ ...prev, username: false }));
                }}
                className={`w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all ${validationErrors.username ? 'border-red-500 bg-red-50/30' : ''} ${editingEmp ? 'bg-gray-100 text-gray-500' : ''}`}
                placeholder={editingEmp ? "" : "留空则使用姓名"}
                readOnly={!!editingEmp}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 tracking-wide uppercase ${validationErrors.phone ? 'text-red-500' : 'text-gray-700'}`}>
                手机号 <span className="text-red-500 ml-1">*(必填)</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (validationErrors.phone) setValidationErrors(prev => ({ ...prev, phone: false }));
                }}
                className={`w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all ${validationErrors.phone ? 'border-red-500 bg-red-50/30' : ''}`}
                placeholder="请输入手机号"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">邮箱</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
                placeholder="请输入邮箱"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1.5 tracking-wide uppercase ${validationErrors.department_id ? 'text-red-500' : 'text-gray-700'}`}>
                所属部门 <span className="text-red-500 ml-1">*(必填)</span>
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => {
                  handleDepartmentChange(e.target.value);
                  if (validationErrors.department_id) setValidationErrors(prev => ({ ...prev, department_id: false }));
                }}
                className={`w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white ${validationErrors.department_id ? 'border-red-500 bg-red-50/30' : ''}`}
              >
                <option value="">请选择</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">职位</label>
              <select
                value={formData.position}
                onChange={(e) => {
                  setFormData({ ...formData, position: e.target.value });
                  if (validationErrors.position) setValidationErrors(prev => ({ ...prev, position: false }));
                }}
                className={`w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white ${validationErrors.position ? 'border-red-500' : ''}`}
                disabled={!formData.department_id}
              >
                <option value="">请选择</option>
                {filteredPositions.map(pos => (
                  <option key={pos.id} value={pos.name}>{pos.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">入职日期</label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">账号状态</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
              >
                <option value="active">在职</option>
                <option value="inactive">停用</option>
                <option value="resigned">离职</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">员工评级</label>
              <select
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
              >
                {[1, 2, 3, 4, 5].map(r => (
                  <option key={r} value={r}>{r}星</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">紧急联系人</label>
              <input
                type="text"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">家庭住址</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">学历</label>
            <select
              value={formData.education}
              onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
            >
              <option value="">请选择</option>
              <option value="高中">高中</option>
              <option value="大专">大专</option>
              <option value="本科">本科</option>
              <option value="硕士">硕士</option>
              <option value="博士">博士</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">员工角色</label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
            >
              <option value="">请选择</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name} (级别 {role.level})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">技能特长</label>
            <textarea
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              rows="2"
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none resize-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">备注</label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              rows="2"
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none resize-none transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                resetForm()
              }}
              className="px-5 py-2 border border-gray-200 text-sm hover:bg-white hover:border-gray-300 rounded transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 rounded transition-colors"
            >
              {editingEmp ? '更新' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      <EmployeeDetail
        employee={viewingEmp}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setViewingEmp(null)
        }}
        departments={departments}
      />

      {/* 删除确认模态框 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDeletingEmp(null)
        }}
        title="确认删除"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">确定要删除以下员工吗？</p>
          {deletingEmp && (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-sm">
              <p><span className="text-gray-500">姓名：</span>{deletingEmp.real_name}</p>
              <p><span className="text-gray-500">工号：</span>{deletingEmp.employee_no}</p>
              <p><span className="text-gray-500">部门：</span>{departments.find(d => d.id === deletingEmp.department_id)?.name || '-'}</p>
            </div>
          )}
          <p className="text-xs text-red-600">此操作将永久删除该员工的所有信息，无法恢复。</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeletingEmp(null)
              }}
              className="px-5 py-2 border border-gray-200 text-sm hover:bg-white hover:border-gray-300 rounded transition-all"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-5 py-2 bg-red-600 text-white text-sm hover:bg-red-700 rounded transition-colors"
            >
              确认删除
            </button>
          </div>
        </div>
      </Modal>

      {/* 状态修改模态框 */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false)
          setStatusChangingEmp(null)
        }}
        title="修改员工状态"
      >
        <div className="space-y-4">
          {statusChangingEmp && (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-sm">
              <p><span className="text-gray-500">姓名：</span>{statusChangingEmp.real_name}</p>
              <p><span className="text-gray-500">工号：</span>{statusChangingEmp.employee_no}</p>
              <p><span className="text-gray-500">部门：</span>{departments.find(d => d.id === statusChangingEmp.department_id)?.name || '-'}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">
              新状态 <span className="text-red-500">*</span>
            </label>
            <select
              value={statusChangeData.newStatus}
              onChange={(e) => setStatusChangeData({ ...statusChangeData, newStatus: e.target.value })}
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all bg-white"
            >
              <option value="active">在职</option>
              <option value="inactive">停用</option>
              <option value="resigned">离职</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">
              变动日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={statusChangeData.changeDate}
              onChange={(e) => setStatusChangeData({ ...statusChangeData, changeDate: e.target.value })}
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 tracking-wide uppercase">变动原因</label>
            <textarea
              value={statusChangeData.reason}
              onChange={(e) => setStatusChangeData({ ...statusChangeData, reason: e.target.value })}
              rows="3"
              placeholder="请输入状态变动的原因..."
              className="w-full px-3 py-2 border text-sm rounded focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none resize-none transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsStatusModalOpen(false)
                setStatusChangingEmp(null)
              }}
              className="px-5 py-2 border border-gray-200 text-sm hover:bg-white hover:border-gray-300 rounded transition-all"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleStatusChange}
              className="px-5 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 rounded transition-colors"
            >
              确认修改
            </button>
          </div>
        </div>
      </Modal>
      {/* 部门主管设置模态框 */}
            <Modal
              isOpen={isManagerModalOpen}
              onClose={() => setIsManagerModalOpen(false)}
              title="设置部门主管"
              size="small"
              footer={
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsManagerModalOpen(false)}
                    className="px-5 py-2 border border-gray-200 text-sm hover:bg-white hover:border-gray-300 rounded transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleManagerChangeConfirm}
                    className="px-5 py-2 bg-gray-900 text-white text-sm hover:bg-gray-800 rounded transition-colors"
                  >
                    确认
                  </button>
                </div>
              }
            >
              <div className="p-4">
                <div className="text-center mb-5">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl font-medium text-gray-600 mx-auto mb-3 overflow-hidden">
                    {managerChangingEmp?.avatar ? (
                      <img src={getFileUrl(managerChangingEmp.avatar)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      managerChangingEmp?.real_name?.charAt(0)
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{managerChangingEmp?.real_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{managerChangingEmp?.department_name} - {managerChangingEmp?.position}</p>
                </div>

                <div className="border border-gray-200 p-4 rounded-lg">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-gray-700">设为部门主管</span>
                    <input
                      type="checkbox"
                      checked={managerChangeValue}
                      onChange={(e) => setManagerChangeValue(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    设置为部门主管后，该员工将拥有审批本部门员工考勤申请的权限。
                  </p>
                </div>
              </div>
            </Modal>

      {/* 用户部门管理模态框 */}
      <UserDepartmentModal
        isOpen={isUserDepartmentModalOpen}
        onClose={() => setIsUserDepartmentModalOpen(false)}
        user={selectedUserForDepartment}
        onSuccess={handleUserDepartmentSuccess}
      />

      {/* 批量操作确认模态框 */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false)
          setBatchOperationType('')
        }}
        title="确认批量操作"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            确定要将选中的 <span className="font-bold text-gray-900">{selectedEmployeeIds.length}</span> 名员工设置为
            <span className={`font-bold ml-1 ${
              batchOperationType === 'active' ? 'text-green-600' :
              batchOperationType === 'inactive' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {batchOperationType === 'active' ? '在职' :
               batchOperationType === 'inactive' ? '停用' :
               '离职'}
            </span>
            状态吗？
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">此操作将：</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>批量更新员工状态</li>
              <li>自动记录员工变动信息</li>
              <li>操作后不可撤销</li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setIsBatchModalOpen(false)
              setBatchOperationType('')
            }}
            className="px-5 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-white hover:border-gray-300 rounded transition-all"
          >
            取消
          </button>
          <button
            onClick={handleBatchStatusUpdate}
            className={`px-5 py-2 text-white text-sm rounded transition-colors ${
              batchOperationType === 'active' ? 'bg-green-600 hover:bg-green-700' :
              batchOperationType === 'inactive' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-red-600 hover:bg-red-700'
            }`}
          >
            确认
          </button>
        </div>
      </Modal>

      {/* 资产变更确认模态框 */}
      <Modal
        isOpen={isAssetConfirmModalOpen}
        onClose={() => {
          setIsAssetConfirmModalOpen(false);
          setPendingAction(null);
        }}
        title="设备回收确认"
        size="small"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold">资产变动警告</p>
              <p className="text-xs mt-1">该员工名下仍有 <span className="font-bold underline">{assetConfirmData.count}</span> 台在用设备。</p>
            </div>
          </div>

          <div className="px-1">
            <p className="text-xs text-gray-500 mb-2 uppercase font-medium">涉及设备编号：</p>
            <div className="p-3 bg-gray-50 rounded border border-gray-100 max-h-32 overflow-y-auto">
              <p className="text-xs font-mono text-gray-600 break-all leading-relaxed">
                {assetConfirmData.deviceNos}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">
            * 确认操作后，上述设备将自动转为“闲置”状态并解除绑定。
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => {
              setIsAssetConfirmModalOpen(false);
              setPendingAction(null);
            }}
            className="px-5 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-white hover:border-gray-300 rounded transition-all"
          >
            取消操作
          </button>
          <button
            onClick={async () => {
              if (pendingAction) await pendingAction();
              setIsAssetConfirmModalOpen(false);
              setPendingAction(null);
            }}
            className="px-5 py-2 bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 rounded shadow-sm transition-all"
          >
            确认并继续
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeManagement
