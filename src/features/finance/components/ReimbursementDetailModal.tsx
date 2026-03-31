import React from 'react';
import { Modal, Text, Group, Loader, Stack, Box, Badge, Divider, Paper } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '@/core/api';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '未提交', color: 'gray' },
  pending: { label: '待审批', color: 'orange' },
  approving: { label: '流转中', color: 'blue' },
  approved: { label: '已核销', color: 'emerald' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已取消', color: 'dark' },
};

const TYPE_LABELS: Record<string, string> = {
  travel: '差旅报销',
  office: '办公费用',
  entertainment: '商务招待',
  training: '学习培训',
  other: '其它杂项'
};

export const ReimbursementDetailModal = ({
  id,
  opened,
  onClose,
}: {
  id: number | null;
  opened: boolean;
  onClose: () => void;
}) => {
  const reimbursementDetail = useQuery({
    queryKey: ['reimbursement', 'detail', id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any }>(`/reimbursement/${id}`);
      return response.data.data;
    },
    enabled: opened && id !== null,
  });

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={900}>报销单详情</Text>} size="lg" centered>
      {reimbursementDetail.isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="blue" />
        </Group>
      ) : reimbursementDetail.data ? (
        <Stack gap="md">
          <Group justify="space-between">
            <Box>
              <Text size="sm" c="dimmed">单据编号</Text>
              <Text fw={900}>#{reimbursementDetail.data.reimbursement_no}</Text>
            </Box>
            <Badge variant="light" color={STATUS_CONFIG[reimbursementDetail.data.status]?.color || 'gray'}>
              {STATUS_CONFIG[reimbursementDetail.data.status]?.label || reimbursementDetail.data.status}
            </Badge>
          </Group>
          <SimpleField label="报销标题" value={reimbursementDetail.data.title} />
          <SimpleField label="报销类型" value={TYPE_LABELS[reimbursementDetail.data.type] || reimbursementDetail.data.type} />
          <SimpleField label="申请部门" value={reimbursementDetail.data.department_name || '-'} />
          <SimpleField label="申请人" value={reimbursementDetail.data.applicant_name || '-'} />
          <SimpleField label="申请金额" value={`¥ ${Number(reimbursementDetail.data.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <SimpleField label="创建时间" value={dayjs(reimbursementDetail.data.created_at).format('YYYY-MM-DD HH:mm:ss')} />
          <Divider />
          <Stack gap="xs">
            <Text fw={900}>费用明细</Text>
            {(reimbursementDetail.data.items || []).length > 0 ? (
              reimbursementDetail.data.items.map((item: any) => (
                <Paper key={item.id} withBorder p="sm" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text fw={700}>{item.item_type}</Text>
                      <Text size="xs" c="dimmed">{item.description || '无备注'}</Text>
                    </Box>
                    <Text fw={900}>¥ {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Group>
                </Paper>
              ))
            ) : (
              <Text size="sm" c="dimmed">暂无明细</Text>
            )}
          </Stack>
        </Stack>
      ) : (
        <Text c="dimmed">未找到该报销单详情。</Text>
      )}
    </Modal>
  );
};

const SimpleField = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Text size="sm" c="dimmed">{label}</Text>
    <Text fw={700}>{value}</Text>
  </Box>
);
