import React from 'react';
import { Card, Form, Input, Select, Button, Upload, message } from 'antd';
import { UploadOutlined, SendOutlined } from '@ant-design/icons';

const NotificationSender = () => {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    console.log('发送通知:', values);
    message.success('通知发送成功！');
    form.resetFields();
  };

  const onFinishFailed = (errorInfo) => {
    console.log('发送失败:', errorInfo);
    message.error('通知发送失败，请检查表单内容！');
  };

  const receivers = [
    { value: 'all', label: '所有用户' },
    { value: 'department', label: '按部门' },
    { value: 'position', label: '按职位' },
    { value: 'individual', label: '指定用户' },
  ];

  const departments = [
    { value: 'tech', label: '技术部' },
    { value: 'hr', label: '人事部' },
    { value: 'finance', label: '财务部' },
    { value: 'marketing', label: '市场部' },
    { value: 'support', label: '客服部' },
  ];

  return (
    <div className="p-6">
      <Card title="发送通知">
        <Form
          form={form}
          name="notification_form"
          layout="vertical"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
        >
          <Form.Item
            label="通知标题"
            name="title"
            rules={[{ required: true, message: '请输入通知标题!' }]}
          >
            <Input placeholder="请输入通知标题" />
          </Form.Item>

          <Form.Item
            label="接收对象"
            name="receivers"
            rules={[{ required: true, message: '请选择接收对象!' }]}
          >
            <Select
              placeholder="请选择接收对象"
              options={receivers}
            />
          </Form.Item>

          <Form.Item
            label="部门选择"
            name="departments"
            rules={[{ required: true, message: '请选择部门!' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择部门"
              options={departments}
            />
          </Form.Item>

          <Form.Item
            label="通知内容"
            name="content"
            rules={[{ required: true, message: '请输入通知内容!' }]}
          >
            <Input.TextArea rows={6} placeholder="请输入通知内容" />
          </Form.Item>

          <Form.Item
            label="附件"
            name="attachments"
          >
            <Upload>
              <Button icon={<UploadOutlined />}>上传附件</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
              发送通知
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default NotificationSender;
