'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Typography, Message, Alert, Divider } from '@arco-design/web-react';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth';

const MOCK_ADMIN_USER = {
  id: 1,
  username: 'admin',
  name: '系统管理员',
  permissions: [
    'employee:view',
    'employee:manage',
    'department:manage',
    'position:manage',
    'onboarding:view',
    'onboarding:manage',
    'resignation:view',
    'transfer:view',
    'transfer:manage',
    'attendance:view',
    'attendance:manage',
    'vacation:balance:adjust',
    'approval:todo:view',
    'approval:submitted:view',
    'approval:workflow:manage',
    'approval:apply',
    'approval:manage',
    'payroll:view',
    'payroll:manage',
    'payroll:my:view',
    'reimbursement:view',
    'reimbursement:create',
    'reimbursement:approve',
    'knowledge:view',
    'knowledge:manage',
    'reports:view',
    'system:user:view',
    'system:user:manage',
    'system:role:view',
    'system:role:manage',
    'system:broadcast:manage',
    'system:log:view',
    'system:setting:view',
    'system:setting:update',
    'system:config:edit',
    'dict:view',
    'dict:manage',
    'personal:leave:apply',
    'personal:overtime:apply',
    'personal:makeup:apply',
    'personal:attendance:view',
    'personal:notification:view',
    'personal:profile:update',
  ],
};

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setMockUser = useAuthStore((s) => s.setMockUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await authApi.login({ username: username.trim(), password });
      if (res.code === 0 && res.data?.user) {
        setUser(res.data.user);
        Message.success('登录成功');
        router.push('/');
      } else {
        setErrorMsg(res.message || '登录失败');
      }
    } catch (e: any) {
      setErrorMsg(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = () => {
    setMockUser(MOCK_ADMIN_USER);
    Message.success('开发模式登录成功');
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 30%, #f5f0ff 60%, #fff0f5 100%)' }}
    >
      {/* 多彩光晕背景 */}
      <div className="absolute -top-[120px] -left-20 w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(36, 85, 217, 0.22), transparent 70%)',
          filter: 'blur(24px)',
        }}
      />
      <div className="absolute -bottom-[140px] -right-[100px] w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.18), transparent 70%)',
          filter: 'blur(28px)',
        }}
      />
      <div className="absolute top-[35%] right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.15), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <div className="absolute bottom-[20%] left-[15%] w-[180px] h-[180px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12), transparent 70%)',
          filter: 'blur(18px)',
        }}
      />

      <div className="relative z-10 w-[420px] py-10 px-8 rounded-2xl lx-glass lx-animate-slideUp"
        style={{ boxShadow: '0 20px 60px rgba(36, 85, 217, 0.12), 0 4px 20px rgba(0, 0, 0, 0.04)' }}
      >
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-lg text-white text-2xl font-medium flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #2455D9, #3a6ee8)',
              boxShadow: '0 6px 16px rgba(36,85,217,0.32)',
            }}
          >
            雷
          </div>
          <Typography.Title heading={4} style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
            雷犀管理系统
          </Typography.Title>
          <div className="text-sm text-text-3 text-center mt-1">
            考勤 · 算薪 · 员工管理
          </div>
        </div>

        <Form layout="vertical" onSubmit={handleSubmit}>
          <Form.Item label="用户名">
            <Input
              size="large"
              placeholder="请输入用户名"
              value={username}
              onChange={setUsername}
              onPressEnter={handleSubmit}
            />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password
              size="large"
              placeholder="请输入密码"
              value={password}
              onChange={setPassword}
              onPressEnter={handleSubmit}
            />
          </Form.Item>
          {errorMsg && (
            <Alert
              type="error"
              content={errorMsg}
              style={{ marginBottom: 16 }}
            />
          )}
          <Button
            type="primary"
            long
            size="large"
            htmlType="submit"
            loading={loading}
            disabled={!canSubmit}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </Form>

        {process.env.NODE_ENV === 'development' && (
          <>
            <Divider style={{ margin: '24px 0 16px' }}>
              <span style={{ fontSize: 12, color: '#86909c' }}>开发模式</span>
            </Divider>
            <Button
              long
              size="large"
              onClick={handleDevLogin}
              className="bg-success-bg text-success border-success"
              style={{
                background: 'rgba(0, 180, 42, 0.06)',
                borderColor: 'rgba(0, 180, 42, 0.2)',
                color: '#00b42a',
              }}
            >
              快速登录（开发模式）
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
