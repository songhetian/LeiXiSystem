import React, { useMemo } from 'react';
import { 
  Box, Paper, Stack, Group, Title, Text, TextInput, Select, NumberInput, 
  Button, ActionIcon, Divider, Card, ScrollArea, rem, Alert, ThemeIcon, 
  SimpleGrid, FileButton, Progress
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm, zodResolver } from '@mantine/form';
import { 
  FileText, CreditCard, Plus, Trash2, Send, Save, AlertCircle, 
  UploadCloud, ImageIcon, CheckCircle2
} from 'lucide-react';
import { createReimbursementSchema, CreateReimbursementInput } from '../types';
import { useReimbursementTypes, useReimbursementActions } from '../api';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

export const ReimbursementApply = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { data: types = [] } = useReimbursementTypes();
  const { create } = useReimbursementActions();

  const form = useForm<CreateReimbursementInput>({
    initialValues: {
      title: `${dayjs().format('YYYY年MM月')}报销申请`,
      type: '',
      remark: '',
      amount: 0,
      status: 'pending',
      items: [{ item_type: '', amount: 0, date: dayjs().toISOString(), description: '', attachment_url: '' }],
      attachments: []
    },
    validate: zodResolver(createReimbursementSchema),
  });

  const totalAmount = useMemo(() => 
    form.values.items.reduce((sum, item) => sum + (item.amount || 0), 0),
    [form.values.items]
  );

  const handleFormSubmit = async (status: 'draft' | 'pending') => {
    form.setFieldValue('status', status);
    form.setFieldValue('amount', totalAmount);
    
    const validation = form.validate();
    if (validation.hasErrors && status === 'pending') {
      notifications.show({ title: '校验失败', message: '请检查费用明细是否完整', color: 'red' });
      return;
    }

    try {
      await create.mutateAsync({ ...form.values, status, amount: totalAmount });
      notifications.show({ 
        title: '物理存证成功', 
        message: status === 'draft' ? '草稿已存入 Redis' : '申请已推入审批流异步存证', 
        color: 'green',
        icon: <CheckCircle2 size={18} />
      });
      form.reset();
      onSuccess?.();
    } catch (e) {
      notifications.show({ title: '提交失败', message: '后端事务链路异常', color: 'red' });
    }
  };

  return (
    <Box style={{ height: 'calc(100vh - 180px)', display: 'flex', gap: rem(24) }}>
      {/* 规约执行：侧边信息物理隔离 */}
      <Paper withBorder p="xl" radius="lg" shadow="xs" style={{ width: 340, shrink: 0 }}>
        <Stack gap="xl">
          <Group gap="sm">
            <ThemeIcon variant="light" color="indigo" size="lg" radius="md">
              <FileText size={20} />
            </ThemeIcon>
            <Title order={4} fw={900}>基本申报存证</Title>
          </Group>

          <TextInput label="单据总标题" placeholder="12月办公费..." required {...form.getInputProps('title')} size="md" radius="md" />
          <Select 
            label="业务分类" 
            placeholder="请选择" 
            required
            data={types.map(t => ({ value: t.code, label: t.name }))}
            {...form.getInputProps('type')}
            size="md"
            radius="md"
          />
          <Textarea label="申报备注" placeholder="简单说明情况..." {...form.getInputProps('remark')} size="md" radius="md" minRows={3} />

          <Paper p="md" radius="md" bg="blue.0" style={{ border: '1px dashed var(--mantine-color-blue-3)' }}>
            <Stack align="center" gap="xs">
              <UploadCloud size={24} color="var(--mantine-color-blue-6)" />
              <Text size="xs" fw={900} c="blue">总凭证归档 (异步上传)</Text>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      {/* 明细申报区 */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Paper withBorder p="lg" radius="lg" shadow="xs" mb="md" style={{ borderLeft: '6px solid var(--mantine-color-indigo-6)' }}>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={900}>费用对冲明细</Text>
              <Text size="xs" c="dimmed" fw={700}>物理还原：每一项均需关联有效的电子发票存证</Text>
            </Box>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={900} c="dimmed">核销总计</Text>
              <Text size="xl" fw={900} c="indigo" style={{ fontFamily: 'monospace' }}>¥ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </Box>
          </Group>
        </Paper>

        <ScrollArea flex={1} scrollbars="y" pr="md">
          <Stack gap="md">
            {form.values.items.map((_, index) => (
              <Card key={index} withBorder radius="lg" p="lg" shadow="sm">
                <Group justify="space-between" mb="lg">
                  <Badge variant="filled" color="dark" size="sm" radius="sm">存证条目 #{index + 1}</Badge>
                  <ActionIcon variant="subtle" color="red" onClick={() => form.values.items.length > 1 && form.removeListItem('items', index)}><Trash2 size={16} /></ActionIcon>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
                  <Select label="费用类型" placeholder="请选择" data={['交通费', '餐饮费', '住宿费', '其它']} {...form.getInputProps(`items.${index}.item_type`)} size="sm" radius="md" />
                  <NumberInput label="申报金额" prefix="¥ " placeholder="0.00" hideControls {...form.getInputProps(`items.${index}.amount`)} size="sm" radius="md" />
                  <DateInput label="产生日期" placeholder="选择日期" {...form.getInputProps(`items.${index}.date`)} size="sm" radius="md" />
                  <TextInput label="用途备注" placeholder="说明用途..." {...form.getInputProps(`items.${index}.description`)} size="sm" radius="md" />
                </SimpleGrid>
              </Card>
            ))}

            <Button 
              variant="dashed" 
              fullWidth 
              h={80} 
              radius="lg" 
              leftSection={<Plus size={18} />}
              onClick={() => form.insertListItem('items', { item_type: '', amount: 0, date: dayjs().toISOString(), description: '', attachment_url: '' })}
              styles={{ inner: { fontSize: rem(14), fontWeight: 900 } }}
            >
              新增核销条目
            </Button>
          </Stack>
        </ScrollArea>

        {/* 规约执行：44px 快捷按钮组 (物理缝合 & slate-500 边框) */}
        <Paper withBorder p="md" radius="lg" shadow="md" mt="md">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="sm"><AlertCircle size={14} /></ThemeIcon>
              <Text size="xs" fw={900} c="dimmed">规约：请确认所有发票均已物理扫描并同步至 OSS</Text>
            </Group>
            
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              <Button variant="subtle" color="gray" radius={0} h="100%" px="xl" fw={900} onClick={() => handleFormSubmit('draft')} loading={create.isPending}>
                暂存至草稿
              </Button>
              <Button color="indigo" radius={0} h="100%" px={40} leftSection={<Send size={16} />} onClick={() => handleFormSubmit('pending')} loading={create.isPending} fw={900} style={{ borderLeft: '1px solid #64748b' }}>
                物理提交审批流
              </Button>
            </Group>
          </Group>
        </Paper>
      </Box>
    </Box>
  );
};

import { Textarea as MantineTextarea } from '@mantine/core';
const Textarea = MantineTextarea;
