import React, { useEffect, useState } from 'react';
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
  Switch, 
  Alert, 
  Modal, 
  FileButton, 
  Progress,
  Divider,
  NumberInput,
  Textarea,
  SimpleGrid
} from '@mantine/core';
import { 
  Search, 
  Plus, 
  Info, 
  ShieldCheck, 
  FileText, 
  Settings, 
  ChevronDown, 
  Calendar, 
  Filter, 
  UploadCloud, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useQualityRules, useQualityActions, useImportQualitySessions } from './api';
import { useJobStatus } from './hooks/useJobStatus';
import { LXTable } from '@/components/common/LXTable';
import { notifications } from '@mantine/notifications';

export const QualityInspection = () => {
  const [activeTab, setActiveTab] = useState<string | null>('rules');
  const [subTab, setSubTab] = useState<string | null>('all');
  const [currentDateRange, setCurrentDateRange] = useState('近7天');
  const [importModalOpened, setImportModalOpened] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category: '',
    description: '',
    criteria: '',
    score_weight: 0,
    is_active: true,
  });

  // TanStack Query
  const { data: rules = [], isLoading, refetch } = useQualityRules({ 
    category: subTab && subTab !== 'all' ? subTab : undefined 
  });
  const { createRule, updateRule, toggleRule } = useQualityActions();
  const importMutation = useImportQualitySessions();

  useEffect(() => {
    if (!editingRule) return;
    setRuleForm({
      name: editingRule.name || '',
      category: editingRule.category || '',
      description: editingRule.description || '',
      criteria: editingRule.criteria || '',
      score_weight: Number(editingRule.score_weight || 0),
      is_active: !!editingRule.is_active,
    });
  }, [editingRule]);

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      category: '',
      description: '',
      criteria: '',
      score_weight: 0,
      is_active: true,
    });
    setEditorOpened(true);
  };

  const openEditRule = (rule: any) => {
    setEditingRule(rule);
    setEditorOpened(true);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) {
      notifications.show({ title: '校验失败', message: '请输入规则名称', color: 'red' });
      return;
    }

    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, payload: ruleForm });
        notifications.show({ title: '更新成功', message: '质检规则已更新', color: 'green' });
      } else {
        await createRule.mutateAsync(ruleForm);
        notifications.show({ title: '新增成功', message: '质检规则已创建', color: 'green' });
      }
      setEditorOpened(false);
      setEditingRule(null);
      refetch();
    } catch (error: any) {
      notifications.show({ title: '保存失败', message: error.response?.data?.message || '质检规则保存失败', color: 'red' });
    }
  };

  // Job 进度监听
  const jobStatus = useJobStatus(activeJobId, (result) => {
    notifications.show({
      title: '全量导入成功',
      message: `已成功处理 ${result.successCount} 条会话记录`,
      color: 'green',
      icon: <CheckCircle2 size={18} />
    });
    setImportModalOpened(false);
    setActiveJobId(null);
    refetch();
  });

  const handleImport = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', '1'); // 示例硬编码，实际应从选择器获取
    formData.append('shop', '1');
    
    try {
      const res = await importMutation.mutateAsync(formData);
      if (res.jobId) {
        setActiveJobId(res.jobId);
      }
    } catch (e) {
      notifications.show({ title: '触发失败', message: '请检查后端队列连接', color: 'red' });
    }
  };

  const columns = [
    {
      key: 'name',
      title: '质检点',
      width: 240,
      render: (record: any) => (
        <Group gap="xs">
          <Text size="sm" fw={700}>{record.name}</Text>
          <Badge size="xs" variant="light" color="blue">官</Badge>
          <Group gap={4}>
            <ActionIcon size="xs" variant="subtle" color="gray"><ShieldCheck size={12} /></ActionIcon>
            <ActionIcon size="xs" variant="subtle" color="gray"><Info size={12} /></ActionIcon>
            <ActionIcon size="xs" variant="subtle" color="blue"><Plus size={12} /></ActionIcon>
          </Group>
        </Group>
      )
    },
    {
      key: 'score_weight',
      title: '分值',
      align: 'left' as const,
      width: 120,
      render: (record: any) => (
        <Group gap="xs">
          <Text size="sm" fw={700}>扣：{record.score_weight}</Text>
          <ActionIcon size="xs" variant="subtle" color="gray"><Settings size={12} /></ActionIcon>
        </Group>
      )
    },
    {
      key: 'description',
      title: '质检标准',
      render: (record: any) => (
        <Stack gap={2}>
          <Text size="sm" fw={700}>{record.name}-工业重构版</Text>
          <Text size="xs" c="dimmed">标准依据：{record.criteria || '系统默认准则'}</Text>
        </Stack>
      )
    },
    {
      key: 'is_active',
      title: '全自动运行',
      align: 'center' as const,
      width: 120,
      render: (record: any) => (
        <Switch 
          checked={!!record.is_active} 
          size="sm"
          onChange={(e) => toggleRule.mutate({ id: record.id, is_enabled: e.currentTarget.checked })}
        />
      )
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center' as const,
      render: (record: any) => (
        <Group gap="xs" justify="center">
          <Button variant="transparent" size="compact-xs" color="blue" fw={700} onClick={() => openEditRule(record)}>编辑</Button>
          <Button variant="transparent" size="compact-xs" color="blue" fw={700} rightSection={<ChevronDown size={12} />}>更多</Button>
        </Group>
      )
    }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="records" leftSection={<FileText size={16} />} w="100%" fw={700} h={44}>会话质检流</Tabs.Tab>
            <Tabs.Tab value="rules" leftSection={<ShieldCheck size={16} />} w="100%" fw={700} h={44}>评分项管理</Tabs.Tab>
            <Tabs.Tab value="import" leftSection={<UploadCloud size={16} />} w="100%" fw={700} h={44} onClick={() => setImportModalOpened(true)}>批量导入</Tabs.Tab>
            <Tabs.Tab value="config" leftSection={<Settings size={16} />} w="100%" fw={700} h={44}>申诉工作流</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>质检巅峰优化平台</Title>
            <Group gap="md">
              <Button color="blue" radius="md" size="md" leftSection={<Plus size={18} />} fw={900}>
                新增质检评分项
              </Button>
            </Group>
          </Group>
          <Group justify="flex-end" mb="sm">
            <Button variant="outline" color="blue" radius="md" leftSection={<Plus size={16} />} onClick={openCreateRule}>
                新增质检评分项
              </Button>
          </Group>

          <Alert variant="light" color="blue" icon={<Info size={16} />} mb="lg" radius="md">
            核心规约已生效：所有批量操作已自动路由至后台 <Text span fw={900}>BullMQ</Text> 异步队列。
          </Alert>

          {/* 搜索布局：全铺满自适应 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select placeholder="业务类型" data={['电商', '金融']} style={{ flexGrow: 1 }} size="md" radius="md" />
            <TextInput placeholder="快速检索评分规则..." leftSection={<Search size={16} />} style={{ flexGrow: 2 }} size="md" radius="md" />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable columns={columns} data={rules} loading={isLoading} />
          </Paper>
        </Paper>

        {/* 规约执行：快捷日期组 (44px, slate-500 边框) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', 
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['今天', '昨天', '近7天', '近30天', '本月'].map((label, idx) => (
                <Button 
                  key={label}
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg"
                  fw={700}
                  onClick={() => {
                    setCurrentDateRange(label);
                    refetch(); // 联动搜索
                  }}
                  styles={{
                    root: {
                      borderRight: idx === 4 ? 0 : '1px solid #64748b',
                      backgroundColor: currentDateRange === label ? '#f1f5f9' : 'transparent',
                      color: currentDateRange === label ? '#1e293b' : '#64748b'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Calendar size={16} />}>
                时间范围自定义
              </Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Filter size={16} />} fw={900}>
                开启全域高性能检索
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>

      {/* 异步导入弹窗 */}
      <Modal 
        opened={importModalOpened} 
        onClose={() => !activeJobId && setImportModalOpened(false)}
        title={<Group gap="xs"><UploadCloud size={20} /><Text fw={900}>异步导入会话中心</Text></Group>}
        centered
        radius="lg"
      >
        <Stack>
          {!activeJobId ? (
            <Box style={{ border: '2px dashed #e2e8f0', borderRadius: rem(12), padding: rem(40), textAlign: 'center' }}>
              <FileButton onChange={handleImport} accept=".xlsx,.xls">
                {(props) => (
                  <Button {...props} variant="light" color="blue" size="lg" radius="md" leftSection={<UploadCloud size={20} />}>
                    选择 Excel 文件并触发后台任务
                  </Button>
                )}
              </FileButton>
              <Text size="xs" c="dimmed" mt="md">支持大规模会话流导入，任务将在后台执行</Text>
            </Box>
          ) : (
            <Stack p="xl">
              <Group justify="space-between">
                <Text size="sm" fw={900}>后台处理中...</Text>
                <Text size="sm" fw={900} c="blue">{jobStatus?.progress || 0}%</Text>
              </Group>
              <Progress value={jobStatus?.progress || 0} animated color="blue" size="xl" radius="xl" />
              <Alert color="blue" icon={<Info size={16} />} variant="light">
                任务已托管至 Redis 队列，您可以关闭此窗口，处理完成后系统将自动通知。
              </Alert>
            </Stack>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={editorOpened}
        onClose={() => {
          setEditorOpened(false);
          setEditingRule(null);
        }}
        title={<Text fw={900}>{editingRule ? '编辑质检规则' : '新增质检规则'}</Text>}
        centered
        size="lg"
      >
        <Stack gap="md">
          <TextInput label="规则名称" value={ruleForm.name} onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.currentTarget.value }))} required />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="业务分类" value={ruleForm.category} onChange={(e) => setRuleForm((prev) => ({ ...prev, category: e.currentTarget.value }))} />
            <NumberInput label="扣分值" value={ruleForm.score_weight} onChange={(value) => setRuleForm((prev) => ({ ...prev, score_weight: Number(value || 0) }))} />
          </SimpleGrid>
          <Textarea label="规则描述" minRows={2} value={ruleForm.description} onChange={(e) => setRuleForm((prev) => ({ ...prev, description: e.currentTarget.value }))} />
          <Textarea label="判定标准" minRows={4} value={ruleForm.criteria} onChange={(e) => setRuleForm((prev) => ({ ...prev, criteria: e.currentTarget.value }))} />
          <Switch label="启用规则" checked={ruleForm.is_active} onChange={(e) => setRuleForm((prev) => ({ ...prev, is_active: e.currentTarget.checked }))} />
          <Group justify="flex-end">
            <Button variant="outline" color="gray" onClick={() => {
              setEditorOpened(false);
              setEditingRule(null);
            }}>
              取消
            </Button>
            <Button color="blue" onClick={handleSaveRule} loading={createRule.isPending || updateRule.isPending}>
              {editingRule ? '保存修改' : '创建规则'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};
