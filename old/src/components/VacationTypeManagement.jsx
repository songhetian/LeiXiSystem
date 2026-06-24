import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';

const COMMON_VACATION_TYPES = [
  { code: 'annual', name: '年假', base_days: 5, included_in_total: true, description: '法定年休假' },
  { code: 'sick', name: '病假', base_days: 12, included_in_total: true, description: '因病请假' },
  { code: 'personal', name: '事假', base_days: 0, included_in_total: false, description: '因私事请假' },
  { code: 'marriage', name: '婚假', base_days: 3, included_in_total: false, description: '结婚请假' },
  { code: 'maternity', name: '产假', base_days: 98, included_in_total: false, description: '生育请假' },
  { code: 'paternity', name: '陪产假', base_days: 15, included_in_total: false, description: '陪护妻子生育' },
  { code: 'bereavement', name: '丧假', base_days: 3, included_in_total: false, description: '直系亲属去世' },
  { code: 'compensatory', name: '调休', base_days: 0, included_in_total: true, description: '加班调休' },
];

const VacationTypeManagement = ({ visible, onClose, standalone = false }) => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [quickAddModalVisible, setQuickAddModalVisible] = useState(false);
  const [selectedQuickTypes, setSelectedQuickTypes] = useState(COMMON_VACATION_TYPES.map(t => t.code));
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();

  // 中文名称到英文的映射
  const chineseToEnglishMap = {
    '年假': 'annual',
    '病假': 'sick',
    '事假': 'personal',
    '婚假': 'marriage',
    '产假': 'maternity',
    '陪产假': 'paternity',
    '丧假': 'bereavement',
    '调休': 'compensatory'
  };

  // 生成唯一的假期类型编码
  const generateVacationCode = (name, existingCodes = []) => {
    if (!name) return '';

    // 1. 检查是否有直接映射
    if (chineseToEnglishMap[name]) {
      let code = chineseToEnglishMap[name];
      // 检查唯一性
      let counter = 1;
      let uniqueCode = code;
      while (existingCodes.includes(uniqueCode)) {
        uniqueCode = `${code}_${counter}`;
        counter++;
      }
      return uniqueCode;
    }

    // 2. 处理其他名称
    let code = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // 移除特殊字符
      .replace(/\s+/g, '_') // 替换空格为下划线
      .replace(/^_|_$/g, ''); // 移除首尾下划线

    // 3. 确保唯一性
    let counter = 1;
    let uniqueCode = code;
    while (existingCodes.includes(uniqueCode)) {
      uniqueCode = `${code}_${counter}`;
      counter++;
    }

    return uniqueCode;
  };

  // 处理名称变化，自动生成编码
  const handleNameChange = (e) => {
    const name = e.target.value;
    if (!editingType && name) {
      const existingCodes = types.map(t => t.code);
      const generatedCode = generateVacationCode(name, existingCodes);
      form.setFieldsValue({ code: generatedCode });
    }
  };

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
        // 后端已经按照 is_pinned DESC, sort_order ASC 排序
        setTypes(data.data);
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
      content: '确定要删除这个假期类型吗？此操作不可逆。',
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
            setSelectedRowKeys(prev => prev.filter(key => key !== id));
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

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个假期类型吗？此操作不可逆。`,
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${getApiBaseUrl()}/vacation-types/batch-delete`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: selectedRowKeys })
          });
          const data = await response.json();
          if (data.success) {
            message.success('批量删除成功');
            setSelectedRowKeys([]);
            loadTypes();
          } else {
            message.error(data.message || '批量删除失败');
          }
        } catch (error) {
          message.error('批量删除失败');
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

  const handleQuickAdd = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const existingCodes = types.map(t => t.code);
      const typesToAdd = COMMON_VACATION_TYPES.filter(
        t => selectedQuickTypes.includes(t.code) && !existingCodes.includes(t.code)
      );

      if (typesToAdd.length === 0) {
        message.info('选中的类型已全部存在');
        setQuickAddModalVisible(false);
        setLoading(false);
        return;
      }

      let successCount = 0;
      for (const type of typesToAdd) {
        try {
          const response = await fetch(`${getApiBaseUrl()}/vacation-types`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(type)
          });
          const data = await response.json();
          if (data.success) successCount++;
        } catch (e) {
          logger.error(`Failed to add ${type.name}`, e);
        }
      }

      message.success(`成功添加 ${successCount} 个假期类型`);
      setQuickAddModalVisible(false);
      loadTypes();
    } catch (error) {
      message.error('批量添加失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '置顶',
      key: 'pin',
      width: 80,
      align: 'center',
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
      align: 'center',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
    },
    {
      title: '计入总额',
      dataIndex: 'included_in_total',
      key: 'included_in_total',
      align: 'center',
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
      align: 'center',
      render: (enabled) => (
        <span className={enabled ? 'text-green-600' : 'text-gray-400'}>
          {enabled ? '启用' : '禁用'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
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
        <div className="space-x-2">
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              批量删除 ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            icon={<PlusOutlined />}
            onClick={() => setQuickAddModalVisible(true)}
          >
            快捷添加
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingType(null);
              form.resetFields();
              form.setFieldsValue({ enabled: true, included_in_total: true, base_days: 0, sort_order: (types.length > 0 ? Math.max(...types.map(t => t.sort_order || 0)) + 1 : 1) });
              setModalVisible(true);
            }}
          >
            新增类型
          </Button>
        </div>
      </div>

      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={columns}
        dataSource={types}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          style: { marginTop: 16 }
        }}
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
            rules={[{ required: true, message: '请输入类型代码' }]}
          >
            <Input
              disabled={!!editingType}
              placeholder="例如: annual_leave"
              readOnly={!!editingType}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true, message: '请输入类型名称' }]}
          >
            <Input
              placeholder="例如: 年假"
              onChange={handleNameChange}
            />
          </Form.Item>

{/* 隐藏基准天数，因为用户反馈没有使用 */}
{/*
<Form.Item
  name="base_days"
  label="基准天数 (默认额度)"
  rules={[{ required: true }]}
>
  <Space.Compact style={{ width: '100%' }}>
    <InputNumber min={0} precision={1} className="w-full" />
    <Input defaultValue="天" readOnly={true} disabled={true} />
  </Space.Compact>
</Form.Item>
*/}

          <Form.Item
            description="备注，用于区分不同类型的假期"
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="排序号"
            tooltip="数字越小越靠前"
          >
            <InputNumber min={0} className="w-full" placeholder="例如: 1" />
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

      <Modal
        title="快捷添加常用假期"
        open={quickAddModalVisible}
        onCancel={() => setQuickAddModalVisible(false)}
        onOk={handleQuickAdd}
        confirmLoading={loading}
      >
        <div className="py-4">
          <p className="mb-4 text-gray-600">请选择要添加的假期类型（已存在的将自动跳过）：</p>
          <div className="grid grid-cols-2 gap-4">
            {COMMON_VACATION_TYPES.map(type => (
              <label key={type.code} className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedQuickTypes.includes(type.code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedQuickTypes([...selectedQuickTypes, type.code]);
                    } else {
                      setSelectedQuickTypes(selectedQuickTypes.filter(c => c !== type.code));
                    }
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium">{type.name}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
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
