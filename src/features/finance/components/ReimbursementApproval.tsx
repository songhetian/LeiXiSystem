import React, { useState } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Select, Button, Badge, 
  ActionIcon, Tooltip, Stack, SimpleGrid, Divider, rem, ThemeIcon, 
  Modal, Textarea, RefreshCw, Search, Eye, CheckCircle2, XCircle, Filter
} from '@mantine/core';
import { useReimbursements, useReimbursementActions } from '../api';
import { useWorkflowActions } from '../workflow/api';
import { LXTable } from '@/components/common/LXTable';
import { notifications } from '@mantine/notifications';

export const ReimbursementApproval = () => {
  const [filters, setFilters] = useState({ status: 'pending', keyword: '' });
  const [page, setPage] = useState(1);
  const [decisionModal, setDecisionModal] = useState<{ opened: boolean; record: any; action: string }>({
    opened: false, record: null, action: ''
  });
  const [opinion, setOpinion] = useState('');

  const { data, isLoading, refetch } = useReimbursements({ ...filters, page, limit: 10 });
  const { decide } = useWorkflowActions();

  const handleDecision = async () => {
    if (!decisionModal.record) return;
    if (decisionModal.action === 'rejected' && !opinion.trim()) {
      notifications.show({ title: '决策受阻', message: '驳回操作必须填写审批意见', color: 'red' });
      return;
    }

    try {
      await decide.mutateAsync({
        targetId: decisionModal.record.id,
        action: decisionModal.action,
        opinion
      });
      notifications.show({ title: '决策已生效', message: '单据状态已物理更新并同步存证', color: 'green' });
      setDecisionModal({ opened: false, record: null, action: '' });
      setOpinion('');
      refetch();
    } catch (e) {
      notifications.show({ title: '执行失败', message: '后端事务处理异常', color: 'red' });
    }
  };

  const columns = [
    { 
      key: 'title', title: '申报摘要', 
      render: (r: any) => (
        <Stack gap={0}>
          <Text size="sm" fw={900}>{r.title}</Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>#{r.reimbursement_no}</Text>
        </Stack>
      )
    },
    { key: 'applicant', title: '申请人', render: (r: any) => <Text size="xs" fw={700}>{r.applicant_name}</Text> },
    { key: 'amount', title: '金额', align: 'right' as const, render: (r: any) => <Text size="sm" fw={900} style={{ fontFamily: 'monospace' }}>¥ {r.total_amount.toLocaleString()}</Text> },
    {
      key: 'actions', title: '决策操作', align: 'center' as const,
      render: (r: any) => (
        <Group gap={4} justify="center">
          <Button variant="filled" color="emerald" size="compact-xs" onClick={() => setDecisionModal({ opened: true, record: r, action: 'approved' })}>通过</Button>
          <Button variant="filled" color="red" size="compact-xs" onClick={() => setDecisionModal({ opened: true, record: r, action: 'rejected' })}>驳回</Button>
        </Group>
      )
    }
  ];

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="lg" shadow="xs">
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={4} fw={900}>财务决策中心</Title>
            <Text size="xs" c="dimmed">基于 100% 物理还原的审批流引擎</Text>
          </Box>
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => refetch()} loading={isLoading}><RefreshCw size={18} /></ActionIcon>
        </Group>

        <Divider mb="lg" />

        {/* 规约执行：单行全铺满自适应搜索 */}
        <Group wrap="nowrap" gap="md" mb="xl">
          <Select placeholder="决策状态" data={['pending', 'approved', 'rejected']} style={{ flexGrow: 1 }} size="md" radius="md" value={filters.status} onChange={(v) => setFilters(p => ({ ...p, status: v || 'pending' }))} />
          <TextInput placeholder="检索申报人 / 摘要 / 单号..." leftSection={<Search size={16} />} style={{ flexGrow: 2 }} size="md" radius="md" value={filters.keyword} onChange={(e) => setFilters(p => ({ ...p, keyword: e.target.value }))} />
        </Group>

        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <LXTable columns={columns} data={data?.data || []} loading={isLoading} pagination={{ current: page, pageSize: 10, total: data?.total || 0, onChange: setPage }} />
        </Paper>
      </Paper>

      {/* 规约执行：快捷日期组 (44px, slate-500 边框) 物理缝合 */}
      <Paper withBorder p="xs" radius="lg" shadow="sm">
        <Group justify="space-between">
          <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
            {['今天', '本周', '本月', '全部历史'].map((label, idx) => (
              <Button key={label} variant="subtle" color="gray" radius={0} h="100%" px="lg" fw={700} styles={{ root: { borderRight: idx === 3 ? 0 : '1px solid #64748b', backgroundColor: label === '今天' ? '#f1f5f9' : 'transparent' } }}>{label}</Button>
            ))}
          </Group>
          <Group gap="md">
            <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>高级审计筛选</Button>
            <Button color="blue" radius="md" h={44} leftSection={<CheckCircle2 size={16} />} fw={900}>一键物理通过</Button>
          </Group>
        </Group>
      </Paper>

      <Modal 
        opened={decisionModal.opened} 
        onClose={() => setDecisionModal({ opened: false, record: null, action: '' })}
        title={<Group gap="xs"><ThemeIcon variant="light" color={decisionModal.action === 'approved' ? 'emerald' : 'red'} size="sm">{decisionModal.action === 'approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}</ThemeIcon><Text fw={900}>执行物理决策</Text></Group>}
        centered radius="lg"
      >
        <Stack>
          <Box p="md" bg="gray.0" style={{ borderRadius: rem(12), border: '1px solid var(--mantine-color-gray-2)' }}>
            <Text size="xs" c="dimmed">摘要：{decisionModal.record?.title}</Text>
            <Text size="xs" c="indigo" fw={700}>单号：{decisionModal.record?.reimbursement_no}</Text>
          </Box>
          <Textarea label="审批意见" placeholder="请输入决策理由..." minRows={3} value={opinion} onChange={(e) => setOpinion(e.target.value)} required={decisionModal.action === 'rejected'} />
          <Button color={decisionModal.action === 'approved' ? 'emerald' : 'red'} fullWidth mt="md" fw={900} onClick={handleDecision} loading={decide.isPending}>确认并执行逻辑闭环</Button>
        </Stack>
      </Modal>
    </Stack>
  );
};
