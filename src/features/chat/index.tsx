import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Avatar, Stack, Tabs, rem, 
  Badge, ActionIcon, Button, Divider, UnstyledButton, Indicator, ThemeIcon, ScrollArea
} from '@mantine/core';
import { MessageSquare, Users, Search, Send, Smile, Paperclip, Settings, Plus } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useChatGroups, useChatMessages } from './api';
import { useAuthStore } from '@/core/store/auth';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

export const ChatFeature = () => {
  const [activeTab, setActiveTab] = useState<string | null>('groups');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const { user } = useAuthStore();
  const { data: groups = [] } = useChatGroups();
  const { data: messages = [] } = useChatMessages(selectedGroupId);

  const selectedGroup = groups.find((g: any) => g.id === selectedGroupId);

  // 规约执行：发送后物理滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSendMessage = () => {
    if (!message.trim() || !selectedGroupId) return;
    const socket = (window as any).socket;
    if (socket) {
      socket.emit('send_message', { targetId: selectedGroupId, content: message, type: 'text' });
      setMessage('');
    } else {
      notifications.show({ title: '发送失败', message: '实时连接异常', color: 'red' });
    }
  };

  const MessageItem = (msg: any) => (
    <Group align="flex-start" wrap="nowrap" justify={msg.sender_id === user?.id ? 'flex-end' : 'flex-start'} py="sm" px="md">
      {msg.sender_id !== user?.id && <Avatar src={msg.sender_avatar} radius="md" size="md" />}
      <Box style={{ maxWidth: '70%' }}>
        {msg.sender_id !== user?.id && <Text size="xs" c="dimmed" mb={4} fw={700}>{msg.sender_name}</Text>}
        <Paper p="sm" radius="md" bg={msg.sender_id === user?.id ? 'blue' : 'gray.0'} c={msg.sender_id === user?.id ? 'white' : 'black'}>
          <Text size="sm" style={{ lineHeight: 1.6 }}>{msg.content}</Text>
        </Paper>
        <Text size="xs" c="dimmed" mt={4} style={{ textAlign: msg.sender_id === user?.id ? 'right' : 'left' }}>
          {dayjs(msg.created_at).format('HH:mm')}
        </Text>
      </Box>
      {msg.sender_id === user?.id && <Avatar src={user?.avatar} radius="md" size="md" />}
    </Group>
  );

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: rem(20) }}>
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
        <Box p="md">
          <Group justify="space-between" mb="md">
            <Title order={4} fw={900}>即时通讯 · 极速版</Title>
            <ActionIcon variant="light" color="blue" radius="md"><Plus size={18} /></ActionIcon>
          </Group>
          <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
            <Tabs.List grow>
              <Tabs.Tab value="groups" leftSection={<Users size={14} />} fw={700}>群组</Tabs.Tab>
              <Tabs.Tab value="contacts" leftSection={<MessageSquare size={14} />} fw={700}>私聊</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <TextInput mt="md" placeholder="检索对话..." leftSection={<Search size={14} />} size="sm" radius="md" />
        </Box>
        <Divider />
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          {/* 这里可以使用虚拟列表展示群组，但目前群组数量通常不多，维持原样 */}
          <ScrollArea h="100%">
            <Stack gap={4} p="xs">
              {groups.map((group: any) => (
                <UnstyledButton key={group.id} onClick={() => setSelectedGroupId(group.id)} style={{ padding: rem(12), borderRadius: rem(8), backgroundColor: selectedGroupId === group.id ? 'var(--mantine-color-blue-0)' : 'transparent' }}>
                  <Group wrap="nowrap">
                    <Indicator inline offset={4} position="bottom-end" color="green" withBorder size={12}>
                      <Avatar src={group.avatar} radius="md" size="md">{group.name.charAt(0)}</Avatar>
                    </Indicator>
                    <Box style={{ flex: 1 }}><Text size="sm" fw={900}>{group.name}</Text><Text size="xs" c="dimmed" truncate>{group.last_msg?.content || '...'}</Text></Box>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      </Paper>

      <Paper withBorder radius="lg" shadow="sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedGroupId ? (
          <>
            <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <Group justify="space-between">
                <Group gap="sm">
                  <Avatar src={selectedGroup?.avatar} radius="md" size="sm" />
                  <Box><Text size="sm" fw={900}>{selectedGroup?.name}</Text><Text size="xs" c="emerald" fw={700}>实时连接中</Text></Box>
                </Group>
                <ActionIcon variant="subtle" color="gray"><Settings size={18} /></ActionIcon>
              </Group>
            </Box>

            {/* 规约执行：IM 消息流虚拟化滚动 */}
            <Box style={{ flex: 1 }}>
              <Virtuoso
                ref={virtuosoRef}
                data={messages}
                itemContent={(_, msg) => <MessageItem {...msg} />}
                followOutput="auto"
              />
            </Box>

            <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Group gap="xs" mb="sm">
                <ActionIcon variant="subtle" color="gray"><Smile size={20} /></ActionIcon>
                <ActionIcon variant="subtle" color="gray"><Paperclip size={20} /></ActionIcon>
              </Group>
              <Group wrap="nowrap">
                <TextInput placeholder="消息内容..." style={{ flex: 1 }} size="md" radius="md" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} styles={{ input: { border: '1px solid #64748b' } }} />
                <Button h={44} color="blue" radius="md" px="xl" rightSection={<Send size={16} />} onClick={handleSendMessage} fw={900}>发送</Button>
              </Group>
            </Box>
          </>
        ) : (
          <Stack align="center" justify="center" h="100%"><ThemeIcon size={80} radius={80} variant="light" color="blue"><MessageSquare size={40} /></ThemeIcon><Text fw={900} size="lg">开启物理同步沟通</Text></Stack>
        )}
      </Paper>
    </Box>
  );
};
