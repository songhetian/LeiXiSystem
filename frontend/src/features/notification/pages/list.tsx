'use client';

import { useState, useEffect } from 'react';
import {
  Message,
  Card,
  Tag,
  Button,
  Space,
  Badge,
  List,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  Radio,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notificationApi, Notification } from '@/services/notification';
import { systemApi, SysDepartment, SysUser } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';

const typeMap: Record<string, { label: string; color: string }> = {
  approval: { label: '审批', color: 'arcoblue' },
  system: { label: '系统', color: 'gray' },
  attendance: { label: '考勤', color: 'green' },
  broadcast: { label: '公告', color: 'orangered' },
};

const typeOptions = [
  { label: '审批', value: 'approval' },
  { label: '系统', value: 'system' },
  { label: '考勤', value: 'attendance' },
  { label: '公告', value: 'broadcast' },
  { label: '通知', value: 'notice' },
];

export default function NotificationsPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  // 发送通知弹窗状态
  const [sendVisible, setSendVisible] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [departments, setDepartments] = useState<SysDepartment[]>([]);
  const [users, setUsers] = useState<SysUser[]>([]);
  const [sendForm] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.list({ page: 1, pageSize: 50 }),
        notificationApi.unreadCount(),
      ]);
      if (listRes.code === 0 && listRes.data) setData(listRes.data.list);
      if (countRes.code === 0 && countRes.data) setUnread(countRes.data.count);
    } catch (e) {
      Message.error('获取通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openSend = async () => {
    setSendVisible(true);
    sendForm.resetFields();
    sendForm.setFieldValue('targetType', 'all');
    sendForm.setFieldValue('type', 'notice');
    try {
      const [deptRes, userRes] = await Promise.all([
        systemApi.listDepartments(),
        systemApi.listUsers({ page: 1, pageSize: 200 }),
      ]);
      if (deptRes.code === 0 && deptRes.data) setDepartments(deptRes.data);
      if (userRes.code === 0 && userRes.data) setUsers(userRes.data.list);
    } catch (e) {
      // 目标数据加载失败不阻塞表单填写
    }
  };

  const handleSend = async () => {
    try {
      const values = await sendForm.validate();
      setSendLoading(true);
      const params: any = {
        title: values.title,
        content: values.content,
        type: values.type || 'notice',
        targetType: values.targetType,
      };
      if (values.targetType === 'department') params.departmentIds = values.departmentIds || [];
      if (values.targetType === 'user') params.userIds = values.userIds || [];
      const res = await notificationApi.send(params);
      if (res.code === 0) {
        Message.success('发送成功');
        setSendVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '发送失败');
      }
    } catch (e) {
      Message.error('发送失败');
    } finally {
      setSendLoading(false);
    }
  };

  const handleReadAll = async () => {
    try {
      const res = await notificationApi.markAllRead();
      if (res.code === 0) {
        Message.success('已全部标记为已读');
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    }
  };

  const handleReadOne = async (item: Notification) => {
    if (item.read) return;
    try {
      const res = await notificationApi.markRead(item.id);
      if (res.code === 0) fetchList();
    } catch (e) {
      // 忽略单条已读失败
    }
  };

  return (
    <PageContainer
      title="我的通知"
      action={
        <Space>
          {unread > 0 && <Badge count={unread} />}
          {can('system:notification:send') && (
            <Button size="small" type="primary" onClick={openSend}>
              发送通知
            </Button>
          )}
          <Button size="small" onClick={handleReadAll} disabled={unread === 0}>
            全部已读
          </Button>
        </Space>
      }
    >
      <Card loading={loading}>
        {data.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={data}
            render={(item) => (
              <div
                key={item.id}
                onClick={() => handleReadOne(item)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 4px',
                  borderBottom: '1px solid var(--color-border-2)',
                  cursor: item.read ? 'default' : 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={item.read ? { color: '#86909c' } : { fontWeight: 600 }}>
                    {item.title}
                  </span>
                  {item.content ? (
                    <div style={{ fontSize: 13, color: '#4e5969', marginTop: 2 }}>{item.content}</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>{item.createdAt}</div>
                </div>
                <Space>
                  <Tag color={typeMap[item.type]?.color || 'gray'}>
                    {typeMap[item.type]?.label || item.type}
                  </Tag>
                  {!item.read && <Tag color="red">未读</Tag>}
                </Space>
              </div>
            )}
          />
        )}
      </Card>

      {/* 发送通知弹窗 */}
      <Modal
        title="发送通知"
        visible={sendVisible}
        onCancel={() => setSendVisible(false)}
        onOk={handleSend}
        confirmLoading={sendLoading}
        okText="发送"
        cancelText="取消"
      >
        <Form form={sendForm} layout="vertical">
          <Form.Item label="标题" field="title" rules={[{ required: true, message: '请输入通知标题' }]}>
            <Input placeholder="请输入通知标题" maxLength={120} />
          </Form.Item>
          <Form.Item label="内容" field="content">
            <Input.TextArea placeholder="请输入通知内容（可选）" rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item label="类型" field="type">
            <Select options={typeOptions} placeholder="请选择类型" />
          </Form.Item>
          <Form.Item label="接收范围" field="targetType" rules={[{ required: true, message: '请选择接收范围' }]}>
            <Radio.Group>
              <Radio value="all">全员</Radio>
              <Radio value="department">指定部门</Radio>
              <Radio value="user">指定人员</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const targetType = sendForm.getFieldValue('targetType');
              if (targetType === 'department') {
                return (
                  <Form.Item
                    label="接收部门"
                    field="departmentIds"
                    rules={[{ required: true, type: 'array', message: '请选择接收部门' }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="请选择接收部门"
                      options={departments.map((d) => ({ label: d.name, value: d.id }))}
                    />
                  </Form.Item>
                );
              }
              if (targetType === 'user') {
                return (
                  <Form.Item
                    label="接收人员"
                    field="userIds"
                    rules={[{ required: true, type: 'array', message: '请选择接收人员' }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="请选择接收人员"
                      options={users.map((u) => ({ label: u.name || u.username, value: u.id }))}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
