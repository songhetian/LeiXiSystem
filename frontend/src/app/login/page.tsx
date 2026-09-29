'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Typography, Message, Alert } from '@arco-design/web-react';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { useSystemInfo } from '@/hooks/use-system-info';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { info: systemInfo } = useSystemInfo();
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

  return (
    <div
      className="lx-login-page min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* 单一品牌蓝柔光，保持轻盈 */}
      <div
        className="lx-login-glow-1 pointer-events-none absolute -top-[120px] -left-24 w-[380px] h-[380px] rounded-full"
      />
      <div
        className="lx-login-glow-2 pointer-events-none absolute -bottom-[140px] -right-[120px] w-[440px] h-[440px] rounded-full"
      />

      <div
        className="lx-login-card relative z-10 w-[420px] px-9 py-11 rounded-2xl bg-white lx-animate-slideUp"
      >
        <div className="flex flex-col items-center mb-9">
          {systemInfo.logoUrl ? (
            <img
              src={systemInfo.logoUrl}
              alt="系统 Logo"
              className="h-14 w-14 object-contain rounded-[12px]"
            />
          ) : (
            <div
              className="lx-login-logo flex h-14 w-14 items-center justify-center rounded-xl text-[26px] font-semibold text-white"
            >
              {(systemInfo.name || '雷').charAt(0)}
            </div>
          )}
          <Typography.Title
            heading={4}
            style={{ textAlign: 'center', margin: '18px 0 0', fontWeight: 500 }}
          >
            {systemInfo.name}
          </Typography.Title>
          <div className="text-sm text-text-3 text-center mt-1.5">
            考勤 · 算薪 · 员工管理
          </div>
        </div>

        <Form layout="vertical" onSubmit={handleSubmit} style={{ rowGap: 2 }}>
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
              style={{ margin: '0 0 16px' }}
            />
          )}
          <Button
            type="primary"
            long
            size="large"
            htmlType="submit"
            loading={loading}
            disabled={!canSubmit}
            style={{ fontWeight: 400 }}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </Form>
      </div>

      <div className="relative z-10 mt-8 text-xs text-text-3">
        © 2026 {systemInfo.name} · 企业数字化平台
      </div>
    </div>
  );
}