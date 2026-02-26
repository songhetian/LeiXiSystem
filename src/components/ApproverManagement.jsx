/**
 * 审批人管理页面
 *
 * 功能：
 * - 配置特殊审批人（如区域经理、财务总监等）
 * - 支持自定义审批人类型名称
 * - 设置审批人代理
 * - 配置审批范围（部门、金额）
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlusOutlined,
  UserOutlined,
  SearchOutlined,
  CloseOutlined
} from '@ant-design/icons';
import {
  Button,
  Input,
  Select,
  Modal,
  Table,
  Tag,
  Space,
  AutoComplete,
  DatePicker,
  Form,
  Checkbox
} from 'antd';
import { toast } from 'sonner';
import api from '../api';
import dayjs from 'dayjs';
import { matchPinyin, filterOptionWithPinyin } from '../utils/searchUtils';

const { Option } = Select;

const ApproverManagement = () => {
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [editingApprover, setEditingApprover] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchText, setSearchText] = useState('');

  // 提取所有已存在的审批人类型，用于自动完成
  const existingTypes = useMemo(() =>
    [...new Set(approvers.map(a => a.approver_type))].map(type => ({ value: type })),
    [approvers]
  );

  const [form] = Form.useForm();
  const [delegateForm] = Form.useForm();

  useEffect(() => {
    fetchApprovers();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchApprovers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/approvers');
      if (response.data.success) {
        setApprovers(response.data.data);
      }
    } catch (error) {
      console.error('获取审批人列表失败:', error);
      toast.error('获取失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/approvers/available-users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments', { params: { forManagement: true } });
      if (Array.isArray(response.data)) {
        setDepartments(response.data);
      } else if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const openModal = useCallback((approver = null) => {
    setEditingApprover(approver);
    if (approver) {
      form.setFieldsValue({
        ...approver,
        department_scope: approver.department_scope || [],
        amount_limit: approver.amount_limit,
        user_id: approver.user_id,
        approver_type: approver.approver_type,
        is_active: approver.is_active
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        department_scope: [],
        is_active: true
      });
    }
    setShowModal(true);
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { user_id, ...otherValues } = values;

      const payloadBase = {
        ...otherValues,
        department_scope: values.department_scope?.length > 0
          ? values.department_scope
          : null,
        amount_limit: values.amount_limit || null
      };

      if (editingApprover?.id) {
        const response = await api.put(`/approvers/${editingApprover.id}`, {
          ...payloadBase,
          user_id: Array.isArray(user_id) ? user_id[0] : user_id
        });
        if (response.data.success) {
          toast.success('更新成功');
          setShowModal(false);
          fetchApprovers();
        } else {
          toast.error(response.data.message || '操作失败');
        }
      } else {
        const userIds = Array.isArray(user_id) ? user_id : [user_id];
        let successCount = 0;
        let failCount = 0;

        for (const uid of userIds) {
          try {
            const response = await api.post('/approvers', {
              ...payloadBase,
              user_id: uid
            });
            if (response.data.success) successCount++;
            else failCount++;
          } catch (e) {
            failCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`成功添加 ${successCount} 位审批人${failCount > 0 ? `，${failCount} 位失败` : ''}`);
          setShowModal(false);
          fetchApprovers();
        } else {
          toast.error('添加失败，请检查是否已存在');
        }
      }
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = useCallback((id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此审批人配置吗？',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await api.delete(`/approvers/${id}`);
          if (response.data.success) {
            toast.success('删除成功');
            fetchApprovers();
          } else {
            toast.error(response.data.message || '删除失败');
          }
        } catch (error) {
          console.error('删除失败:', error);
          toast.error('删除失败');
        }
      }
    });
  }, []);

  const handleSaveDelegate = async () => {
    try {
      const values = await delegateForm.validateFields();

      const payload = {
        delegate_user_id: values.delegate_user_id || null,
        delegate_start_date: values.date_range ? values.date_range[0].format('YYYY-MM-DD') : null,
        delegate_end_date: values.date_range ? values.date_range[1].format('YYYY-MM-DD') : null
      };

      const response = await api.post(`/approvers/${editingApprover.id}/delegate`, payload);

      if (response.data.success) {
        toast.success(response.data.message);
        setShowDelegateModal(false);
        fetchApprovers();
      } else {
        toast.error(response.data.message || '操作失败');
      }
    } catch (error) {
      console.error('设置代理失败:', error);
    }
  };

  // 数据分组逻辑：按审批人类型分组
  const groupedApprovers = useMemo(() => {
    const searchLower = searchText.toLowerCase();
    const groups = {};

    approvers.forEach(a => {
      if (!groups[a.approver_type]) {
        groups[a.approver_type] = {
          type: a.approver_type,
          users: [],
          id: a.approver_type
        };
      }
      groups[a.approver_type].users.push(a);
    });

    if (!searchText) return Object.values(groups);

    const result = Object.values(groups).filter(g =>
      matchPinyin(g.type, searchText) ||
      g.users.some(u => matchPinyin(u.user_name, searchText))
    );
    return result;
  }, [approvers, searchText]);

  const columns = useMemo(() => [
    {
      title: '审批人类型',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (text) => (
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: '#e6f4ff',
          color: '#1677ff',
          borderRadius: 4,
          fontWeight: 500
        }}>
          {text}
        </span>
      )
    },
    {
      title: '包含用户',
      key: 'users',
      align: 'center',
      render: (_, record) => {
        // 用户背景色调色板（带透明度）
        const userColors = [
          'rgba(99, 102, 241, 0.15)',   // 蓝紫
          'rgba(16, 185, 129, 0.15)',   // 绿色
          'rgba(245, 158, 11, 0.15)',   // 橙色
          'rgba(239, 68, 68, 0.15)',    // 红色
          'rgba(139, 92, 246, 0.15)',   // 紫色
          'rgba(6, 182, 212, 0.15)',    // 青色
          'rgba(236, 72, 153, 0.15)',   // 粉色
          'rgba(34, 197, 94, 0.15)',    // 浅绿
        ];
        const borderColors = [
          'rgba(99, 102, 241, 0.4)',
          'rgba(16, 185, 129, 0.4)',
          'rgba(245, 158, 11, 0.4)',
          'rgba(239, 68, 68, 0.4)',
          'rgba(139, 92, 246, 0.4)',
          'rgba(6, 182, 212, 0.4)',
          'rgba(236, 72, 153, 0.4)',
          'rgba(34, 197, 94, 0.4)',
        ];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {record.users.map((u, index) => (
              <span
                key={u.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: userColors[index % userColors.length],
                  border: `1px solid ${borderColors[index % borderColors.length]}`,
                  borderRadius: 6,
                  fontSize: 14
                }}
              >
                <UserOutlined style={{ color: '#555', fontSize: 15 }} />
                <span style={{ fontWeight: 500 }}>{u.user_name}</span>
                {u.amount_limit && (
                  <span style={{ color: '#666', fontSize: 12 }}>
                    ≤¥{parseInt(u.amount_limit)}
                  </span>
                )}
                <CloseOutlined
                  style={{
                    fontSize: 11,
                    color: '#888',
                    cursor: 'pointer',
                    marginLeft: 4
                  }}
                  onClick={() => handleDelete(u.id)}
                />
              </span>
            ))}
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            const firstUser = record.users[0];
            setEditingApprover(null);
            form.resetFields();
            form.setFieldsValue({
              approver_type: record.type,
              is_active: true,
              amount_limit: firstUser?.amount_limit,
              department_scope: firstUser?.department_scope || []
            });
            setShowModal(true);
          }}
        >
          添加
        </Button>
      )
    }
  ], [form, handleDelete]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* 页面头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>特殊审批人配置</h1>
          <p style={{ color: '#888', margin: '4px 0 0 0', fontSize: 13 }}>
            配置各级审批角色，同一类型的审批人将共同收到通知
          </p>
        </div>
        <Space>
          <Input
            placeholder="搜索..."
            prefix={<SearchOutlined />}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            创建审批组
          </Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={groupedApprovers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="middle"
      />

      {/* 编辑/添加弹窗 */}
      <Modal
        title={editingApprover?.id ? '编辑审批人' : '添加审批组用户'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        destroyOnHidden
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="approver_type"
            label="审批组名称"
            rules={[{ required: true, message: '请输入或选择类型名称' }]}
          >
            <AutoComplete
              options={existingTypes}
              placeholder="如：区域经理、财务总监"
              filterOption={(inputValue, option) =>
                option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
            />
          </Form.Item>

          <Form.Item
            name="user_id"
            label="选择用户"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              mode={editingApprover?.id ? "default" : "multiple"}
              showSearch
              placeholder="可搜索并选择多个用户"
              filterOption={filterOptionWithPinyin}
              options={users.map(user => ({
                value: user.id,
                label: `${user.real_name} (${user.username})`
              }))}
              maxTagCount="responsive"
            />
          </Form.Item>

          <Form.Item name="amount_limit" label="审批金额上限 (元)">
            <Input type="number" placeholder="留空表示不限制" />
          </Form.Item>

          <Form.Item name="department_scope" label="负责部门范围">
            <Select
              mode="multiple"
              placeholder="留空表示负责所有部门"
              allowClear
              optionFilterProp="label"
              options={departments.map(dept => ({
                value: dept.id,
                label: dept.name
              }))}
              maxTagCount="responsive"
            />
          </Form.Item>

          <Form.Item name="is_active" valuePropName="checked">
            <Checkbox>立即启用</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* 代理弹窗 */}
      <Modal
        title="设置审批代理"
        open={showDelegateModal}
        onCancel={() => setShowDelegateModal(false)}
        onOk={handleSaveDelegate}
        destroyOnHidden
        width={450}
      >
        <Form form={delegateForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{
            marginBottom: 16,
            padding: 12,
            background: '#fafafa',
            borderRadius: 4
          }}>
            当前审批人: <strong>{editingApprover?.user_name}</strong>
          </div>

          <Form.Item name="delegate_user_id" label="代理人">
            <Select
              showSearch
              allowClear
              placeholder="不设代理"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={users
                .filter(u => u.id !== editingApprover?.user_id)
                .map(user => ({
                  value: user.id,
                  label: `${user.real_name} (${user.username})`
                }))
              }
            />
          </Form.Item>

          <Form.Item
            name="date_range"
            label="代理时间范围"
            rules={[{
              validator: (_, value) => {
                if (delegateForm.getFieldValue('delegate_user_id') && !value) {
                  return Promise.reject('设置代理人时必须选择时间');
                }
                return Promise.resolve();
              }
            }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApproverManagement;
