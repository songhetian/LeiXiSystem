import React, { useState } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Container, 
  Box,
  Stack,
  Image,
  SimpleGrid,
} from '@mantine/core';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

interface AuthFeatureProps {
  onLoginSuccess: (user: any) => void;
}

export const AuthFeature = ({ onLoginSuccess }: AuthFeatureProps) => {
  const [type, setType] = useState<'login' | 'register'>('login');
  const isLogin = type === 'login';

  return (
    <Container size={1080} my={32}>
      <Paper
        withBorder
        shadow="xl"
        p={0}
        radius={28}
        style={{
          borderColor: isLogin
            ? 'color-mix(in srgb, var(--mantine-color-cyan-4) 30%, white)'
            : 'color-mix(in srgb, var(--mantine-color-orange-4) 34%, white)',
          background: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(8px)',
          minHeight: 720,
          overflow: 'hidden',
        }}
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0} h="100%">
          <Box
            p={48}
            style={{
              background: isLogin
                ? 'linear-gradient(180deg, #eefcfa 0%, #f8fffe 100%)'
                : 'linear-gradient(180deg, #fff6eb 0%, #fffdfa 100%)',
              borderRight: '1px solid color-mix(in srgb, var(--mantine-color-gray-3) 55%, white)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Stack gap="xl">
              <Image src="/logo.ico" w={88} h={88} alt="雷犀系统标识" />
              <div>
                <Text size="sm" fw={800} c={isLogin ? 'teal.7' : 'orange.7'} mb="md">
                  {isLogin ? '登录中心' : '注册中心'}
                </Text>
                <Title order={1} fw={900} maw={360} lh={1.2}>
                  {isLogin ? '欢迎进入雷犀客服管理系统' : '提交注册信息后等待管理员审核'}
                </Title>
                <Text size="lg" c="dimmed" mt="lg" maw={420} lh={1.8}>
                  {isLogin
                    ? '在这里完成账号登录、进入工作台、处理客服与运营任务。'
                    : '请填写真实姓名、所属部门和登录信息，提交后由管理员完成开通。'}
                </Text>
              </div>

              <Stack gap="md" maw={420}>
                <Text size="sm" fw={700}>统一账号登录</Text>
                <Text size="sm" c="dimmed">账号、部门、权限和业务入口将在登录后自动关联。</Text>
                <Text size="sm" fw={700}>注册后等待审核</Text>
                <Text size="sm" c="dimmed">注册申请提交成功后，管理员审核通过即可使用系统。</Text>
              </Stack>
            </Stack>
          </Box>

          <Box p={{ base: 32, md: 52 }} style={{ display: 'flex', alignItems: 'center' }}>
            <Box w="100%" maw={520} mx="auto">
              <Stack gap="xs" mb={28}>
                <Title order={2} fw={900}>
                  {isLogin ? '账号登录' : '账号注册'}
                </Title>
                <Text size="md" c="dimmed">
                  {isLogin ? '请输入账号和密码后登录系统' : '请填写完整信息后提交注册申请'}
                </Text>
              </Stack>

              {isLogin ? (
                <LoginForm 
                  onSuccess={onLoginSuccess} 
                  onToggleRegister={() => setType('register')} 
                />
              ) : (
                <RegisterForm 
                  onToggleLogin={() => setType('login')} 
                />
              )}
            </Box>
          </Box>
        </SimpleGrid>
      </Paper>
    </Container>
  );
};

export * from './types';
export * from './api/auth';
