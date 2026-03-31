import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mantine/core';
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
        background: `
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.16), transparent 30%),
          linear-gradient(160deg, #f4fbfb 0%, #eef7f8 48%, #f7fafc 100%)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <AuthFeature onLoginSuccess={handleLoginSuccess} />
    </Box>
  );
};

export default LoginPage;
