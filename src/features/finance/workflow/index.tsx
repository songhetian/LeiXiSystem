import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Group, 
  Title, 
  Text, 
  TextInput, 
  Select, 
  Button, 
  Badge, 
  ActionIcon, 
  Stack, 
  Tabs, 
  rem, 
  SimpleGrid,
  Divider,
  ThemeIcon,
  Tooltip,
  Timeline,
  Alert
} from '@mantine/core';
import { 
  Shield, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Undo2, 
  Search, 
  RefreshCw, 
  Network,
  GitBranch,
  Filter,
  Calendar
} from 'lucide-react';
import { useWorkflowDefinitions, useWorkflowActions } from './api';
import { LXTable } from '@/components/common/LXTable';
import { notifications } from '@mantine/notifications';

export const WorkflowArchitecture = () => {
  const [activeTab, setActiveTab] = useState<string | null>('config');
  const { data: definitions = [], isLoading, refetch } = useWorkflowDefinitions();

  const defColumns = [
    { 
      key: 'name', 
      title: '流程名称', 
      render: (r: any) => (
        <Group gap="sm">
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            <GitBranch size={16} />
          </ThemeIcon>
          <Text size="sm" fw={900}>{r.name}</Text>
        </Group>
      )
    },
    { 
      key: 'nodes', 
      title: '节点链路', 
      render: (r: any) => (
        <Group gap={4}>
          {r.nodes.map((n: any, idx: number) => (
            <React.Fragment key={n.id}>
              <Badge variant="outline" color="gray" size="xs">{n.node_name}</Badge>
              {idx < r.nodes.length - 1 && <Text size="xs" c="dimmed">→</Text>}
            </React.Fragment>
          ))}
        </Group>
      ) 
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center' as const,
      render: () => (
        <Group gap={4} justify="center">
          <Button variant="subtle" size="compact-xs" fw={700}>图形化设计</Button>
          <Button variant="subtle" size="compact-xs" color="gray" fw={700}>属性</Button>
        </Group>
      )
    }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="pending" leftSection={<Shield size={16} />} w="100%" fw={700} h={44}>待我决策</Tabs.Tab>
            <Tabs.Tab value="config" leftSection={<Settings size={16} />} w="100%" fw={700} h={44}>流程架构</Tabs.Tab>
            <Tabs.Tab value="auth" leftSection={<Network size={16} />} w="100%" fw={700} h={44}>职责授权</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>审批引擎管控中枢</Title>
            <Button color="blue" radius="md" size="md" leftSection={<PlusIcon size={18} />} fw={900}>
              定义新业务流
            </Button>
          </Group>

          {activeTab === 'config' && (
            <>
              {/* 规约执行：单行全铺满自适应搜索 */}
              <Group wrap="nowrap" gap="md" mb="xl">
                <Select placeholder="业务类型" data={['reimbursement', 'asset', 'personnel']} style={{ flexGrow: 1 }} size="md" radius="md" defaultValue="reimbursement" />
                <TextInput placeholder="检索流程名称 / 节点描述..." leftSection={<Search size={16} />} style={{ flexGrow: 2 }} size="md" radius="md" />
                <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
                  <RefreshCw size={20} />
                </ActionIcon>
              </Group>

              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <LXTable columns={defColumns} data={definitions} loading={isLoading} />
              </Paper>
            </>
          )}

          {activeTab === 'pending' && (
            <Stack align="center" justify="center" py={100}>
              <ThemeIcon size={80} radius={80} variant="light" color="indigo">
                <Shield size={40} />
              </ThemeIcon>
              <Box style={{ textAlign: 'center' }}>
                <Text fw={900} size="lg">暂无待决策单据</Text>
                <Text size="sm" c="dimmed">所有流入您的待办已通过事务闭环处理完成</Text>
              </Box>
            </Stack>
          )}
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', 
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['运行中', '已归档', '草稿箱', '异常中断'].map((label, idx) => (
                <Button 
                  key={label}
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg"
                  fw={700}
                  styles={{
                    root: {
                      borderRight: idx === 3 ? 0 : '1px solid #64748b',
                      backgroundColor: label === '运行中' ? '#f1f5f9' : 'transparent'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>
                高级策略过滤
              </Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>
                全域链路压力审计
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};

const PlusIcon = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
