import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Group, 
  Title, 
  Text, 
  TextInput, 
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
  Card,
  Avatar,
  ScrollArea
} from '@mantine/core';
import { 
  Library, 
  BookOpen, 
  History, 
  Search, 
  Plus, 
  RefreshCw, 
  Eye, 
  ThumbsUp, 
  Trash2,
  Settings,
  Filter,
  FileText,
  Calendar
} from 'lucide-react';
import { useKnowledgeCategories, useKnowledgeArticles, useKnowledgeActions } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

export const KnowledgeBase = () => {
  const [activeTab, setActiveTab] = useState<string | null>('public');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: categories = [], isLoading: loadingCats } = useKnowledgeCategories();
  const { data: articles, isLoading: loadingArticles, refetch } = useKnowledgeArticles({
    category_id: selectedCategory || undefined,
    search
  });

  const columns = [
    { 
      key: 'title', 
      title: '文档标题', 
      render: (r: any) => (
        <Group gap="sm">
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            <FileText size={16} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={900}>{r.title}</Text>
            <Text size="xs" c="dimmed" truncate>{r.summary || '暂无摘要'}</Text>
          </Box>
        </Group>
      )
    },
    { key: 'category', title: '所属分类', render: (r: any) => <Badge variant="light" color="gray">{r.category_name || '未分类'}</Badge> },
    { 
      key: 'stats', 
      title: '热度', 
      render: (r: any) => (
        <Group gap="md">
          <Group gap={4} c="dimmed"><Eye size={12} /><Text size="xs">{r.view_count}</Text></Group>
          <Group gap={4} c="dimmed"><ThumbsUp size={12} /><Text size="xs">{r.like_count}</Text></Group>
        </Group>
      ) 
    },
    { key: 'time', title: '发布日期', render: (r: any) => dayjs(r.created_at).format('YYYY-MM-DD') },
    {
      key: 'actions',
      title: '操作',
      align: 'center' as const,
      render: () => (
        <Group gap={4} justify="center">
          <Button variant="subtle" size="compact-xs" fw={700}>阅读</Button>
          <ActionIcon variant="subtle" color="gray"><Settings size={16} /></ActionIcon>
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
            <Tabs.Tab value="public" leftSection={<Library size={16} />} w="100%" fw={700} h={44}>公共知识库</Tabs.Tab>
            <Tabs.Tab value="my" leftSection={<BookOpen size={16} />} w="100%" fw={700} h={44}>个人笔记</Tabs.Tab>
            <Tabs.Tab value="recycle" leftSection={<Trash2 size={16} />} w="100%" fw={700} h={44}>回收站</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>知识中枢 · 巅峰版</Title>
            <Button color="blue" radius="md" size="md" leftSection={<Plus size={18} />} fw={900}>
              创建新文档
            </Button>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select 
              placeholder="选择分类" 
              data={categories.map((c: any) => ({ value: String(c.id), label: c.name }))} 
              style={{ flexGrow: 1 }}
              size="md"
              radius="md"
              clearable
              onChange={setSelectedCategory}
            />
            <TextInput 
              placeholder="搜索文档标题 / 关键字 / 内容..." 
              leftSection={<Search size={16} />}
              style={{ flexGrow: 2 }}
              size="md"
              radius="md"
              onChange={(e) => setSearch(e.target.value)}
            />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={loadingArticles}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable columns={columns} data={articles?.data || []} loading={loadingArticles} />
          </Paper>
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
              {['全部文档', '新手指南', '业务话术', '异常处理'].map((label, idx) => (
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
                      backgroundColor: label === '全部文档' ? '#f1f5f9' : 'transparent'
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
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>
                设定阅读有效期
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
