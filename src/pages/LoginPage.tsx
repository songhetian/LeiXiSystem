import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Box } from '@mantine/core';
import { AuthFeature } from '@/features/auth';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = (user: any) => {
    // 登录成功后跳转到工作台
    navigate('/app/dashboard');
  };

  return (
    <Box 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--mantine-color-gray-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <AuthFeature onLoginSuccess={handleLoginSuccess} />
    </Box>
  );
};

export default LoginPage;
