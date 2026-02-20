import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import RoleDepartmentModal from '../../components/RoleDepartmentModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getApiUrl } from '../../utils/apiConfig';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiClient';
import '../../styles/antd-custom.css';
import { Table, Button, Form, Input, Tree, Drawer, Select, Space, Tag, Card, Modal as AntdModal } from 'antd';
import { EyeOutlined, LockOutlined, UserOutlined, TeamOutlined, PlusOutlined, CopyOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';

const { Option } = Select;

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]); // 添加用户状态
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false); // 添加抽屉状态
  const [editingRole, setEditingRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // 用于分配用户的选中角色
  const [selectedUsers, setSelectedUsers] = useState([]); // 用于分配用户的选中用户
  const [form] = Form.useForm();
  const [userForm] = Form.useForm(); // 用户分配表单
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateApplyMode, setTemplateApplyMode] = useState('merge');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [isTemplateManageOpen, setIsTemplateManageOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permission_ids: [] });
  const [departments, setDepartments] = useState([]);
  const [isBatchDeptOpen, setIsBatchDeptOpen] = useState(false);
  const [batchSelectedDepartments, setBatchSelectedDepartments] = useState([]);
  const [clonePrefix, setClonePrefix] = useState('');
  const [cloneSuffix, setCloneSuffix] = useState('副本');
  const [cloneCopyDepartments, setCloneCopyDepartments] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({
    title: '',
    message: '',
    onConfirm: null
  });

  // 部门权限状态
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [selectedRoleForDepartment, setSelectedRoleForDepartment] = useState(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    fetchPermissionTemplates();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/roles');
      if (response.success) {
        // 获取每个角色的部门权限信息
        const rolesWithDepartments = await Promise.all(response.data.map(async (role) => {
          try {
            const deptResponse = await apiGet(`/api/roles/${role.id}/departments`);
            if (deptResponse.success) {
              return { ...role, departments: deptResponse.data };
            }
          } catch (error) {
            console.error(`获取角色 ${role.name} 的部门权限失败:`, error);
          }
          return { ...role, departments: [] };
        }));
        setRoles(rolesWithDepartments);
      }
    } catch (error) {
      toast.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await apiGet('/api/permissions');
      if (response.success) {
        setPermissions(response.data);
      }
    } catch (error) {
      toast.error('获取权限列表失败');
    }
  };

  const fetchPermissionTemplates = async () => {
    try {
      const res = await apiGet('/api/permission-templates');
      console.log('获取权限模板结果:', res);
      const data = res.success && Array.isArray(res.data) ? res.data : [];
      console.log('解析后的模板数据:', data);
      setCustomTemplates(data);
    } catch (error) {
      console.error('获取权限模板失败:', error);
      setCustomTemplates([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiGet('/api/departments');
      const data = res.success ? (res.data || []) : (Array.isArray(res) ? res : []);
      setDepartments((data || []).filter(d => d.status === 'active'));
    } catch {
      setDepartments([]);
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      const response = await apiGet('/api/users-with-roles');
      if (response.success) {
        setUsers(response.data);
      } else if (Array.isArray(response)) {
        // 兼容旧的API格式
        setUsers(response);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      toast.error('获取用户列表失败');
    }
  };

  const moduleNames = {
    system: '系统管理',
    user: '用户管理',
    organization: '组织架构',
    messaging: '信息系统',
    attendance: '考勤管理',
    vacation: '假期管理',
    quality: '质检管理',
    knowledge: '知识库',
    assessment: '考核系统',
    schedule: '排班管理',
    exam: '考试管理',
    training: '培训管理',
    memo: '备忘录管理',
    learning: '学习中心',
    device: '设备管理'
  };

  const [activeTemplateKey, setActiveTemplateKey] = useState('');
  const [permissionSearchText, setPermissionSearchText] = useState(''); // 新增：权限树搜索

  // --- 性能优化：过滤后的权限树数据 ---
  const filteredPermissionTreeData = useMemo(() => {
    const modules = {};
    const searchLower = permissionSearchText.toLowerCase();

    permissions.forEach(p => {
      const mod = p.module || 'system';
      const description = p.description || '未命名权限';
      const code = p.code || '';

      // 搜索过滤逻辑
      if (permissionSearchText && 
          !description.toLowerCase().includes(searchLower) && 
          !code.toLowerCase().includes(searchLower) &&
          !(moduleNames[mod] || '').toLowerCase().includes(searchLower)) {
        return;
      }

      if (!modules[mod]) {
        modules[mod] = {
          title: moduleNames[mod] || '系统管理',
          key: `module-${mod}`,
          children: []
        };
      }
      modules[mod].children.push({
        title: `${description} (${code})`,
        key: p.id.toString(),
        isLeaf: true
      });
    });
    return Object.values(modules);
  }, [permissions, permissionSearchText]);

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setCheckedKeys([]);
    setActiveTemplateKey('');
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRole(record);
    form.setFieldsValue(record);
    // 设置已选权限
    const keys = record.permissions ? record.permissions.map(p => p.id.toString()) : [];
    setCheckedKeys(keys);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await apiDelete(`/api/roles/${id}`);
      if (response.success) {
        toast.success('删除成功');
        fetchRoles();
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 部门权限管理
  const handleManageDepartments = (role) => {
    setSelectedRoleForDepartment(role);
    setIsDepartmentModalOpen(true);
  };

  const handleDepartmentSuccess = () => {
    fetchRoles();
  };

  // 清理模板搜索框
  const [templateSearchText, setTemplateSearchText] = useState('');
  const clearTemplateSearch = () => {
    setTemplateSearchText('');
  };

  // 分配用户给角色
  const handleAssignUsers = async (role) => {
    setSelectedRole(role);
    setDrawerVisible(true);
    fetchUsers();

    // 获取当前已分配给该角色的用户
    try {
      const response = await apiGet(`/api/roles/${role.id}/users`);
      if (response.success && Array.isArray(response.data)) {
        const userIds = response.data.map(user => user.id);
        setSelectedUsers(userIds);
        userForm.setFieldsValue({ users: userIds });
      }
    } catch (error) {
      console.error('获取角色用户失败:', error);
      toast.error('获取角色用户失败');
    }
  };

  // 保存用户分配
  const handleSaveUserAssignment = async () => {
    try {
      const values = await userForm.validateFields();

      // 调用API保存用户分配
      await apiPut(`/api/roles/${selectedRole.id}/users`, {
        userIds: values.users
      });

      toast.success('用户分配成功');
      setDrawerVisible(false);
      fetchRoles(); // 刷新角色列表
    } catch (error) {
      toast.error('分配失败: ' + (error.message || '未知错误'));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 如果是创建新角色，检查是否已存在同名角色
      if (!editingRole) {
        const roleName = values.name.trim();
        const existingRole = roles.find(role => role.name === roleName);
        if (existingRole) {
          toast.error('已存在同名角色，请使用其他名称');
          return;
        }

        // 特殊检查：不能创建名为"超级管理员"的角色
        if (roleName === '超级管理员') {
          toast.error('不能创建名称为超级管理员的角色');
          return;
        }
      }

      // 过滤掉模块节点，只保留实际的权限 ID
      const permissionIds = checkedKeys.filter(key => !key.startsWith('module-')).map(Number);

      const payload = {
        ...values,
        permissionIds
      };

      if (editingRole) {
        await apiPut(`/api/roles/${editingRole.id}`, payload);
        toast.success('更新成功');
      } else {
        await apiPost('/api/roles', payload);
        toast.success('创建成功');
      }
      setModalVisible(false);
      fetchRoles(); // 刷新角色列表，包括部门权限信息
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const onCheck = (checkedKeysValue) => {
    setCheckedKeys(checkedKeysValue);
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      render: (text, record) => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold text-gray-900">{text}</span>
          {record.is_system && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              系统
            </span>
          )}
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      render: (text) => (
        <span className="text-sm text-gray-500">{text || '-'}</span>
      )
    },
    {
      title: '可查看部门',
      key: 'departments',
      align: 'center',
      render: (_, record) => {
        if (!record.departments || record.departments.length === 0) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">
              <EyeOutlined className="text-xs" />
              未设置
            </span>
          );
        }

        const displayDeps = record.departments.slice(0, 2);
        const remainingCount = record.departments.length - 2;

        return (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {displayDeps.map(dept => (
              <span
                key={dept.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg"
              >
                <EyeOutlined className="text-xs" />
                {dept.name}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg">
                +{remainingCount}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: '权限数量',
      key: 'permissions',
      align: 'center',
      render: (_, record) => {
        const count = record.permissions ? record.permissions.length : 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg">
            <LockOutlined className="text-xs" />
            {count}
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleAssignUsers(record)}
            className="text-blue-600 hover:text-blue-700"
          >
            分配用户
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleManageDepartments(record)}
            className="text-purple-600 hover:text-purple-700"
          >
            部门权限
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleEdit(record)}
            disabled={record.name === '超级管理员'}
            className="text-green-600 hover:text-green-700"
          >
            编辑
          </Button>
          {!record.is_system ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => {
                setConfirmDialogConfig({
                  title: '删除角色',
                  message: '确定删除该角色吗？删除后将无法恢复',
                  onConfirm: async () => {
                    await handleDelete(record.id);
                  }
                });
                setIsConfirmDialogOpen(true);
              }}
            >
              删除
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              disabled
              title="系统角色不能删除"
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const withRetry = async (fn, retries = 2, delayMs = 300) => {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i < retries) await wait(delayMs);
      }
    }
    throw lastErr;
  };

  const BUILTIN_TEMPLATES = [
    { key: 'customer_basic', name: '客服基础', modules: ['quality', 'learning', 'memo'] },
    { key: 'attendance_admin', name: '考勤管理员', modules: ['attendance', 'schedule'] },
    { key: 'qa_manager', name: '质检管理员', modules: ['quality'] },
    { key: 'org_admin', name: '组织管理员', modules: ['system', 'user'] },
    { key: 'employee_basic', name: '员工基础权限', permissions: [
      'messaging:broadcast:view',
      'attendance:record:view',
      'vacation:record:view',
      'attendance:approval:manage',
      'vacation:approval:manage',
      'knowledge:article:view',
      'assessment:plan:view',
      'assessment:result:view',
      'user:profile:update',
      'user:memo:manage'
    ]},
    { key: 'full_access', name: '全权限', modules: Object.keys(moduleNames) }
  ];

  const getTemplatePermissionIds = (tplKey) => {
    if (!tplKey) return [];
    if (tplKey.startsWith('custom:')) {
      const id = parseInt(tplKey.split(':')[1]);
      const tpl = customTemplates.find(t => t.id === id);
      return Array.isArray(tpl?.permission_ids) ? tpl.permission_ids : [];
    }
    const tpl = BUILTIN_TEMPLATES.find(t => t.key === tplKey);
    if (!tpl) return [];

    // 如果模板定义了具体的权限代码，直接使用这些权限
    if (tpl.permissions) {
      return permissions
        .filter(p => tpl.permissions.includes(p.code))
        .map(p => p.id);
    }

    // 否则按模块过滤
    return permissions
      .filter(p => tpl.modules.includes(p.module))
      .map(p => p.id);
  };

  const handleBatchDeleteRoles = async () => {
    if (selectedRoleIds.length === 0) return;
    setIsProcessingBatch(true);
    setBatchProgress({ done: 0, total: selectedRoleIds.length });
    try {
      for (const roleId of selectedRoleIds) {
        await withRetry(() => apiDelete(`/api/roles/${roleId}`));
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }
      toast.success('批量删除完成');
      setSelectedRoleIds([]);
      fetchRoles();
    } catch {
      toast.error('批量删除失败');
    } finally {
      setIsProcessingBatch(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  };

  const openBatchDepartmentModal = async () => {
    await fetchDepartments();
    setIsBatchDeptOpen(true);
  };

  const handleBatchDepartmentsSave = async () => {
    setIsProcessingBatch(true);
    setBatchProgress({ done: 0, total: selectedRoleIds.length });
    try {
      for (const roleId of selectedRoleIds) {
        await withRetry(() => apiPut(`/api/roles/${roleId}/departments`, { department_ids: batchSelectedDepartments }));
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }
      setIsBatchDeptOpen(false);
      setSelectedRoleIds([]);
      fetchRoles();
      toast.success('批量设置部门权限完成');
    } catch {
      toast.error('批量设置失败');
    } finally {
      setIsProcessingBatch(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  };

  const handleApplyTemplateToSelectedRoles = async () => {
    if (!selectedTemplateKey) {
      toast.error('请选择权限模板');
      return;
    }
    if (selectedRoleIds.length === 0) {
      toast.error('请选择至少一个角色');
      return;
    }

    setIsProcessingBatch(true);
    setBatchProgress({ done: 0, total: selectedRoleIds.length });
    try {
      const templatePermissionIds = getTemplatePermissionIds(selectedTemplateKey);
      for (const roleId of selectedRoleIds) {
        try {
          // 获取角色当前权限
          const roleRes = await apiGet(`/api/roles/${roleId}`);
          let currentPermissionIds = [];
          if (roleRes.success && roleRes.data && roleRes.data.permissions) {
            currentPermissionIds = roleRes.data.permissions.map(p => p.id);
          } else if (Array.isArray(roleRes) && roleRes.length > 0) {
            // 兼容旧的API格式
            currentPermissionIds = roleRes[0].permissions.map(p => p.id);
          }

          // 根据模式决定最终权限ID列表
          let finalPermissionIds;
          if (templateApplyMode === 'replace') {
            finalPermissionIds = templatePermissionIds;
          } else {
            // merge模式：合并现有权限和模板权限
            finalPermissionIds = [...new Set([...currentPermissionIds, ...templatePermissionIds])];
          }

          // 更新角色权限
          await apiPut(`/api/roles/${roleId}`, {
            name: roleRes.data?.name || roleRes[0]?.name,
            description: roleRes.data?.description || roleRes[0]?.description,
            permissionIds: finalPermissionIds
          });
        } catch (e) {
          console.error(`应用模板到角色 ${roleId} 失败:`, e);
        }
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }
      setIsTemplateModalOpen(false);
      setSelectedRoleIds([]);
      setSelectedTemplateKey('');
      fetchRoles();
      toast.success('模板应用完成');
    } catch {
      toast.error('应用模板失败');
    } finally {
      setIsProcessingBatch(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  };

  const [searchText, setSearchText] = useState('');

  // 克隆角色功能
  const handleCloneSelectedRoles = async () => {
    if (selectedRoleIds.length === 0) return;
    setIsProcessingBatch(true);
    setBatchProgress({ done: 0, total: selectedRoleIds.length });
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId);
        if (!role) continue;
        const newName = `${clonePrefix || ''}${role.name}${cloneSuffix || ''}`;
        const permissionIds = (role.permissions || []).map(p => p.id);

        // 创建新角色
        const res = await apiPost('/api/roles', {
          name: newName,
          description: role.description,
          permissionIds
        });

        const newRoleId = res?.data?.id || res?.id;

        // 如果需要复制部门权限
        if (cloneCopyDepartments && newRoleId) {
          try {
            const deptRes = await apiGet(`/api/roles/${roleId}/departments`);
            const deptIds = (deptRes?.data || []).map(d => d.id);
            if (deptIds.length > 0) {
              await apiPut(`/api/roles/${newRoleId}/departments`, { department_ids: deptIds });
            }
          } catch (error) {
            console.error('复制部门权限失败:', error);
          }
        }

        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }

      await fetchRoles();
      setIsCloneModalOpen(false);
      setClonePrefix('');
      setCloneSuffix('副本');
      setCloneCopyDepartments(false);
      setSelectedRoleIds([]);
      toast.success('克隆完成');
    } catch (error) {
      console.error('克隆失败:', error);
      toast.error('克隆失败');
    } finally {
      setIsProcessingBatch(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  };

  // 过滤角色
  const filteredRoles = useMemo(() => {
    if (!searchText) return roles;
    return roles.filter(role =>
      role.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [roles, searchText]);

  // 清空搜索
  const clearSearch = () => {
    setSearchText('');
  };

  // 在模板管理模态框中添加搜索功能
  // 修改过滤模块的逻辑，只显示有权限项的模块
  const filteredModules = Object.entries(moduleNames).filter(([key, name]) => {
    // 检查该模块是否有权限项
    const modulePermissions = permissions.filter(p => p.module === key);
    if (modulePermissions.length === 0) return false; // 如果没有权限项，不显示该模块

    // 如果搜索框为空，显示所有有权限项的模块
    if (!templateSearchText) return true;

    // 检查模块名称或模块key是否匹配搜索词，或者模块内有权限项匹配搜索词
    return name.toLowerCase().includes(templateSearchText.toLowerCase()) ||
           key.toLowerCase().includes(templateSearchText.toLowerCase()) ||
           modulePermissions.some(p =>
             p.description.toLowerCase().includes(templateSearchText.toLowerCase()) ||
             p.code.toLowerCase().includes(templateSearchText.toLowerCase())
           );
  });

  // 过滤权限项
  const getFilteredPermissions = (moduleKey, permissions) => {
    if (!templateSearchText) return permissions.filter(p => p.module === moduleKey);

    return permissions.filter(p =>
      p.module === moduleKey &&
      (p.description.toLowerCase().includes(templateSearchText.toLowerCase()) ||
       p.code.toLowerCase().includes(templateSearchText.toLowerCase()))
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">角色权限管理</h2>
            <p className="text-gray-500 text-sm mt-1">管理系统中的角色及其权限配置</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size="large"
              className="bg-gray-900 border-none hover:bg-gray-800 h-10 px-6 rounded-lg shadow-sm"
            >
              新增角色
            </Button>
            <Button
              icon={<CopyOutlined />}
              onClick={() => setIsCloneModalOpen(true)}
              className="h-10 px-4 rounded-lg flex items-center"
            >
              复制角色
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchRoles}
              className="h-10 px-4 rounded-lg flex items-center"
            >
              刷新
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setIsTemplateManageOpen(true)}
              className="h-10 px-4 rounded-lg flex items-center"
            >
              模板管理
            </Button>
          </div>
        </div>

        {/* 统计卡片 (视觉优化) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[24px] p-6 shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-1">总角色数</div>
              <div className="text-4xl font-black text-white">{roles.length}</div>
              <div className="text-[10px] text-indigo-200 mt-2 font-bold uppercase flex items-center gap-1">
                <LockOutlined className="w-3 h-3" /> 系统鉴权中心
              </div>
            </div>
            <LockOutlined className="absolute -right-4 -bottom-4 text-white/10 text-8xl transition-transform group-hover:scale-110" />
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">系统内置</div>
              <div className="text-4xl font-black text-slate-800">{roles.filter(r => r.is_system).length}</div>
              <div className="text-[10px] text-rose-500 mt-2 font-bold uppercase">核心安全保护</div>
            </div>
            <TeamOutlined className="absolute -right-4 -bottom-4 text-slate-50 text-8xl transition-transform group-hover:scale-110" />
          </div>

          <div className="bg-slate-900 rounded-[24px] p-6 shadow-xl shadow-slate-200 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">自定义定义</div>
              <div className="text-4xl font-black text-white">{roles.filter(r => !r.is_system).length}</div>
              <div className="text-[10px] text-emerald-400 mt-2 font-bold uppercase">灵活权限分配</div>
            </div>
            <SettingOutlined className="absolute -right-4 -bottom-4 text-white/5 text-8xl transition-transform group-hover:scale-110" />
          </div>
        </div>

        {/* 批量操作条 */}
        {selectedRoleIds.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-blue-800">
              已选择 {selectedRoleIds.length} 个角色
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                应用模板
              </Button>
              <Button
                size="small"
                onClick={openBatchDepartmentModal}
                className="flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                部门权限
              </Button>
              <Button
                size="small"
                danger
                onClick={() => {
                  setConfirmDialogConfig({
                    title: '批量删除角色',
                    message: `确定删除选中的 ${selectedRoleIds.length} 个角色吗？删除后将无法恢复`,
                    onConfirm: async () => {
                      await handleBatchDeleteRoles();
                    }
                  });
                  setIsConfirmDialogOpen(true);
                }}
                disabled={isProcessingBatch}
                className="flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          rowSelection={{
            selectedRowKeys: selectedRoleIds,
            onChange: (keys) => setSelectedRoleIds(keys),
            preserveSelectedRowKeys: true,
            columnWidth: 40
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <AntdModal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={900}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入角色描述" rows={2} />
          </Form.Item>

          {/* 模板选择 */}
          {!editingRole && (
            <Form.Item label="权限模板">
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {customTemplates.map(tpl => (
                  <label
                    key={`custom-${tpl.id}`}
                    className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="template"
                      value={`custom:${tpl.id}`}
                      checked={activeTemplateKey === `custom:${tpl.id}`}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setActiveTemplateKey(`custom:${tpl.id}`);
                          const templatePermissionIds = getTemplatePermissionIds(`custom:${tpl.id}`);
                          setCheckedKeys(templatePermissionIds.map(id => id.toString()));
                        }
                      }}
                    />
                    <span className="text-sm">{tpl.name}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="template"
                    value=""
                    checked={activeTemplateKey === ''}
                    onChange={() => {
                      setActiveTemplateKey('');
                      setCheckedKeys([]);
                    }}
                  />
                  <span className="text-sm">无模板</span>
                </label>
              </div>
              <div className="mt-2 text-sm text-gray-500">选择模板可快速填充权限配置</div>
            </Form.Item>
          )}

          <Form.Item label="权限配置">
            <div className="mb-3">
              <Input
                placeholder="搜索功能名称或代码..."
                prefix={<EyeOutlined className="text-gray-400" />}
                value={permissionSearchText}
                onChange={e => setPermissionSearchText(e.target.value)}
                allowClear
                className="rounded-lg"
              />
            </div>
            <div className="border rounded-lg p-3 max-h-80 overflow-y-auto bg-gray-50 shadow-inner">
              <Tree
                checkable
                defaultExpandAll={!permissionSearchText} // 搜索时自动展开，不搜索时保持原有逻辑
                onCheck={onCheck}
                checkedKeys={checkedKeys}
                treeData={filteredPermissionTreeData}
                virtual
                height={300} // 固定高度开启虚拟滚动
              />
            </div>
          </Form.Item>
        </Form>
      </AntdModal>

      {/* 用户分配抽屉 */}
      <Drawer
        title={`为 "${selectedRole?.name}" 角色分配用户`}
        width={480}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="users"
            label="选择用户"
            rules={[{ required: true, message: '请选择至少一个用户' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择用户"
              optionLabelProp="label"
              showSearch
              filterOption={(input, option) =>
                option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {users.map(user => (
                <Option
                  key={user.id}
                  value={user.id}
                  label={`${user.real_name} (${user.username})`}
                >
                  <div className="flex items-center">
                    <UserOutlined className="mr-2 text-gray-500" />
                    <div>
                      <div className="font-medium">{user.real_name}</div>
                      <div className="text-xs text-gray-500">@{user.username}</div>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
          <Button
            onClick={() => setDrawerVisible(false)}
            style={{ backgroundColor: '#d1d5db', borderColor: '#d1d5db', color: '#1f2937' }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleSaveUserAssignment}
            className="flex items-center justify-center"
          >
            保存
          </Button>
        </div>
      </Drawer>

      {/* 部门权限管理模态框 */}
      <RoleDepartmentModal
        isOpen={isDepartmentModalOpen}
        onClose={() => {
          setIsDepartmentModalOpen(false);
          setSelectedRoleForDepartment(null);
        }}
        role={selectedRoleForDepartment}
        onSuccess={handleDepartmentSuccess}
      />

      {/* 模板管理模态框 */}
      <AntdModal
        title="权限模板管理"
        open={isTemplateManageOpen}
        onCancel={() => {
          setIsTemplateManageOpen(false);
          clearTemplateSearch(); // 关闭时清空搜索框
        }}
        footer={null}
        width={1000}
      >
        <div className="py-2">
          {/* 操作按钮区域 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              type="primary"
              onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({ name: '', description: '', permission_ids: [] });
                clearTemplateSearch(); // 新建模板时清空搜索框
              }}
            >
              新建模板
            </Button>
            <Button
              onClick={async () => {
                try {
                  const res = await apiPost('/api/permission-templates/create-default', {});
                  if (res.success) {
                    toast.success(res.message);
                    fetchPermissionTemplates(); // 刷新模板列表
                  } else {
                    toast.warning(res.message);
                  }
                } catch (error) {
                  toast.error('创建默认模板失败');
                }
              }}
            >
              创建默认模板
            </Button>
            <Button
              onClick={fetchPermissionTemplates}
            >
              刷新
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：模板列表 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">已有模板</div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {customTemplates.map(tpl => (
                  <div
                    key={tpl.id}
                    className={`px-3 py-2.5 rounded cursor-pointer transition-all ${
                      editingTemplate?.id === tpl.id
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setTemplateForm({
                        name: tpl.name,
                        description: tpl.description || '',
                        permission_ids: tpl.permission_ids || []
                      });
                      clearTemplateSearch(); // 编辑模板时清空搜索框
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{tpl.name}</span>
                      <span className="text-xs text-gray-500">
                        {Array.isArray(tpl.permission_ids) ? tpl.permission_ids.length : 0} 项
                      </span>
                    </div>
                  </div>
                ))}
                {customTemplates.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-8">暂无自定义模板</div>
                )}
              </div>
            </div>

            {/* 右侧：模板编辑表单 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">
                {editingTemplate ? '编辑模板' : '新建模板'}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">模板名称</label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="请输入模板名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">模板描述</label>
                  <Input
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="请输入模板描述"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">权限配置</label>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500">已选择 {templateForm.permission_ids.length} 项</div>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const allPermIds = permissions.map(p => p.id);
                          const allSelected = allPermIds.every(id => templateForm.permission_ids.includes(id));
                          if (allSelected) {
                            setTemplateForm({ ...templateForm, permission_ids: [] });
                          } else {
                            setTemplateForm({ ...templateForm, permission_ids: allPermIds });
                          }
                        }}
                      >
                        {permissions.every(p => templateForm.permission_ids.includes(p.id)) ? '取消全选' : '全选所有'}
                      </Button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <Input
                      placeholder="搜索权限..."
                      value={templateSearchText}
                      onChange={(e) => setTemplateSearchText(e.target.value)}
                      allowClear
                    />
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredModules.map(([key, name]) => {
                      const modulePerms = getFilteredPermissions(key, permissions);
                      if (templateSearchText && modulePerms.length === 0) return null;

                      const modulePermIds = modulePerms.map(p => p.id);
                      const allSelected = modulePermIds.every(id => templateForm.permission_ids.includes(id));

                      return (
                        <div key={key} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-900">{name}</span>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                if (allSelected) {
                                  setTemplateForm({
                                    ...templateForm,
                                    permission_ids: templateForm.permission_ids.filter(id => !modulePermIds.includes(id))
                                  });
                                } else {
                                  const newPermIds = [...new Set([...templateForm.permission_ids, ...modulePermIds])];
                                  setTemplateForm({
                                    ...templateForm,
                                    permission_ids: newPermIds
                                  });
                                }
                              }}
                            >
                              {allSelected ? '取消' : '全选'}
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {modulePerms.map(perm => {
                              const checked = templateForm.permission_ids.includes(perm.id);
                              return (
                                <label key={perm.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setTemplateForm({
                                        ...templateForm,
                                        permission_ids: e.target.checked
                                          ? [...templateForm.permission_ids, perm.id]
                                          : templateForm.permission_ids.filter(id => id !== perm.id)
                                      });
                                    }}
                                  />
                                  <span className="text-gray-700">{perm.description}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {templateSearchText && filteredModules.length === 0 && (
                      <div className="text-center text-gray-500 py-4 text-sm">
                        未找到匹配的权限
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between pt-2">
                  <div>
                    {editingTemplate && (
                      <Button
                        danger
                        onClick={async () => {
                          try {
                            await apiDelete(`/api/permission-templates/${editingTemplate.id}`);
                            await fetchPermissionTemplates();
                            setEditingTemplate(null);
                            setTemplateForm({ name: '', description: '', permission_ids: [] });
                            toast.success('模板已删除');
                          } catch {
                            toast.error('删除失败');
                          }
                        }}
                      >
                        删除模板
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingTemplate(null);
                        setTemplateForm({ name: '', description: '', permission_ids: [] });
                        clearTemplateSearch();
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="primary"
                      onClick={async () => {
                        if (!templateForm.name.trim()) {
                          toast.error('请输入模板名称');
                          return;
                        }
                        try {
                          if (editingTemplate) {
                            await apiPut(`/api/permission-templates/${editingTemplate.id}`, templateForm);
                          } else {
                            await apiPost('/api/permission-templates', templateForm);
                          }
                          await fetchPermissionTemplates();
                          toast.success(editingTemplate ? '模板已更新' : '模板已创建');
                        } catch (error) {
                          const errorMessage = error.response?.data?.message || '保存失败';
                          toast.error(errorMessage);
                        }
                      }}
                    >
                      保存模板
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AntdModal>

      <AntdModal
        title={"应用权限模板到选中角色"}
        open={isTemplateModalOpen}
        onCancel={() => setIsTemplateModalOpen(false)}
        footer={null}
        width={720}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            已选择 {selectedRoleIds.length} 个角色
          </div>

          <div className="text-sm font-medium text-gray-700">选择模板</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BUILTIN_TEMPLATES.map(tpl => (
              <label
                key={tpl.key}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedTemplateKey === tpl.key
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="permissionTemplate"
                  value={tpl.key}
                  checked={selectedTemplateKey === tpl.key}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {tpl.modules
                      ? tpl.modules.map(m => moduleNames[m] || m).join('、')
                      : (tpl.permissions ? `${tpl.permissions.length} 项权限` : '')}
                  </div>
                </div>
              </label>
            ))}
            {customTemplates.map(tpl => (
              <label
                key={`custom-${tpl.id}`}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedTemplateKey === `custom:${tpl.id}`
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="permissionTemplate"
                  value={`custom:${tpl.id}`}
                  checked={selectedTemplateKey === `custom:${tpl.id}`}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{tpl.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{tpl.description || '自定义模板'}</div>
                </div>
                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                  {Array.isArray(tpl.permission_ids) ? tpl.permission_ids.length : 0} 项
                </span>
              </label>
            ))}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">模板预览</div>
            <div className="max-h-40 overflow-y-auto text-sm text-gray-600">
              {getTemplatePermissionIds(selectedTemplateKey).map(pid => {
                const p = permissions.find(x => x.id === pid);
                return (
                  <div key={pid} className="py-1 border-b border-gray-100 last:border-0">
                    {p?.description || `权限 #${pid}`}
                  </div>
                );
              })}
              {getTemplatePermissionIds(selectedTemplateKey).length === 0 && (
                <div className="text-gray-400 py-2">未选择模板或模板为空</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">应用方式</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="applyMode"
                  value="merge"
                  checked={templateApplyMode === 'merge'}
                  onChange={() => setTemplateApplyMode('merge')}
                />
                合并追加（不删除已有权限）
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="applyMode"
                  value="replace"
                  checked={templateApplyMode === 'replace'}
                  onChange={() => setTemplateApplyMode('replace')}
                />
                覆盖替换（将替换为模板权限）
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              onClick={() => setIsTemplateModalOpen(false)}
              style={{ backgroundColor: '#d1d5db', borderColor: '#d1d5db', color: '#1f2937' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleApplyTemplateToSelectedRoles}
              className="flex items-center justify-center"
            >
              应用模板
            </Button>
          </div>
        </div>
      </AntdModal>

      <AntdModal
        title={"批量设置角色部门权限"}
        open={isBatchDeptOpen}
        onCancel={() => setIsBatchDeptOpen(false)}
        footer={null}
        width={720}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            已选择 {selectedRoleIds.length} 个角色
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              已选择 <span className="font-semibold text-gray-900">{batchSelectedDepartments.length}</span> / {departments.length} 个部门
            </div>
            <Button
              size="small"
              onClick={() => {
                if (batchSelectedDepartments.length === departments.length) {
                  setBatchSelectedDepartments([])
                } else {
                  setBatchSelectedDepartments(departments.map(d => d.id))
                }
              }}
            >
              {batchSelectedDepartments.length === departments.length ? '取消全选' : '全选'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
            {departments.map(dept => (
              <label
                key={dept.id}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  batchSelectedDepartments.includes(dept.id)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
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
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              onClick={() => setIsBatchDeptOpen(false)}
              disabled={isProcessingBatch}
              style={{ backgroundColor: '#d1d5db', borderColor: '#d1d5db', color: '#1f2937' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleBatchDepartmentsSave}
              disabled={isProcessingBatch}
              className="flex items-center justify-center"
            >
              保存
            </Button>
          </div>
        </div>
      </AntdModal>

      <AntdModal
        title={"批量克隆选中角色"}
        open={isCloneModalOpen}
        onCancel={() => setIsCloneModalOpen(false)}
        footer={null}
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            已选择 {selectedRoleIds.length} 个角色
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">前缀</label>
              <Input
                value={clonePrefix}
                onChange={(e) => setClonePrefix(e.target.value)}
                placeholder="如：复制-"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">后缀</label>
              <Input
                value={cloneSuffix}
                onChange={(e) => setCloneSuffix(e.target.value)}
                placeholder="如：-副本"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cloneCopyDepartments}
              onChange={(e) => setCloneCopyDepartments(e.target.checked)}
            />
            克隆时复制部门可见范围
          </label>
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              onClick={() => setIsCloneModalOpen(false)}
              style={{ backgroundColor: '#d1d5db', borderColor: '#d1d5db', color: '#1f2937' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleCloneSelectedRoles}
              className="flex items-center justify-center"
            >
              开始克隆
            </Button>
          </div>
        </div>
      </AntdModal>

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={confirmDialogConfig.onConfirm}
        title={confirmDialogConfig.title}
        message={confirmDialogConfig.message}
      />
    </div>
  );
};

export default RoleManagement;
