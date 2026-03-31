import React, { useEffect, useState } from 'react';
import { 
  Box, Container, Paper, Title, Text, Group, Avatar, Button, Stack, 
  Tabs, rem, SimpleGrid, Badge, ActionIcon, 
  TextInput, PasswordInput, FileButton
} from '@mantine/core';
import { 
  User, Wallet, Monitor, ShieldCheck, Eye, EyeOff, 
  Save, Camera, Calendar, Filter
} from 'lucide-react';
import { useAuthStore } from '@/core/store/auth';
import { useChangePassword, useProfile, useSalaryHistory, useUpdateProfile, useUploadFile } from './api';
import { LXTable } from '@/components/common/LXTable';
import { getImageUrl } from '@/core/utils/file';
import dayjs from 'dayjs';
import { notifications } from '@mantine/notifications';

export const PersonalCenter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const [salaryVisible, setSalaryVisible] = useState(false);
  const [profileForm, setProfileForm] = useState({ real_name: '', email: '', phone: '', avatar: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const { user: authUser } = useAuthStore();
  const { data: profile, isLoading } = useProfile(authUser?.id);
  const { data: salaryHistory = [], isLoading: salaryLoading } = useSalaryHistory();
  const updateProfile = useUpdateProfile();
  const uploadFile = useUploadFile();
  const changePassword = useChangePassword();

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      real_name: profile.real_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      avatar: profile.avatar || '',
    });
  }, [profile]);

  const handleProfileSave = async () => {
    if (!authUser?.id) return;
    try {
      await updateProfile.mutateAsync({ userId: authUser.id, data: profileForm });
      notifications.show({ title: '保存成功', message: '个人资料已同步到服务器', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: '保存失败', message: error.response?.data?.message || '资料更新失败', color: 'red' });
    }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !authUser?.id) return;

    try {
      const uploaded = await uploadFile.mutateAsync({ file, bizType: 'avatar' });
      const nextForm = { ...profileForm, avatar: uploaded.bizPath };
      setProfileForm(nextForm);
      await updateProfile.mutateAsync({ userId: authUser.id, data: nextForm });
      notifications.show({ title: '上传成功', message: '头像已更新', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: '上传失败', message: error.response?.data?.message || '头像上传失败', color: 'red' });
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      notifications.show({ title: '校验失败', message: '请确认新密码填写一致', color: 'red' });
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      notifications.show({ title: '修改成功', message: '登录密码已更新', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: '修改失败', message: error.response?.data?.message || '密码更新失败', color: 'red' });
    }
  };

  const salaryColumns = [
    { key: 'month', title: '薪资月份', render: (r: any) => dayjs(r.salary_month).format('YYYY年MM月') },
    { 
      key: 'net', 
      title: '实发金额', 
      align: 'right' as const,
      render: (r: any) => (
        <Group gap="xs" justify="flex-end">
          <Text fw={900} style={{ fontFamily: 'monospace' }}>
            {salaryVisible ? `¥ ${r.net_salary.toLocaleString()}` : '••••••'}
          </Text>
        </Group>
      )
    },
    { key: 'status', title: '核销状态', render: () => <Badge variant="light" color="emerald">已物理到账</Badge> },
    { key: 'actions', title: '详情', render: () => <Button variant="subtle" size="compact-xs">查看明细</Button> }
  ];

  return (
    <Box>
      <Stack gap="lg">
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="xl" mb="xl">
            <Tabs.List>
              <Tabs.Tab value="profile" leftSection={<User size={16} />}>个人资料</Tabs.Tab>
              <Tabs.Tab value="salary" leftSection={<Wallet size={16} />}>我的薪资</Tabs.Tab>
              <Tabs.Tab value="assets" leftSection={<Monitor size={16} />}>领用资产</Tabs.Tab>
              <Tabs.Tab value="security" leftSection={<ShieldCheck size={16} />}>账号安全</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {activeTab === 'profile' && (
            <Stack gap="xl">
              <Group justify="space-between">
                <Title order={3} fw={800}>个人资料</Title>
                <Button color="blue" radius="md" size="md" leftSection={<Save size={18} />} fw={900} h={44}>
                  保存资料
                </Button>
              </Group>

              <Group gap={32} align="flex-start">
                <Box pos="relative">
                  <Avatar src={getImageUrl(profileForm.avatar)} size={120} radius={30} style={{ border: '4px solid white', boxShadow: 'var(--mantine-shadow-md)' }} />
                  <FileButton onChange={handleAvatarUpload} accept="image/png,image/jpeg,image/webp">
                    {(props) => (
                      <ActionIcon {...props} pos="absolute" bottom={-4} right={-4} size={36} radius="md" color="blue" variant="filled" loading={uploadFile.isPending}>
                        <Camera size={18} />
                      </ActionIcon>
                    )}
                  </FileButton>
                </Box>
                <Stack gap="md" style={{ flex: 1 }}>
                  <SimpleGrid cols={2}>
                    <TextInput label="真实姓名" value={profileForm.real_name} onChange={(e) => setProfileForm((prev) => ({ ...prev, real_name: e.currentTarget.value }))} size="md" radius="md" />
                    <TextInput label="工号存证" value={profile?.employee_no || ''} readOnly size="md" radius="md" />
                    <TextInput label="所属部门" value={profile?.department_name || ''} readOnly size="md" radius="md" />
                    <TextInput label="标准职等" value={profile?.position_name || ''} readOnly size="md" radius="md" />
                    <TextInput label="邮箱" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.currentTarget.value }))} size="md" radius="md" />
                    <TextInput label="手机号码" value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.currentTarget.value }))} size="md" radius="md" />
                  </SimpleGrid>
                  <Group justify="flex-end">
                    <Button color="blue" radius="md" size="md" leftSection={<Save size={18} />} fw={900} h={44} onClick={handleProfileSave} loading={updateProfile.isPending}>
                      同步至云端
                    </Button>
                  </Group>
                </Stack>
              </Group>
            </Stack>
          )}

          {activeTab === 'salary' && (
            <Stack gap="lg">
              <Group justify="space-between">
                <Box>
                  <Title order={3} fw={800}>薪资记录</Title>
                  <Text size="sm" c="dimmed">查看历史工资发放记录。</Text>
                </Box>
                <Button 
                  variant="outline" 
                  color={salaryVisible ? "red" : "blue"} 
                  h={44} 
                  radius="md" 
                  leftSection={salaryVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  onClick={() => setSalaryVisible(!salaryVisible)}
                  fw={900}
                >
                  {salaryVisible ? "隐藏敏感金额" : "物理身份验签查看"}
                </Button>
              </Group>
              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <LXTable columns={salaryColumns} data={salaryHistory} loading={salaryLoading} />
              </Paper>
            </Stack>
          )}

          {activeTab === 'security' && (
            <Stack gap="lg">
              <Box>
                <Title order={3} fw={800}>账号安全</Title>
                <Text size="xs" c="dimmed">建议定期更新密码，并避免与其他系统复用。</Text>
              </Box>
              <SimpleGrid cols={2}>
                <PasswordInput label="当前密码" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.currentTarget.value }))} size="md" radius="md" />
                <Box />
                <PasswordInput label="新密码" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.currentTarget.value }))} size="md" radius="md" />
                <PasswordInput label="确认新密码" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.currentTarget.value }))} size="md" radius="md" />
              </SimpleGrid>
              <Group justify="flex-end">
                <Button color="blue" radius="md" h={44} fw={900} onClick={handlePasswordChange} loading={changePassword.isPending}>
                  更新密码
                </Button>
              </Group>
            </Stack>
          )}
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合 & slate-500 边框) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['个人动态', '审批历史', '考勤月报'].map((label, idx) => (
                <Button 
                  key={label} 
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg" 
                  fw={700} 
                  styles={{ root: { borderRight: idx === 2 ? 0 : '1px solid #64748b' } }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>全局审计过滤</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>申请档案下载</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
