import React from 'react';
import { Card, Form, Switch, Button, message, Divider, Space } from 'antd';
import { SaveOutlined, SyncOutlined } from '@ant-design/icons';

const NotificationSettings = () => {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    console.log('保存设置:', values);
    message.success('设置保存成功！');
  };

  const onReset = () => {
    form.resetFields();
    message.info('设置已重置');
  };

  const notificationTypes = [
    { name: 'system', label: '系统通知' },
    { name: 'attendance', label: '考勤相关' },
    { name: 'leave', label: '请假相关' },
    { name: 'overtime', label: '加班相关' },
    { name: 'assessment', label: '考核相关' },
    { name: 'quality', label: '质检相关' },
    { name: 'approval', label: '审批相关' },
  ];

  const channels = [
    { name: 'email', label: '邮件通知' },
    { name: 'sms', label: '短信通知' },
    { name: 'inApp', label: '站内通知' },
    { name: 'push', label: '推送通知' },
  ];

  return (
    <div className="p-6">
      <Card
        title="通知设置"
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={onReset}>重置</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>保存</Button>
          </Space>
        }
      >
        <Form
          form={form}
          name="notification_settings"
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            system: true,
            attendance: true,
            leave: true,
            overtime: true,
            assessment: true,
            quality: true,
            approval: true,
            email: true,
            sms: false,
            inApp: true,
            push: true,
          }}
        >
          <Divider orientation="left">通知类型设置</Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notificationTypes.map(type => (
              <Form.Item
                key={type.name}
                label={type.label}
                name={type.name}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            ))}
          </div>

          <Divider orientation="left">通知渠道设置</Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map(channel => (
              <Form.Item
                key={channel.name}
                label={channel.label}
                name={channel.name}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            ))}
          </div>

          <Divider orientation="left">其他设置</Divider>

          <Form.Item
            label="免打扰时段"
            name="doNotDisturb"
            valuePropName="checked"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            label="通知声音"
            name="sound"
            valuePropName="checked"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item className="mt-6">
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存设置
            </Button>
            <Button className="ml-4" icon={<SyncOutlined />} onClick={onReset}>
              重置设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default NotificationSettings;
