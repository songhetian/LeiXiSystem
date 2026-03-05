import React, { useState, useEffect } from 'react';
import { 
  TextInput, 
  PasswordInput, 
  Checkbox, 
  Button, 
  Paper, 
  Title, 
  Text, 
  Container, 
  Group,
  Modal,
  Stack,
  Alert,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { AlertTriangle, InfoCircle, ShieldAlert } from 'lucide-react';
import { loginSchema, LoginInput } from '../types';
import { useLogin, useCheckSession } from '../api/auth';

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onToggleRegister: () => void;
}

export const LoginForm = ({ onSuccess, onToggleRegister }: LoginFormProps) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  
  const loginMutation = useLogin();
  const checkSessionMutation = useCheckSession();

  const form = useForm<LoginInput>({
    initialValues: {
      username: '',
      password: '',
      rememberPassword: false,
    },
    validate: zodResolver(loginSchema),
  });

  // 加载记住的凭据
  useEffect(() => {
    const isRemembered = localStorage.getItem('rememberPassword') === 'true';
    if (isRemembered) {
      const savedUsername = localStorage.getItem('rememberedUsername');
      const savedPassword = localStorage.getItem('rememberedPassword');
      if (savedUsername && savedPassword) {
        try {
          form.setValues({
            username: savedUsername,
            password: atob(savedPassword),
            rememberPassword: true,
          });
        } catch (e) {
          console.error('解码失败');
        }
      }
    }
  }, []);

  const handleLogin = async (values: LoginInput, forceLogin = false) => {
    try {
      if (!forceLogin) {
        const sessionCheck = await checkSessionMutation.mutateAsync(values.username);
        if (sessionCheck.hasActiveSession) {
          setSessionInfo(sessionCheck);
          setShowConfirmModal(true);
          return;
        }
      }

      const response = await loginMutation.mutateAsync({ ...values, forceLogin });
      
      if (response.success) {
        // 存储 Token 和用户信息 (保持 v1 逻辑)
        localStorage.setItem('token', response.token);
        if (response.sessionToken) {
          localStorage.setItem('sessionToken', response.sessionToken);
        }
        
        const userData = { ...response.user };
        delete userData.id_card_front_url;
        delete userData.id_card_back_url;
        localStorage.setItem('user', JSON.stringify(userData));

        // 记住密码逻辑 (保持 v1 逻辑)
        if (values.rememberPassword) {
          localStorage.setItem('rememberedUsername', values.username);
          localStorage.setItem('rememberedPassword', btoa(values.password));
          localStorage.setItem('rememberPassword', 'true');
        } else {
          localStorage.removeItem('rememberedUsername');
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberPassword');
        }

        notifications.show({
          title: '登录成功',
          message: '欢迎回到雷犀系统',
          color: 'green',
        });
        
        onSuccess(response.user);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || '登录失败，请重试';
      notifications.show({
        title: '错误',
        message,
        color: 'red',
      });
    }
  };

  return (
    <>
      <form onSubmit={form.onSubmit((v) => handleLogin(v))}>
        <Stack gap="md">
          <TextInput
            label="用户名"
            placeholder="请输入您的用户名"
            required
            {...form.getInputProps('username')}
          />

          <PasswordInput
            label="密码"
            placeholder="请输入您的密码"
            required
            {...form.getInputProps('password')}
          />

          <Group justify="space-between" mt="xs">
            <Checkbox 
              label="记住密码" 
              {...form.getInputProps('rememberPassword', { type: 'checkbox' })} 
            />
            <Text 
              component="button" 
              type="button" 
              size="sm" 
              c="dimmed" 
              style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
              onClick={onToggleRegister}
            >
              还没有账号？去注册
            </Text>
          </Group>

          <Button 
            type="submit" 
            fullWidth 
            mt="xl" 
            loading={loginMutation.isPending || checkSessionMutation.isPending}
            size="md"
          >
            登录
          </Button>
        </Stack>
      </form>

      {/* 活跃会话确认弹窗 */}
      <Modal 
        opened={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
        title={<Group gap="xs"><ShieldAlert size={20} color="orange" /><Text fw={900}>检测到活跃会话</Text></Group>}
        centered
      >
        <Stack>
          <Alert color="blue" icon={<InfoCircle size={16} />}>
            该账号已在其他设备登录。
            {sessionInfo?.sessionCreatedAt && (
              <Text size="xs" mt={5}>
                登录时间：{new Date(sessionInfo.sessionCreatedAt).toLocaleString('zh-CN')}
              </Text>
            )}
          </Alert>

          <Alert color="red" icon={<AlertTriangle size={16} />}>
            如果继续登录，之前登录的设备将被强制退出。请确认这是您本人的操作。
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setShowConfirmModal(false)} color="gray">取消</Button>
            <Button 
              color="red" 
              loading={loginMutation.isPending}
              onClick={() => handleLogin(form.values, true)}
            >
              确认登录
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
