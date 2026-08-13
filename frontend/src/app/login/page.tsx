'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Typography, Message } from '@arco-design/web-react';
import { authApi } from '@/services/auth';

export default function LoginPage() {
  const router = useRouter();
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
      if (res.code === 0) {
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f7fa',
    }}>
      <div style={{
        width: 400,
        padding: 40,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}>
        <Typography.Title heading={4} style={{ textAlign: 'center', marginBottom: 32 }}>
          雷犀客服管理系统
        </Typography.Title>
        <Form layout="vertical" onSubmit={handleSubmit}>
          <Form.Item label="用户名">
            <Input
              placeholder="请输入用户名"
              value={username}
              onChange={setUsername}
              onPressEnter={handleSubmit}
            />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password
              placeholder="请输入密码"
              value={password}
              onChange={setPassword}
              onPressEnter={handleSubmit}
            />
          </Form.Item>
          {errorMsg && (
            <div style={{ color: '#f53f3f', marginBottom: 16, fontSize: 13 }}>
              {errorMsg}
            </div>
          )}
          <Button
            type="primary"
            long
            htmlType="submit"
            loading={loading}
            disabled={!canSubmit}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </Form>
      </div>
    </div>
  );
}
