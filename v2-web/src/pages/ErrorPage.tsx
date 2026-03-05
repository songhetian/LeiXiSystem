import React from 'react';
import { Container, Title, Text, Button, Group, Stack, rem, ThemeIcon } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, RefreshCcw, ShieldAlert } from 'lucide-react';

interface ErrorPageProps {
  code?: 404 | 401 | 500;
  title?: string;
  message?: string;
}

export const ErrorPage = ({ code = 404, title, message }: ErrorPageProps) => {
  const navigate = useNavigate();

  const configs = {
    404: {
      icon: AlertCircle,
      color: 'blue',
      title: title || '物理路径未命中',
      message: message || '您请求的数字化资源不存在，或者已被后台物理清理。',
    },
    401: {
      icon: ShieldAlert,
      color: 'red',
      title: title || '身份鉴权受阻',
      message: message || '您的会话已失效或权限不足，请重新验证身份信息。',
    },
    500: {
      icon: RefreshCcw,
      color: 'orange',
      title: title || '系统内核异常',
      message: message || '后台事务处理遇到物理瓶颈，研发团队已收到自动存证信号。',
    }
  };

  const config = configs[code];
  const Icon = config.icon;

  return (
    <Box style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: 'var(--mantine-color-gray-0)' 
    }}>
      <Container size="sm">
        <Paper withBorder p={50} radius="xl" shadow="md">
          <Stack align="center" gap="lg">
            <ThemeIcon size={80} radius={80} variant="light" color={config.color}>
              <Icon size={40} />
            </ThemeIcon>
            
            <div style={{ textAlign: 'center' }}>
              <Title order={1} fw={900} style={{ fontSize: rem(34), tracking: 'tighter' }}>
                {code}: {config.title}
              </Title>
              <Text c="dimmed" size="lg" mt="md" fw={700}>
                {config.message}
              </Text>
            </div>

            <Divider w="100%" label="雷犀安全守卫引擎 v2.2" labelPosition="center" />

            <Group gap="md">
              <Button 
                variant="outline" 
                color="gray" 
                size="md" 
                radius="md" 
                h={44}
                leftSection={<Home size={18} />}
                onClick={() => navigate('/app/dashboard')}
                fw={900}
              >
                返回工作台
              </Button>
              <Button 
                color={config.color} 
                size="md" 
                radius="md" 
                h={44}
                onClick={() => window.location.reload()}
                fw={900}
              >
                尝试物理刷新
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

import { Box, Paper, Divider } from '@mantine/core';
