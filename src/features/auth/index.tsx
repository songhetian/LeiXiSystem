import React, { useState } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Container, 
  Box,
  Transition,
  Image,
  Center,
  Stack,
} from '@mantine/core';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

interface AuthFeatureProps {
  onLoginSuccess: (user: any) => void;
}

export const AuthFeature = ({ onLoginSuccess }: AuthFeatureProps) => {
  const [type, setType] = useState<'login' | 'register'>('login');

  return (
    <Container size={420} my={40}>
      <Stack align="center" mb={30} gap="xs">
        <Image src="/icons/logo.ico" w={64} h={64} alt="Logo" />
        <Title order={2} fw={900} style={{ tracking: 'tighter' }}>
          雷犀客服管理系统
        </Title>
        <Text c="dimmed" size="sm" fw={700}>
          {type === 'login' ? '企业级客服管理平台' : '新账号注册申请'}
        </Text>
      </Stack>

      <Paper withBorder shadow="md" p={30} radius="lg">
        {type === 'login' ? (
          <LoginForm 
            onSuccess={onLoginSuccess} 
            onToggleRegister={() => setType('register')} 
          />
        ) : (
          <RegisterForm 
            onToggleLogin={() => setType('login')} 
          />
        )}
      </Paper>

      <Box mt={20} style={{ textAlign: 'center' }}>
        <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          LeiXi System v2.0 · 数字化运营中枢
        </Text>
      </Box>
    </Container>
  );
};

export * from './types';
export * from './api/auth';
