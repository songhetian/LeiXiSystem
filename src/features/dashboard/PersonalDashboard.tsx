import React from 'react';
import { 
  Box, Paper, Group, Title, Text, SimpleGrid, Stack, rem, 
  ThemeIcon, Badge, Button, UnstyledButton, Transition,
  Container, Center, Overlay, Divider
} from '@mantine/core';
import { 
  Clock, MessageSquare, Bell, Wallet, Monitor, Library, 
  ShieldCheck, FileText, Calendar, Users, Briefcase,
  Zap, ArrowRight, Settings, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/core/hooks/usePermission';
import { useAuthStore } from '@/core/store/auth';
import { motion } from 'framer-motion';

// 1. 定义 macOS 风格的应用标签矩阵 (物理关联权限)
const DASHBOARD_APPS = [
  { id: 'attendance-home', label: '考勤中心', icon: Clock, color: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)', permission: 'attendance:record:view' },
  { id: 'messaging-chat', label: '即时通讯', icon: MessageSquare, color: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)', permission: 'messaging:chat:use' },
  { id: 'reimbursement-list', label: '财务报销', icon: Wallet, color: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', permission: 'reimbursement:record:view' },
  { id: 'logistics-device-list', label: '实机明细', icon: Monitor, color: 'linear-gradient(135deg, #3a1c71 0%, #d76d77 100%, #ffaf7b 100%)', permission: 'finance:asset:manage' },
  { id: 'knowledge-articles', label: '知识中枢', icon: Library, color: 'linear-gradient(135deg, #1D976C 0%, #93F9B9 100%)', permission: 'knowledge:article:view' },
  { id: 'user-employee', label: '员工管理', icon: Users, color: 'linear-gradient(135deg, #4568DC 0%, #B06AB3 100%)', permission: 'user:employee:view' },
  { id: 'system-logs', label: '审计日志', icon: FileText, color: 'linear-gradient(135deg, #232526 0%, #414345 100%)', permission: 'system:log:view' },
  { id: 'user-permission', label: '权限架构', icon: ShieldCheck, color: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)', permission: 'system:role:view' },
];

export const PersonalDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 规约执行：权限过滤闭环
  const visibleApps = DASHBOARD_APPS.filter(app => hasPermission(app.permission));

  const MacAppTile = ({ app }: { app: typeof DASHBOARD_APPS[0] }) => (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <UnstyledButton 
        onClick={() => navigate(`/app/${app.id}`)}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: rem(12),
          padding: rem(20),
          borderRadius: rem(24),
          transition: 'all 200ms ease',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}
      >
        <Box style={{ 
          width: rem(64), 
          height: rem(64), 
          borderRadius: rem(18), 
          background: app.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
        }}>
          <app.icon color="white" size={32} strokeWidth={2.5} />
        </Box>
        <Text size="sm" fw={900} style={{ tracking: 'tighter' }}>{app.label}</Text>
      </UnstyledButton>
    </motion.div>
  );

  return (
    <Box style={{ 
      minHeight: '100%', 
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: rem(40)
    }}>
      <Container size="xl">
        <Stack gap={60}>
          {/* 顶部欢迎区 - macOS 质感 */}
          <Box style={{ textAlign: 'center' }}>
            <Title order={1} fw={900} style={{ fontSize: rem(48), tracking: 'tighter' }}>
              控制面板
            </Title>
            <Text c="dimmed" size="lg" fw={700} mt="xs">
              欢迎回来，{user?.real_name}。基于 100% 物理权限映射的数字化 Launchpad。
            </Text>
          </Box>

          {/* 规约执行：macOS 自定义标签网格 */}
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="xl">
            {visibleApps.map(app => (
              <MacAppTile key={app.id} app={app} />
            ))}
            
            {/* 个人偏好占位 (逻辑闭环) */}
            <motion.div whileHover={{ scale: 1.05 }}>
              <UnstyledButton 
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: rem(12),
                  padding: rem(20),
                  borderRadius: rem(24),
                  border: '2px dashed var(--mantine-color-gray-3)',
                  opacity: 0.6
                }}
              >
                <Center style={{ width: rem(64), height: rem(64) }}>
                  <Plus size={32} color="var(--mantine-color-gray-4)" />
                </Center>
                <Text size="sm" fw={700} c="dimmed">自定义标签</Text>
              </UnstyledButton>
            </motion.div>
          </SimpleGrid>

          {/* 底部物理缝合操作区 (规约：44px) */}
          <Paper withBorder p="xs" radius="xl" shadow="md" style={{ 
            maxWidth: rem(600), 
            margin: '0 auto',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #64748b' // 严格锁定 slate-500
          }}>
            <Group justify="space-between" px="md">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" radius="xl">
                  <Zap size={14} />
                </ThemeIcon>
                <Text size="xs" fw={900} style={{ textTransform: 'uppercase' }}>极速入口</Text>
              </Group>
              <Divider orientation="vertical" />
              <Group gap="sm">
                <Button variant="subtle" color="gray" h={44} radius="md" fw={700}>今日打卡</Button>
                <Button variant="subtle" color="gray" h={44} radius="md" fw={700}>待办中心</Button>
                <Button color="blue" h={44} radius="md" fw={900} rightSection={<ArrowRight size={16} />}>
                  个人中心
                </Button>
              </Group>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};
