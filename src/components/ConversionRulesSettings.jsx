import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, message, Card, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';

const ConversionRulesSettings = ({ visible, onClose, standalone = false }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible || standalone) {
      loadRules();
    }
  }, [visible, standalone]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/conversion-rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        // 如果没有规则，自动创建默认规�?
        if (data.data.length === 0) {
          await createDefaultRule();
        } else {
          setRules(data.data);
        }
      } else {
        message.error(data.message || '加载规则失败');
      }
    } catch (error) {
      message.error('加载规则失败');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultRule = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/conversion-rules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'overtime转overtime_leave',
          source_type: 'overtime',
          target_type: 'overtime_leave',
          ratio: 8,
          enabled: true
        })
      });
      const data = await response.json();
      if (data.success) {
        message.success('已自动创建默认转换规则：8小时 = 1天加班假');
        loadRules();
      }
    } catch (error) {
      console.error('创建默认规则失败:', error);
    }
  };

  const handleSave = async (values) => {
    // 表单验证
    if (!values.source_type || !values.target_type) {
      message.error('请选择来源类型和目标类型');
      return;
    }

    if (!values.conversion_rate || values.conversion_rate <= 0) {
      message.error('转换比例必须大于0');
      return;
    }

    if (values.conversion_rate > 24) {
      message.error('转换比例不能超过24小时');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingRule
        ? `${getApiBaseUrl()}/conversion-rules/${editingRule.id}`
        : `${getApiBaseUrl()}/conversion-rules`;

      const method = editingRule ? 'PUT' : 'POST';

      // 转换字段名，不包含name字段
      const ruleData = {
        source_type: values.source_type,
        target_type: values.target_type,
        ratio: values.conversion_rate,
        enabled: values.enabled
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleData)
      });

      const data = await response.json();
      if (data.success) {
        message.success(editingRule ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadRules();
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
      content: '确定要删除这条规则吗？',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${getApiBaseUrl()}/conversion-rules/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            message.success('删除成功');
            loadRules();
          } else {
            message.error(data.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '来源类型',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (text) => text === 'overtime' ? '加班时长' : text
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      render: (text) => {
        const typeMap = {
          annual_leave: '年假',
          overtime_leave: '加班假',
          compensatory: '调休假'
        };
        return typeMap[text] || text;
      }
    },
    {
      title: '转换比例',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      render: (rate) => `${rate} 小时 = 1 天`
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
              setEditingRule(record);
              // Map server field 'conversion_rate' to form field 'conversion_rate'
              const formValues = {
                ...record,
                conversion_rate: record.conversion_rate
              };
              form.setFieldsValue(formValues);
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
          <h2 className="text-xl font-bold text-gray-800">加班转换规则配置</h2>
          <p className="text-gray-600 text-sm mt-1">配置加班时长转换为假期的规则</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRule(null);
            form.resetFields();
            form.setFieldsValue({ 
              enabled: true, 
              source_type: 'overtime', 
              target_type: 'overtime_leave',
              conversion_rate: 8
            });
            setModalVisible(true);
          }}
        >
          新增规则
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
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
            name="source_type"
            label="来源类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="overtime">加班时长</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="target_type"
            label="目标类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="annual_leave">年假</Select.Option>
              <Select.Option value="overtime_leave">加班假</Select.Option>
              <Select.Option value="compensatory">调休假</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="conversion_rate"
            label="转换比例 (多少小时 = 1天)"
            rules={[{ required: true }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber min={1} max={24} precision={1} className="w-full" defaultValue={8} />
              <Input defaultValue="小时" readOnly={true} disabled={true} />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="enabled"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  if (standalone) {
    return <div className="p-6">{content}</div>;
  }

  return (
    <Modal
      title="转换规则设置"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      {content}
    </Modal>
  );
};

export default ConversionRulesSettings;