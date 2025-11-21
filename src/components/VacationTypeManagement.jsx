import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';

const VacationTypeManagement = ({ visible, onClose, standalone = false }) => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible || standalone) {
      loadTypes();
    }
  }, [visible, standalone]);

  const loadTypes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        // 按照置顶和排序顺序排列
        const sortedTypes = data.data.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) {
            return b.is_pinned - a.is_pinned; // 置顶的在前
          }
          return (a.sort_order || 999) - (b.sort_order || 999);
        });
        setTypes(sortedTypes);
      } else {
        message.error(data.message || '加载假期类型失败');
      }
    } catch (error) {
      message.error('加载假期类型失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingType
        ? `${getApiBaseUrl()}/vacation-types/${editingType.id}`
        : `${getApiBaseUrl()}/vacation-types`;

      const method = editingType ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await response.json();
      if (data.success) {
        message.success(editingType ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadTypes();
      } else {
        message.error(data.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个假期类型吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${getApiBaseUrl()}/vacation-types/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            message.success('删除成功');
            loadTypes();
          } else {
            message.error(data.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleTogglePin = async (id, currentPinned) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation-types/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_pinned: !currentPinned })
      });

      const data = await response.json();
      if (data.success) {
        message.success(currentPinned ? '已取消置顶' : '已置顶');
        loadTypes();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '置顶',
      key: 'pin',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          icon={record.is_pinned ? <PushpinFilled className="text-blue-500" /> : <PushpinOutlined />}
          onClick={() => handleTogglePin(record.id, record.is_pinned)}
        />
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '计入总额',
      dataIndex: 'included_in_total',
      key: 'included_in_total',
      render: (included) => (
        <span className={included ? 'text-blue-600' : 'text-gray-400'}>
          {included ? '是' : '否'}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => (
        <span className={enabled ? 'text-green-600' : 'text-gray-400'}>
          {enabled ? '启用' : '禁用'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <div className="space-x-2">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingType(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </div>
      )
    }
  ];

  const content = (
    <>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">假期类型管理</h2>
          <p className="text-gray-600 text-sm mt-1">管理系统中的假期类型配置</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingType(null);
            form.resetFields();
            form.setFieldsValue({ enabled: true, included_in_total: true, base_days: 0 });
            setModalVisible(true);
          }}
        >
          新增类型
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={types}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingType ? '编辑类型' : '新增类型'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="code"
            label="类型代码 (唯一标识)"
            rules={[{ required: true }]}
          >
            <Input disabled={!!editingType} placeholder="例如: annual_leave" />
          </Form.Item>

          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true }]}
          >
            <Input placeholder="例如: 年假" />
          </Form.Item>

          <Form.Item
            name="base_days"
            label="基准天数 (默认额度)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} precision={1} className="w-full" addonAfter="天" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="flex space-x-8">
            <Form.Item
              name="included_in_total"
              label="计入总假期额度"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>

            <Form.Item
              name="enabled"
              label="状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );

  if (standalone) {
    return <div className="p-6">{content}</div>;
  }

  return (
    <Modal
      title="假期类型管理"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      {content}
    </Modal>
  );
};

export default VacationTypeManagement;
