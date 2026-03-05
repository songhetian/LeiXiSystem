import React, { useState, useEffect } from 'react';
import { 
  TextInput, 
  PasswordInput, 
  Select, 
  Button, 
  Stack, 
  Group, 
  Text, 
  Alert,
  Loader,
  ActionIcon,
  Modal,
  ThemeIcon,
  List,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { 
  CheckCircle2, 
  XCircle, 
  Info, 
  UserCheck, 
  ArrowRight,
  ClipboardCheck
} from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import { registerSchema, RegisterInput } from '../types';
import { useRegister, useDepartments, useCheckUsername } from '../api/auth';

interface RegisterFormProps {
  onToggleLogin: () => void;
}

export const RegisterForm = ({ onToggleLogin }: RegisterFormProps) => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [suggestions, setUsernameSuggestions] = useState<string[]>([]);
  
  const registerMutation = useRegister();
  const checkUsernameMutation = useCheckUsername();
  const { data: departments = [], isLoading: isLoadingDepts } = useDepartments();

  const form = useForm<RegisterInput>({
    initialValues: {
      real_name: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      department_id: '',
    },
    validate: zodResolver(registerSchema),
  });

  // 自动生成拼音用户名
  useEffect(() => {
    const realName = form.values.real_name;
    if (realName && realName.trim()) {
      const pinyinUsername = pinyin(realName, { toneType: 'none', type: 'array' }).join('').toLowerCase();
      form.setFieldValue('username', pinyinUsername);
      handleCheckUsername(pinyinUsername, realName);
    }
  }, [form.values.real_name]);

  const handleCheckUsername = async (username: string, realName: string) => {
    if (!username || username.trim().length === 0) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }

    try {
      const result = await checkUsernameMutation.mutateAsync({ 
        username: username.trim(), 
        realName: realName || form.values.real_name 
      });
      setUsernameAvailable(result.available);
      setUsernameSuggestions(result.suggestions || []);
    } catch (e) {
      console.error('检查用户名失败');
    }
  };

  const handleRegister = async (values: RegisterInput) => {
    if (usernameAvailable === false) {
      notifications.show({ title: '错误', message: '请使用可用的用户名', color: 'red' });
      return;
    }

    try {
      const response = await registerMutation.mutateAsync(values);
      if (response.success) {
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      notifications.show({
        title: '注册失败',
        message: error.response?.data?.message || '请检查输入信息',
        color: 'red',
      });
    }
  };

  return (
    <>
      <form onSubmit={form.onSubmit(handleRegister)}>
        <Stack gap="md">
          <TextInput
            label="真实姓名"
            placeholder="请输入真实姓名"
            required
            {...form.getInputProps('real_name')}
          />

          <TextInput
            label="用户名"
            placeholder="请输入用户名"
            required
            {...form.getInputProps('username')}
            rightSection={
              checkUsernameMutation.isPending ? (
                <Loader size="xs" />
              ) : usernameAvailable === true ? (
                <CheckCircle2 size={16} color="var(--mantine-color-green-filled)" />
              ) : usernameAvailable === false ? (
                <XCircle size={16} color="var(--mantine-color-red-filled)" />
              ) : null
            }
            error={usernameAvailable === false ? '用户名已存在' : form.errors.username}
            onBlur={(e) => handleCheckUsername(e.target.value, form.values.real_name)}
          />

          {suggestions.length > 0 && (
            <Alert color="yellow" icon={<Info size={16} />} py="xs">
              <Text size="xs" fw={700} mb={5}>用户名已被使用，建议使用：</Text>
              <Group gap="xs">
                {suggestions.map((s) => (
                  <Button 
                    key={s} 
                    variant="subtle" 
                    size="compact-xs" 
                    onClick={() => {
                      form.setFieldValue('username', s);
                      handleCheckUsername(s, form.values.real_name);
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </Group>
            </Alert>
          )}

          <Select
            label="部门"
            placeholder="请选择所属部门"
            required
            data={departments.map(d => ({ value: String(d.id), label: d.name }))}
            {...form.getInputProps('department_id')}
            loading={isLoadingDepts}
          />

          <TextInput
            label="邮箱 (可选)"
            placeholder="example@leixi.com"
            {...form.getInputProps('email')}
          />

          <TextInput
            label="手机号码 (可选)"
            placeholder="请输入联系电话"
            {...form.getInputProps('phone')}
          />

          <PasswordInput
            label="登录密码"
            placeholder="至少 6 位字符"
            required
            {...form.getInputProps('password')}
          />

          <Group justify="space-between" mt="xs">
            <Text 
              component="button" 
              type="button" 
              size="sm" 
              c="dimmed" 
              style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
              onClick={onToggleLogin}
            >
              已有账号？去登录
            </Text>
          </Group>

          <Button 
            type="submit" 
            fullWidth 
            mt="xl" 
            loading={registerMutation.isPending}
            size="md"
          >
            提交注册申请
          </Button>
        </Stack>
      </form>

      {/* 注册成功提示弹窗 */}
      <Modal
        opened={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onToggleLogin();
        }}
        withCloseButton={false}
        centered
        padding="xl"
        radius="lg"
      >
        <Stack align="center" gap="lg">
          <ThemeIcon size={60} radius={60} color="green">
            <UserCheck size={32} />
          </ThemeIcon>
          
          <div style={{ textAlign: 'center' }}>
            <Title order={3} fw={900}>注册申请已提交</Title>
            <Text c="dimmed" size="sm" mt="xs">您的账号正在等待管理员审核</Text>
          </div>

          <Alert color="blue" variant="light" w="100%">
            <Stack gap={5}>
              <Text fw={700} size="sm" flex={1}>下一步：</Text>
              <List size="xs" spacing="xs" withPadding>
                <List.Item>管理员将在 1 个工作日内完成审核</List.Item>
                <List.Item>审核通过后，您将可以使用该账号登录系统</List.Item>
                <List.Item>请关注系统公告或咨询部门负责人</List.Item>
              </List>
            </Stack>
          </Alert>

          <Button 
            fullWidth 
            onClick={() => {
              setShowSuccessModal(false);
              onToggleLogin();
            }}
            rightSection={<ArrowRight size={16} />}
          >
            好的，返回登录
          </Button>
        </Stack>
      </Modal>
    </>
  );
};
