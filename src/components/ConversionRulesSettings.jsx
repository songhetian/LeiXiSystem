import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message } from 'antd';
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
          name: '默认转换规则',
          ratio: 0.125, // 8小时 = 1天
          description: '8小时加班 = 1天假期',
          enabled: true
        })
      });
      const data = await response.json();
      if (data.success) {
        message.success('已自动创建默认转换规则：8小时 = 1天假期');
        loadRules();
      }
    } catch (error) {
      logger.error('创建默认规则失败:', error);
    }
  };

  const handleSave = async (values) => {
    if (!values.hours_per_day || values.hours_per_day <= 0) {
      message.error('小时数必须大于0');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingRule
        ? `${getApiBaseUrl()}/conversion-rules/${editingRule.id}`
        : `${getApiBaseUrl()}/conversion-rules`;

      const method = editingRule ? 'PUT' : 'POST';

      // 将小时数转换为比例：ratio = 1 / hours_per_day
      const ratio = 1 / values.hours_per_day;

      const ruleData = {
        name: values.name || '转换规则',
        ratio: ratio,
        description: values.description,
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
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
    },
    {
      title: '转换比例',
      dataIndex: 'ratio',
      key: 'ratio',
      align: 'center',
      render: (ratio) => {
        const hoursPerDay = Math.round(1 / ratio);
        return `1 天 = ${hoursPerDay} 小时`;
      }
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      align: 'center',
      render: (enabled) => (
        <span className={enabled ? 'text-green-600' : 'text-gray-400'}>
          {enabled ? '✓ 启用' : '✗ 禁用'}
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
              setEditingRule(record);
              // 将ratio转换为hours_per_day显示
              const formValues = {
                ...record,
                hours_per_day: Math.round(1 / record.ratio)
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
          <p className="text-gray-600 text-sm mt-1">配置加班时长转换为假期的规则（只能有一个规则启用）</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRule(null);
            form.resetFields();
            form.setFieldsValue({
              name: '转换规则',
              hours_per_day: 8,
              description: '8小时加班 = 1天假期',
              enabled: true
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
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：默认转换规则" />
          </Form.Item>

          <Form.Item
            name="hours_per_day"
            label="转换比例"
            rules={[{ required: true, message: '请输入小时数' }]}
            extra="输入多少小时等于1天假期"
          >
            <InputNumber
              min={1}
              max={24}
              step={0.5}
              precision={1}
              style={{ width: '100%' }}
              placeholder="8"
              addonAfter="小时 = 1天"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="规则说明"
          >
            <Input.TextArea
              rows={3}
              placeholder="例如：8小时加班 = 1天假期"
            />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <div className="text-sm text-gray-500 mt-2">
            <p>💡 提示：</p>
            <ul className="list-disc list-inside">
              <li>启用新规则时，其他规则会自动禁用</li>
              <li>输入小时数，系统自动计算转换比例</li>
              <li>例如：输入 8，表示 8小时加班 = 1天假期</li>
            </ul>
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
      title="转换规则设置"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      {content}
    </Modal>
  );
};

export default ConversionRulesSettings;
