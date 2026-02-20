import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Card, Tag, Space, Modal, message, Input, Checkbox, Select, Form, Typography, Badge, Tooltip } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  LockOutlined, 
  CheckOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { getApiUrl } from '../../utils/apiConfig';
import { apiGet, apiPut, apiPost } from '../../utils/apiClient';
// 导入部门权限模态框组件
import UserDepartmentModal from '../../components/UserDepartmentModal';

const { Option } = Select;

const UserRoleManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

  // 部门权限状态
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [selectedUserForDepartment, setSelectedUserForDepartment] = useState(null);

  // --- 性能优化：搜索防抖 ---
  const [searchText, setSearchText] = useState('');
  const [displaySearchText, setDisplaySearchText] = useState(''); // 用于输入框实时显示
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchText(displaySearchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [displaySearchText]);

  const [searchDepartment, setSearchDepartment] = useState('');
  const [searchRole, setSearchRole] = useState('');

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [isBatchRemoveOpen, setIsBatchRemoveOpen] = useState(false);
  const [batchAssignRoleId, setBatchAssignRoleId] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/users-with-roles');
      if (response.success) {
        // 性能优化：直接使用后端返回的聚合数据，消除 N+1 循环调用
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiGet('/api/roles');
      if (response.success) {
        const rolesData = response.data || [];
        const rolesWithDepartments = await Promise.all(
          rolesData.map(async (role) => {
            try {
              const deptResponse = await apiGet(`/api/roles/${role.id}/departments`);
              if (deptResponse.success) {
                return { ...role, departments: deptResponse.data };
              }
            } catch (e) {}
            return { ...role, departments: [] };
          })
        );
        setRoles(rolesWithDepartments);
      } else if (Array.isArray(response)) {
        const rolesData = response || [];
        const rolesWithDepartments = await Promise.all(
          rolesData.map(async (role) => {
            try {
              const deptResponse = await apiGet(`/api/roles/${role.id}/departments`);
              if (deptResponse.success) {
                return { ...role, departments: deptResponse.data };
              }
            } catch (e) {}
            return { ...role, departments: [] };
          })
        );
        setRoles(rolesWithDepartments);
      }
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiGet('/api/departments');
      if (response.success) {
        setDepartments(response.data || []);
      } else if (Array.isArray(response)) {
        setDepartments(response);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
      message.error('获取部门列表失败');
    }
  };

  const handleManageRoles = (user) => {
    setSelectedUser(user);
    // 性能优化：严格控制单角色逻辑
    const userRoleId = user.roles && user.roles.length > 0 ? user.roles[0].id : null;
    setSelectedRoles(userRoleId ? [userRoleId] : []);
    setModalVisible(true);
  };

  const handleSaveRoles = async () => {
    try {
      // 保持后端原子接口调用，但前端强制仅传一个或零个角色ID
      await apiPut('/api/users/roles/batch', {
        userIds: [selectedUser.id],
        roleIds: selectedRoles
      });

      message.success('角色分配成功');
      setModalVisible(false);
      fetchUsers(); 
    } catch (error) {
      message.error('分配失败: ' + (error.message || '未知错误'));
    }
  };

  const handleRoleChange = (roleId) => {
    // 将单选结果封装为数组，以适配后端批量接口
    setSelectedRoles(roleId ? [roleId] : []);
  };

  // 处理员工部门权限管理
  const handleManageUserDepartments = (user) => {
    setSelectedUserForDepartment(user);
    setIsDepartmentModalOpen(true);
  };

  // 员工部门权限设置成功回调
  const handleUserDepartmentSuccess = () => {
    // 可以在这里添加刷新逻辑或其他操作
    message.success('员工部门权限设置成功');
    fetchUsers(); // 刷新用户列表
  };

  // 过滤用户
  const filteredUsers = useMemo(() => {
    let result = users.filter(user => {
      // 关键词搜索
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesKeyword = (
          (user.real_name && user.real_name.toLowerCase().includes(searchLower)) ||
          (user.username && user.username.toLowerCase().includes(searchLower)) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.phone && user.phone.includes(searchText))
        );
        if (!matchesKeyword) return false;
      }

      // 部门搜索
      if (searchDepartment && user.department_id !== parseInt(searchDepartment)) {
        return false;
      }

      // 角色搜索
      if (searchRole) {
        const hasRole = user.roles && user.roles.some(role => role.id === parseInt(searchRole));
        if (!hasRole) return false;
      }

      return true;
    });

    return result;
  }, [users, searchText, searchDepartment, searchRole]);



  const columns = [
    {
      title: '用户信息',
      key: 'user-info',
      width: 220,
      align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-3 p-1 text-left">
          <Badge dot status={record.status === 'active' ? 'success' : 'default'} offset={[-2, 32]}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-100 overflow-hidden">
              {record.avatar ? (
                <img src={record.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserOutlined className="text-white text-lg" />
              )}
            </div>
          </Badge>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 truncate">{record.real_name}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">
              @{record.username}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: '所属部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 150,
      align: 'center',
      render: (text) => (
        <Tag bordered={false} className="bg-slate-100 text-slate-600 font-bold text-[11px] rounded-lg px-2.5 py-0.5">
          {text || '未分配'}
        </Tag>
      ),
    },
    {
      title: '权限角色',
      key: 'roles',
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {record.roles && record.roles.length > 0 ? (
            record.roles.map(role => (
              <Tag
                key={role.id}
                bordered={false}
                className={`cursor-pointer m-0 font-black text-[10px] px-2 py-0.5 rounded-md transition-all hover:scale-105 ${
                  role.name === '超级管理员' 
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-100' 
                    : 'bg-blue-50 text-blue-600'
                }`}
                onClick={() => handleManageRoles(record)}
              >
                {role.name.toUpperCase()}
              </Tag>
            ))
          ) : (
            <Button
              type="dashed"
              size="small"
              onClick={() => handleManageRoles(record)}
              className="text-[10px] font-bold text-slate-400 border-slate-200 rounded-lg hover:text-blue-500 hover:border-blue-200"
            >
              + 分配角色
            </Button>
          )}
        </div>
      ),
    },
    {
      title: '可查看范围',
      key: 'view-departments',
      align: 'center',
      render: (_, record) => {
        if (record.departments && record.departments.length > 0) {
          const displayDeps = record.departments.slice(0, 2);
          const remainingCount = record.departments.length - 2;

          return (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {displayDeps.map(dept => (
                <span
                  key={dept.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black text-purple-600 bg-purple-50 rounded-md border border-purple-100 uppercase tracking-tighter"
                >
                  <EyeOutlined className="text-[9px]" />
                  {dept.name}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black text-purple-400 bg-white rounded-md border border-slate-100">
                  +{remainingCount}
                </span>
              )}
            </div>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-300 bg-slate-50 rounded-md border border-slate-100 uppercase italic tracking-widest">
              仅本人可见
            </span>
          );
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleManageRoles(record)}
            className="text-blue-600 font-bold"
          >
            分配角色
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleManageUserDepartments(record)}
            className="text-purple-600 font-bold"
          >
            部门权限
          </Button>
        </Space>
      ),
    },
  ];

  const handleBatchAssignRoles = async () => {
    if (selectedUserIds.length === 0 || !batchAssignRoleId) {
      message.error('请选择用户和角色');
      return;
    }
    setIsProcessingBatch(true);
    try {
      // --- 性能优化：改用原子批量接口 ---
      const response = await apiPut('/api/users/roles/batch', {
        userIds: selectedUserIds,
        roleIds: [batchAssignRoleId]
      });

      if (response.success) {
        message.success(response.message || '批量分配成功');
        setIsBatchAssignOpen(false);
        setBatchAssignRoleId(null);
        setSelectedUserIds([]);
        fetchUsers();
      }
    } catch (error) {
      console.error('批量分配失败:', error);
      message.error('批量分配失败: ' + (error.message || '未知错误'));
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchRemoveRoles = async () => {
    if (selectedUserIds.length === 0) {
      message.error('请选择员工');
      return;
    }
    setIsProcessingBatch(true);
    try {
      // --- 性能优化：改用原子批量接口 (传空 roleIds 即为移除) ---
      const response = await apiPut('/api/users/roles/batch', {
        userIds: selectedUserIds,
        roleIds: []
      });

      if (response.success) {
        message.success(response.message || '批量移除成功');
        setIsBatchRemoveOpen(false);
        setSelectedUserIds([]);
        fetchUsers();
      }
    } catch (error) {
      console.error('批量移除失败:', error);
      message.error('批量移除失败: ' + (error.message || '未知错误'));
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">员工角色管理</h2>
            <p className="text-gray-500 text-sm mt-1">管理员工的角色分配和部门权限</p>
          </div>
        </div>

        {/* 统计卡片 (视觉优化) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] p-6 shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-blue-100 text-xs font-black uppercase tracking-widest mb-1">员工总数</div>
              <div className="text-4xl font-black text-white">{filteredUsers.length}</div>
              <div className="text-[10px] text-blue-200 mt-2 font-bold flex items-center gap-1">
                <CheckOutlined className="text-[10px]" /> 在职成员已就绪
              </div>
            </div>
            <UserOutlined className="absolute -right-4 -bottom-4 text-white/10 text-8xl transition-transform group-hover:scale-110" />
          </div>

          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">已选重点</div>
              <div className="text-4xl font-black text-slate-800">{selectedUserIds.length}</div>
              <div className="text-[10px] text-indigo-500 mt-2 font-bold">可执行批量操作</div>
            </div>
            <TeamOutlined className="absolute -right-4 -bottom-4 text-slate-50 text-8xl transition-transform group-hover:scale-110" />
          </div>

          <div className="bg-slate-900 rounded-[24px] p-6 shadow-xl shadow-slate-200 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">权限角色</div>
              <div className="text-4xl font-black text-white">{roles.length}</div>
              <div className="text-[10px] text-emerald-400 mt-2 font-bold uppercase">系统安全防护中</div>
            </div>
            <LockOutlined className="absolute -right-4 -bottom-4 text-white/5 text-8xl transition-transform group-hover:scale-110" />
          </div>
        </div>

        {/* 搜索框 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索姓名、用户名、邮箱或手机号..."
            value={displaySearchText}
            onChange={(e) => setDisplaySearchText(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />
          <Select
            value={searchDepartment}
            onChange={setSearchDepartment}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="">全部部门</Option>
            {departments.map(dept => (
              <Option key={dept.id} value={dept.id}>{dept.name}</Option>
            ))}
          </Select>
        </div>

        {/* 批量操作栏 */}
        {selectedUserIds.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-blue-800">
              已选择 {selectedUserIds.length} 名员工
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                type="primary"
                onClick={() => setIsBatchAssignOpen(true)}
              >
                分配角色
              </Button>
              <Button
                size="small"
                style={{ backgroundColor: '#fca5a5', borderColor: '#fca5a5', color: '#7f1d1d' }}
                onClick={() => setIsBatchRemoveOpen(true)}
                disabled={isProcessingBatch}
              >
                移除角色
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          rowSelection={{ selectedRowKeys: selectedUserIds, onChange: setSelectedUserIds, preserveSelectedRowKeys: true, columnWidth: 40 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          className="overflow-hidden"
          scroll={{ x: 800 }} // 锁定最小滚动宽度，防止无限扩张
        />
      </div>

      {/* 角色分配模态框 */}
      <Modal
        title={`分配角色 - ${selectedUser?.real_name}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveRoles}>
            保存
          </Button>
        ]}
        width={500}
        centered
      >
        <div className="py-4">
          <Select
            placeholder="请选择角色"
            value={selectedRoles.length > 0 ? selectedRoles[0] : null}
            onChange={handleRoleChange}
            style={{ width: '100%' }}
            size="large"
            allowClear
          >
            {roles.map(role => (
              <Option key={role.id} value={role.id}>
                <div className="flex items-center justify-between">
                  <span>{role.name}</span>
                  {role.is_system && <Tag color="red" size="small">系统</Tag>}
                </div>
              </Option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        title="批量分配角色"
        open={isBatchAssignOpen}
        onCancel={() => setIsBatchAssignOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchAssignOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleBatchAssignRoles}
            disabled={isProcessingBatch || !batchAssignRoleId}
          >
            保存
          </Button>
        ]}
        width={500}
        centered
      >
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-3">
            为选中的 <span className="font-semibold text-gray-900">{selectedUserIds.length}</span> 名员工分配角色
          </p>
          <Select
            placeholder="选择角色"
            value={batchAssignRoleId}
            onChange={setBatchAssignRoleId}
            style={{ width: '100%' }}
            size="large"
          >
            {roles.map(role => (
              <Option key={role.id} value={role.id}>{role.name}</Option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        title="批量移除角色"
        open={isBatchRemoveOpen}
        onCancel={() => setIsBatchRemoveOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchRemoveOpen(false)}>
            取消
          </Button>,
          <Button
            key="remove"
            type="primary"
            danger
            onClick={handleBatchRemoveRoles}
            disabled={isProcessingBatch}
          >
            确认移除
          </Button>
        ]}
        width={500}
        centered
      >
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-3">
            确定要从选中的 <span className="font-semibold text-gray-900">{selectedUserIds.length}</span> 名员工移除角色吗？
          </p>
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            此操作不可撤销，请谨慎执行
          </div>
        </div>
      </Modal>

      {/* 部门权限模态框 */}
      <UserDepartmentModal
        isOpen={isDepartmentModalOpen}
        onClose={() => setIsDepartmentModalOpen(false)}
        onSuccess={handleUserDepartmentSuccess}
        user={selectedUserForDepartment}
      />
    </div>
  );
};

export default UserRoleManagement;
