import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tabs, Button, Modal, Form, Input,
  Select, Tag, Space, message, Tooltip, Checkbox,
  Row, Col, DatePicker
} from 'antd';
import {
  UserOutlined, SafetyCertificateOutlined, HistoryOutlined,
  EditOutlined, PlusOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const VacationPermissions = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);

  // Data States
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logPagination, setLogPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Modal States
  const [userRoleModalVisible, setUserRoleModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'users') {
        const [usersRes, rolesRes] = await Promise.all([
          fetch(`${getApiBaseUrl()}/users/roles`, { headers }),
          fetch(`${getApiBaseUrl()}/roles`, { headers })
        ]);
        const usersData = await usersRes.json();
        const rolesData = await rolesRes.json();
        if (usersData.success) setUsers(usersData.data);
        if (rolesData.success) setRoles(rolesData.data);
      }
      else if (activeTab === 'roles') {
        const [rolesRes, permsRes] = await Promise.all([
          fetch(`${getApiBaseUrl()}/roles`, { headers }),
          fetch(`${getApiBaseUrl()}/permissions`, { headers })
        ]);
        const rolesData = await rolesRes.json();
        const permsData = await permsRes.json();
        if (rolesData.success) setRoles(rolesData.data);
        if (permsData.success) setPermissions(permsData.data);
      }
      else if (activeTab === 'logs') {
        loadLogs();
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/permissions/audit-logs?page=${page}&limit=${logPagination.pageSize}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setLogPagination({ ...logPagination, current: page, total: data.pagination.total });
      }
    } catch (error) {
      message.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  // --- User Role Management ---
  const handleEditUserRoles = (user) => {
    setSelectedUser(user);
    form.setFieldsValue({
      roleIds: user.roles.map(r => r.id)
    });
    setUserRoleModalVisible(true);
  };

  const submitUserRoles = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const res = await fetch(`${getApiBaseUrl()}/users/${selectedUser.id}/roles`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roleIds: values.roleIds })
      });

      const data = await res.json();
      if (data.success) {
        message.success('用户角色更新成功');
        setUserRoleModalVisible(false);
        loadData();
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- Role Management ---
  const handleEditRole = (role) => {
    setSelectedRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
      permissionIds: role.permissions.map(p => p.id)
    });
    setRoleModalVisible(true);
  };

  const handleCreateRole = () => {
    setSelectedRole(null);
    form.resetFields();
    setRoleModalVisible(true);
  };

  const submitRole = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const url = selectedRole
        ? `${getApiBaseUrl()}/roles/${selectedRole.id}`
        : `${getApiBaseUrl()}/roles`;

      const method = selectedRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await res.json();
      if (data.success) {
        message.success(selectedRole ? '角色更新成功' : '角色创建成功');
        setRoleModalVisible(false);
        loadData();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- Columns ---
  const userColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'real_name', key: 'real_name' },
    { title: '部门', dataIndex: 'department_name', key: 'department_name' },
    {
      title: '角色',
      key: 'roles',
      render: (_, record) => (
        <Space wrap>
          {record.roles.map(role => (
            <Tag color="blue" key={role.id}>{role.name}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEditUserRoles(record)}>
          分配角色
        </Button>
      )
    }
  ];

  const roleColumns = [
    { title: '角色名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '权限数',
      key: 'permCount',
      width: 100,
      render: (_, record) => <Tag>{record.permissions?.length || 0}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>
          编辑
        </Button>
      )
    }
  ];

  const logColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: t => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 100 },
    { title: '被操作人', dataIndex: 'employee_name', key: 'employee_name', width: 100 },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type', width: 150,
      render: type => {
        const map = {
          'leave_apply': '请假申请',
          'leave_approve': '请假审批',
          'leave_reject': '请假驳回',
          'balance_adjust': '余额调整',
          'overtime_convert': '加班转换'
        };
        return <Tag>{map[type] || type}</Tag>;
      }
    },
    { title: '详情', dataIndex: 'operation_detail', key: 'operation_detail',
      render: (detail) => (
        <Tooltip title={JSON.stringify(detail, null, 2)}>
          <span className="truncate block max-w-xs cursor-pointer text-gray-500">
            {JSON.stringify(detail)}
          </span>
        </Tooltip>
      )
    }
  ];

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">权限与安全管理</h1>
        <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
      </div>

      <Card className="shadow-sm">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={<span><UserOutlined />用户角色管理</span>} key="users">
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              loading={loading}
            />
          </TabPane>

          <TabPane tab={<span><SafetyCertificateOutlined />角色权限配置</span>} key="roles">
            <div className="mb-4">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRole}>
                新建角色
              </Button>
            </div>
            <Table
              columns={roleColumns}
              dataSource={roles}
              rowKey="id"
              loading={loading}
            />
          </TabPane>

          <TabPane tab={<span><HistoryOutlined />操作审计日志</span>} key="logs">
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              loading={loading}
              pagination={{
                ...logPagination,
                onChange: (page) => loadLogs(page)
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* User Role Modal */}
      <Modal
        title={`分配角色 - ${selectedUser?.real_name}`}
        open={userRoleModalVisible}
        onCancel={() => setUserRoleModalVisible(false)}
        onOk={submitUserRoles}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="roleIds" label="选择角色">
            <Select mode="multiple" placeholder="请选择角色">
              {roles.map(role => (
                <Option key={role.id} value={role.id}>{role.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Role Edit Modal */}
      <Modal
        title={selectedRole ? '编辑角色' : '新建角色'}
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={submitRole}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>

          <Form.Item name="permissionIds" label="权限配置">
            <Checkbox.Group style={{ width: '100%' }}>
              {Object.keys(groupedPermissions).map(module => (
                <Card size="small" title={module} key={module} className="mb-4">
                  <Row>
                    {groupedPermissions[module].map(perm => (
                      <Col span={8} key={perm.id}>
                        <Checkbox value={perm.id}>{perm.name}</Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Card>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VacationPermissions;
