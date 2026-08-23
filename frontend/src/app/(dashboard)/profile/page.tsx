'use client';

import { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Message, Descriptions, Avatar } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { authApi } from '@/services/auth';
import { employeeApi, Employee } from '@/services/employee';
import { useAuthStore } from '@/store/auth';

const FormItem = Form.Item;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getMe();
      if (res.code === 0 && res.data) {
        setEmployee(res.data);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangePassword = async () => {
    try {
      const values = await form.validate();
      if (values.newPassword !== values.confirmPassword) {
        Message.error('两次输入的新密码不一致');
        return;
      }
      setPwdLoading(true);
      const res = await authApi.changePassword(values.oldPassword, values.newPassword);
      if (res.code === 0) {
        Message.success('密码修改成功，请重新登录');
        form.resetFields();
        setTimeout(() => {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }, 1000);
      } else {
        Message.error(res.message || '修改失败');
      }
    } catch (e) {
      // validation error
    } finally {
      setPwdLoading(false);
    }
  };

  return (
      <PageContainer title="个人设置">
        <Tabs defaultActiveTab="profile">
          <Tabs.TabPane key="profile" title="个人信息">
            <Card loading={loading}>
              <div className="flex items-center mb-6">
                <Avatar size={64} style={{ backgroundColor: '#2455D9', color: '#fff' }}>
                  {user?.name?.charAt(0) || 'U'}
                </Avatar>
                <div className="ml-4">
                  <div className="text-lg font-medium">{user?.name || '用户'}</div>
                  <div className="text-sm text-text-3 mt-1">
                    账号：{user?.username}
                  </div>
                </div>
              </div>
              {employee && (
                <Descriptions
                  column={2}
                  labelStyle={{ width: 100 }}
                  data={[
                    { label: '工号', value: (employee as any).employeeNo || '-' },
                    { label: '部门', value: employee.department?.name || '-' },
                    { label: '职位', value: employee.position?.name || '-' },
                    { label: '入职日期', value: (employee as any).hireDate || '-' },
                    { label: '邮箱', value: (employee as any).email || '-' },
                    { label: '电话', value: (employee as any).phone || '-' },
                  ]}
                />
              )}
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane key="password" title="修改密码">
            <Card>
              <Form form={form} layout="vertical" style={{ maxWidth: 400 }}>
                <FormItem
                  label="原密码"
                  field="oldPassword"
                  rules={[{ required: true, message: '请输入原密码' }]}
                >
                  <Input.Password placeholder="请输入原密码" />
                </FormItem>
                <FormItem
                  label="新密码"
                  field="newPassword"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { minLength: 6, message: '密码至少 6 位' },
                  ]}
                >
                  <Input.Password placeholder="请输入新密码（至少 6 位）" />
                </FormItem>
                <FormItem
                  label="确认新密码"
                  field="confirmPassword"
                  rules={[{ required: true, message: '请再次输入新密码' }]}
                >
                  <Input.Password placeholder="请再次输入新密码" />
                </FormItem>
                <FormItem>
                  <Button type="primary" long onClick={handleChangePassword} loading={pwdLoading}>
                    确认修改
                  </Button>
                </FormItem>
              </Form>
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </PageContainer>
  );
}
