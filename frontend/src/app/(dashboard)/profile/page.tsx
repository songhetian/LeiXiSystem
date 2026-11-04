'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Tabs, Form, Input, Button, Message, Descriptions, Avatar } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { authApi } from '@/services/auth';
import { employeeApi, Employee } from '@/services/employee';
import { useAuthStore } from '@/store/auth';
import { useCachedData } from '@/hooks/use-cached-data';

const FormItem = Form.Item;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [pwdLoading, setPwdLoading] = useState(false);
  const [form] = Form.useForm();

  // ===== 二级密码（隐私密码）=====
  // 三态：loading/error 都不能当成「未设置」——否则已设过密码的用户会看到
  // 「设置二级密码」表单（没有原密码字段），提交必然 400「请输入原二级密码」，
  // 而重置入口又不渲染，用户彻底无路可走。
  const [privacyStatus, setPrivacyStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [privacyEnabled, setPrivacyEnabled] = useState<boolean | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  // 已设置时的两种操作形态：set = 修改（需原密码），reset = 忘记原密码用登录密码重置
  const [privacyMode, setPrivacyMode] = useState<'set' | 'reset'>('set');
  const [privacyError, setPrivacyError] = useState('');
  const [privacyForm] = Form.useForm();

  const loadPrivacyStatus = useCallback(async () => {
    setPrivacyStatus('loading');
    try {
      const res = await authApi.getPrivacyPasswordStatus();
      if (res.code === 0 && res.data) {
        setPrivacyEnabled(!!res.data.enabled);
        setPrivacyStatus('ready');
        return;
      }
      setPrivacyStatus('error');
    } catch {
      // 查询失败必须显式暴露：静默降级成「未设置」会让表单和真实状态错位
      setPrivacyStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadPrivacyStatus();
  }, [loadPrivacyStatus]);

  const handlePrivacySubmit = async () => {
    // 状态未知时不能提交：会把「修改」当成「首次设置」发给后端，必然 400
    if (privacyStatus !== 'ready') {
      Message.warning('二级密码状态尚未就绪，请稍后重试');
      return;
    }
    try {
      const values = await privacyForm.validate();
      if (values.newPassword !== values.confirmPassword) {
        Message.error('两次输入的二级密码不一致');
        return;
      }
      setPrivacyLoading(true);
      setPrivacyError('');
      if (privacyEnabled && privacyMode === 'reset') {
        await authApi.resetPrivacyPassword(values.loginPassword, values.newPassword);
        Message.success('二级密码重置成功');
      } else {
        await authApi.setPrivacyPassword(
          values.newPassword,
          privacyEnabled ? values.oldPassword : undefined,
        );
        Message.success(privacyEnabled ? '二级密码修改成功' : '二级密码设置成功');
      }
      privacyForm.resetFields();
      // 重置成功后必须回到「修改」形态：否则表单仍显示登录密码 + 「重置二级密码」按钮，
      // 用户会以为没成功，再点一次又走一遍重置。
      setPrivacyMode('set');
      await loadPrivacyStatus();
    } catch (e: any) {
      // 表单校验失败（Arco 抛字段错误对象）不提示；接口错误为 ApiError，内联展示
      if (e?.name === 'ApiError') {
        setPrivacyError(e.message || '操作失败');
      }
    } finally {
      setPrivacyLoading(false);
    }
  };

  // 个人档案走 SWR 共享缓存；失败提示由请求拦截器统一弹出
  const fetchProfile = useCallback(async () => {
    const res = await employeeApi.getMe();
    if (res.code === 0 && res.data) return res.data;
    throw new Error(res.message || '获取个人档案失败');
  }, []);
  const { data: employee, loading } = useCachedData<Employee>('profile:me', fetchProfile);

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
      <PageContainer >
        <Tabs defaultActiveTab="profile">
          <Tabs.TabPane key="profile" title="个人信息">
            <Card loading={loading}>
              <div className="flex items-center mb-6">
                <Avatar size={64} style={{ backgroundColor: 'var(--lx-primary)', color: 'var(--lx-text-white)' }}>
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
                    { label: '工号', value: employee.employeeNo || '-' },
                    { label: '部门', value: employee.department?.name || '-' },
                    { label: '职位', value: employee.position?.name || '-' },
                    { label: '入职日期', value: employee.hireDate || '-' },
                    // 邮箱归属 User 模型，后端 me 接口已随档案返回 user.email
                    { label: '邮箱', value: employee.user?.email || '-' },
                    { label: '电话', value: employee.phone || '-' },
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

          <Tabs.TabPane key="privacy" title="二级密码">
            <Card>
              <p style={{ margin: '0 0 4px', color: 'var(--lx-text-2)', fontSize: 13 }}>
                二级密码用于查看工资条等敏感信息时的二次验证，与登录密码相互独立。
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13 }}>
                当前状态：
                {privacyStatus === 'loading' ? (
                  <span style={{ color: 'var(--lx-text-3)' }}>查询中…</span>
                ) : privacyStatus === 'error' ? (
                  <span style={{ color: 'var(--lx-danger-text)' }}>
                    查询失败，
                    <Button type="text" size="mini" onClick={() => void loadPrivacyStatus()}>
                      重试
                    </Button>
                  </span>
                ) : privacyEnabled ? (
                  <span style={{ color: 'var(--lx-success)', fontWeight: 600 }}>已启用</span>
                ) : (
                  <span style={{ color: 'var(--lx-warning)', fontWeight: 600 }}>未启用（查看工资条时回退登录密码验证）</span>
                )}
              </p>
              <Form form={privacyForm} layout="vertical" style={{ maxWidth: 400 }} disabled={privacyStatus !== 'ready'}>
                {privacyEnabled && privacyMode === 'set' && (
                  <FormItem
                    label="原二级密码"
                    field="oldPassword"
                    rules={[{ required: true, message: '请输入原二级密码' }]}
                  >
                    <Input.Password placeholder="请输入原二级密码" />
                  </FormItem>
                )}
                {privacyEnabled && privacyMode === 'reset' && (
                  <FormItem
                    label="登录密码"
                    field="loginPassword"
                    rules={[{ required: true, message: '请输入登录密码' }]}
                  >
                    <Input.Password placeholder="请输入登录密码" />
                  </FormItem>
                )}
                <FormItem
                  label="二级密码"
                  field="newPassword"
                  rules={[
                    { required: true, message: '请输入二级密码' },
                    { minLength: 6, message: '二级密码至少 6 位' },
                  ]}
                >
                  <Input.Password placeholder="请输入二级密码（至少 6 位）" />
                </FormItem>
                <FormItem
                  label="确认二级密码"
                  field="confirmPassword"
                  rules={[{ required: true, message: '请再次输入二级密码' }]}
                >
                  <Input.Password placeholder="请再次输入二级密码" />
                </FormItem>
                <FormItem>
                  <Button
                    type="primary"
                    long
                    onClick={handlePrivacySubmit}
                    loading={privacyLoading}
                  >
                    {privacyEnabled !== true
                      ? '设置二级密码'
                      : privacyMode === 'reset'
                        ? '重置二级密码'
                        : '确认修改'}
                  </Button>
                  {privacyEnabled && (
                    <Button
                      type="text"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setPrivacyMode((m) => (m === 'reset' ? 'set' : 'reset'));
                        setPrivacyError('');
                        privacyForm.resetFields();
                      }}
                    >
                      {privacyMode === 'reset'
                        ? '返回修改'
                        : '忘记原二级密码？用登录密码重置'}
                    </Button>
                  )}
                </FormItem>
              </Form>
              {privacyError && (
                <p style={{ margin: '4px 0 0', color: 'var(--lx-danger-text)', fontSize: 12 }}>
                  {privacyError}
                </p>
              )}
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </PageContainer>
  );
}
