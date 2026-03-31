import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Group, 
  Title, 
  Text, 
  Select, 
  TextInput,
  Button, 
  Badge, 
  ActionIcon, 
  Tooltip,
  Stack,
  Divider,
  Menu,
  rem,
  ThemeIcon,
  Modal
} from '@mantine/core';
import { 
  FileSpreadsheet, 
  Filter, 
  RefreshCw, 
  Eye, 
  Search,
  Send, 
  Trash2, 
  Undo2,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical
} from 'lucide-react';
import { useReimbursements, useReimbursementActions } from '../api';
import { LXTable } from '@/components/common/LXTable';
import { openLXConfirm } from '@/core/utils/modals';
import { useAuthStore } from '@/core/store/auth';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ReimbursementDetailModal } from './ReimbursementDetailModal';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: '未提交', color: 'gray', icon: Clock },
  pending: { label: '待审批', color: 'orange', icon: Clock },
  approving: { label: '流转中', color: 'blue', icon: RefreshCw },
  approved: { label: '已核销', color: 'emerald', icon: CheckCircle2 },
  rejected: { label: '已驳回', color: 'red', icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  travel: '差旅报销',
  office: '办公费用',
  entertainment: '商务招待',
  training: '学习培训',
  other: '其它杂项'
};

export const ReimbursementList = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: 'all', keyword: '', page: 1 });
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useReimbursements(filters);
  const { remove, submit, cancel } = useReimbursementActions();

  // 规约执行：物理替换为巅峰质感确认框
  const handleAction = async (action: 'submit' | 'cancel' | 'delete', id: number) => {
    if (action === 'submit') {
      openLXConfirm({
        title: '提交报销单',
        message: '提交后单据将进入审批流，当前草稿将不可继续直接编辑。确认继续吗？',
        confirmLabel: '确认提交',
        onConfirm: async () => {
          try {
            await submit.mutateAsync(id);
            notifications.show({ title: '提交成功', message: '报销单已进入审批流程', color: 'green' });
            refetch();
          } catch (e: any) {
            notifications.show({ title: '提交失败', message: e.response?.data?.message || '提交异常', color: 'red' });
          }
        },
      });
      return;
    }

    if (action === 'cancel') {
      openLXConfirm({
        title: '撤回报销申请',
        message: '撤回后该单据将标记为已取消，需要重新创建或复制后再次提交。确认撤回吗？',
        confirmLabel: '确认撤回',
        onConfirm: async () => {
          try {
            await cancel.mutateAsync(id);
            notifications.show({ title: '撤回成功', message: '报销单已取消', color: 'green' });
            refetch();
          } catch (e: any) {
            notifications.show({ title: '撤回失败', message: e.response?.data?.message || '撤回异常', color: 'red' });
          }
        },
      });
      return;
    }

    if (action === 'delete') {
      openLXConfirm({
        title: '报销单据物理注销',
        message: '确定要彻底删除此报销单及其关联的附件存证吗？此操作无法通过撤销机制找回。',
        confirmLabel: '执行物理删除',
        isDangerous: true,
        onConfirm: async () => {
          try {
            await remove.mutateAsync(id);
            notifications.show({ title: '删除成功', message: '单据已从物理磁盘移除', color: 'green' });
            refetch();
          } catch (e) {
            notifications.show({ title: '删除失败', message: '权限不足或系统异常', color: 'red' });
          }
        },
      });
      return;
    }
    // 其他逻辑...
  };

  const columns = [
    { 
      key: 'no', 
      title: '单据编号', 
      render: (r: any) => (
        <Group gap="xs">
          <ThemeIcon variant="light" color="indigo" size="sm" radius="md"><Clock size={14} /></ThemeIcon>
          <Text size="xs" fw={900} style={{ fontFamily: 'monospace' }}>#{r.reimbursement_no}</Text>
        </Group>
      )
    },
    { key: 'title', title: '报销摘要', render: (r: any) => <Text size="sm" fw={700}>{r.title}</Text> },
    { 
      key: 'amount', 
      title: '申报金额', 
      align: 'right' as const,
      render: (r: any) => (
        <Text size="sm" fw={900} c="indigo" style={{ fontFamily: 'monospace' }}>
          ¥ {r.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ) 
    },
    { 
      key: 'status', 
      title: '当前状态', 
      align: 'center' as const,
      render: (r: any) => {
        const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
        return <Badge variant="light" color={config.color} radius="sm">{config.label}</Badge>;
      } 
    },
    { key: 'time', title: '申请日期', render: (r: any) => dayjs(r.created_at).format('YYYY-MM-DD') },
    {
      key: 'actions',
      title: '操作中枢',
      align: 'center' as const,
      render: (r: any) => (
        <Group gap={4} justify="center">
          <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => setDetailId(r.id)}><Eye size={16} /></ActionIcon>
          {r.status === 'draft' && (
            <ActionIcon variant="subtle" color="indigo" size="sm" onClick={() => navigate(`/app/reimbursement-apply?id=${r.id}`)}><FileSpreadsheet size={16} /></ActionIcon>
          )}
          {r.status === 'draft' && (
            <ActionIcon variant="subtle" color="emerald" size="sm" onClick={() => handleAction('submit', r.id)}><Send size={16} /></ActionIcon>
          )}
          {['pending', 'approving'].includes(r.status) && (
            <ActionIcon variant="subtle" color="orange" size="sm" onClick={() => handleAction('cancel', r.id)}><Undo2 size={16} /></ActionIcon>
          )}
          {r.status === 'draft' && (
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleAction('delete', r.id)}><Trash2 size={16} /></ActionIcon>
          )}
        </Group>
      )
    }
  ];

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="lg" shadow="xs">
        <Group justify="space-between" mb="md">
          <Group gap="md">
            <ThemeIcon variant="filled" color="blue" size="lg" radius="md"><FileSpreadsheet size={20} /></ThemeIcon>
            <Box>
              <Text size="sm" fw={900}>财务申报明细</Text>
              <Text size="xs" c="dimmed" fw={700}>Financial Audit Trails</Text>
            </Box>
          </Group>
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => refetch()} loading={isLoading}><RefreshCw size={18} /></ActionIcon>
        </Group>
        <Divider mb="lg" />
        <Group wrap="nowrap" gap="md">
          <Select 
            placeholder="单据状态" 
            data={['all', 'draft', 'pending', 'approved', 'rejected']} 
            style={{ flexGrow: 1 }}
            size="md"
            radius="md"
            value={filters.status}
            onChange={(val) => setFilters(prev => ({ ...prev, status: val || 'all' }))}
          />
          <TextInput 
            placeholder="搜索摘要 / 单号..." 
            leftSection={<Search size={16} />}
            style={{ flexGrow: 2 }}
            size="md"
            radius="md"
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.currentTarget.value }))}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
        <LXTable columns={columns} data={data?.data || []} loading={isLoading} pagination={{ current: filters.page, pageSize: 10, total: data?.total || 0, onChange: (p) => setFilters(prev => ({ ...prev, page: p })) }} />
      </Paper>

      <ReimbursementDetailModal id={detailId} opened={detailId !== null} onClose={() => setDetailId(null)} />
    </Stack>
  );
};
