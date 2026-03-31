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
  Alert,
  Progress,
  Modal,
  Avatar,
  Textarea,
  ThemeIcon
} from '@mantine/core';
import { 
  Megaphone, 
  Send, 
  Inbox, 
  Search, 
  Plus, 
  Calendar, 
  RefreshCw, 
  Info, 
  User, 
  CheckCircle2,
  Clock,
  Filter,
  Settings
} from 'lucide-react';
import { useMyBroadcasts, useBroadcastActions } from './api';
import { useJobStatus } from '../quality/hooks/useJobStatus';
import { LXTable } from '@/components/common/LXTable';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

export const BroadcastSystem = () => {
  const [activeTab, setActiveTab] = useState<string | null>('inbox');
  const [publishModalOpened, setPublishModalOpened] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: broadcasts = [], isLoading, refetch } = useMyBroadcasts();
  const { publish } = useBroadcastActions();

  // Job 进度监听 (规约：大规模推送必须进度可见)
  const jobStatus = useJobStatus(activeJobId, (result) => {
    notifications.show({
      title: '广播全量分发完成',
      message: `已成功推送至 ${result.recipientCount} 位目标用户`,
      color: 'green',
      icon: <CheckCircle2 size={18} />
    });
    setActiveJobId(null);
    setPublishModalOpened(false);
  });

  const handlePublish = async (values: any) => {
    try {
      const res = await publish.mutateAsync({
        title: '系统维护通知', // 示例
        content: '雷犀系统将于今晚 24:00 进行全量性能升级。',
        targetType: 'all',
      });
      if (res.jobId) setActiveJobId(res.jobId);
    } catch (e) {
      notifications.show({ title: '发布失败', message: '队列引擎未就绪', color: 'red' });
    }
  };

  const columns = [
    { 
      key: 'title', 
      title: '广播标题', 
      render: (r: any) => (
        <Group gap="sm">
          <ThemeIcon variant="light" color={r.type === 'error' ? 'red' : 'blue'} size="md" radius="md">
            <Megaphone size={16} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={900}>{r.title}</Text>
            <Text size="xs" c="dimmed" truncate>{r.content}</Text>
          </Box>
        </Group>
      )
    },
    { key: 'creator', title: '发布人', render: (r: any) => <Text size="xs" fw={700}>{r.creator_name}</Text> },
    { key: 'time', title: '发布时间', render: (r: any) => dayjs(r.created_at).format('MM-DD HH:mm') },
    { 
      key: 'status', 
      title: '读取状态', 
      render: (r: any) => (
        <Badge variant={r.is_read ? 'dot' : 'filled'} color={r.is_read ? 'gray' : 'blue'}>
          {r.is_read ? '已读' : '新提醒'}
        </Badge>
      ) 
    }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="inbox" leftSection={<Inbox size={16} />} w="100%" fw={700} h={44}>广播收件箱</Tabs.Tab>
            <Tabs.Tab value="sent" leftSection={<Send size={16} />} w="100%" fw={700} h={44}>我发布的</Tabs.Tab>
            <Tabs.Tab value="manage" leftSection={<Settings size={16} />} w="100%" fw={700} h={44}>推送审计</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>系统广播 · 高性能分发平台</Title>
            <Button color="blue" radius="md" size="md" leftSection={<Plus size={18} />} onClick={() => setPublishModalOpened(true)} fw={900}>
              发布全域公告
            </Button>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select placeholder="消息类型" data={['通知', '告警', '活动']} style={{ flexGrow: 1 }} size="md" radius="md" />
            <TextInput placeholder="检索公告内容关键字..." leftSection={<Search size={16} />} style={{ flexGrow: 2 }} size="md" radius="md" />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable columns={columns} data={broadcasts} loading={isLoading} />
          </Paper>
        </Paper>

        {/* 规约执行：44px 快捷日期按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', 
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['今天', '昨天', '本周', '本月', '全部历史'].map((label, idx) => (
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
                      borderRight: idx === 4 ? 0 : '1px solid #64748b',
                      backgroundColor: label === '全部历史' ? 'transparent' : 'transparent'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>
                高级属性过滤
              </Button>
              <Button color="indigo" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>
                设定自动过期日期
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>

      {/* 规约执行：异步发布对话框 */}
      <Modal 
        opened={publishModalOpened} 
        onClose={() => !activeJobId && setPublishModalOpened(false)}
        title={<Group gap="xs"><Send size={20} /><Text fw={900}>发布大规模系统广播</Text></Group>}
        centered
        radius="lg"
        size="lg"
      >
        <Stack>
          {!activeJobId ? (
            <Stack gap="md">
              <TextInput label="公告标题" placeholder="请输入标题..." required size="md" />
              <Select label="推送目标" placeholder="全员广播" data={['全员', '客服部', '管理层']} defaultValue="全员" size="md" />
              <Textarea label="正文内容" placeholder="支持 Markdown 格式..." minRows={5} size="md" />
              <Button 
                fullWidth 
                size="md" 
                radius="md" 
                color="blue" 
                leftSection={<Send size={18} />}
                onClick={handlePublish}
                loading={publish.isPending}
                fw={900}
              >
                立即加入异步分发队列
              </Button>
            </Stack>
          ) : (
            <Stack p="xl">
              <Group justify="space-between">
                <Text size="sm" fw={900}>千万级用户分发中...</Text>
                <Text size="sm" fw={900} c="indigo">{jobStatus?.progress || 0}%</Text>
              </Group>
              <Progress value={jobStatus?.progress || 0} animated color="indigo" size="xl" radius="xl" />
              <Alert color="indigo" variant="light" mt="md">
                <Text size="xs">规约提示：后台正在执行受保护的物理推送，您可以继续其他操作。</Text>
              </Alert>
            </Stack>
          )}
        </Stack>
      </Modal>
    </Box>
  );
};
