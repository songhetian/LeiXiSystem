import React from 'react';
import { modals } from '@mantine/modals';
import { Text, Stack, Group, Button, rem } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isDangerous?: boolean;
}

/**
 * 雷犀系统标准确认弹窗
 * 严格执行 44px 按钮组与物理缝合边框规应
 */
export const openLXConfirm = ({
  title,
  message,
  confirmLabel = '确认执行',
  cancelLabel = '放弃操作',
  onConfirm,
  isDangerous = false
}: ConfirmOptions) => {
  modals.openConfirmModal({
    title: (
      <Group gap="xs">
        <AlertTriangle size={20} color={isDangerous ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-blue-filled)'} />
        <Text fw={900}>{title}</Text>
      </Group>
    ),
    centered: true,
    radius: 'lg',
    children: (
      <Stack gap="md" py="md">
        <Text size="sm" fw={700} c="dimmed">
          {message}
        </Text>
        {isDangerous && (
          <Text size="xs" c="red" fw={900} p="xs" bg="red.0" style={{ borderRadius: rem(8), border: '1px dashed var(--mantine-color-red-2)' }}>
            警告：此操作涉及物理数据抹除，一旦执行将无法通过撤销机制找回。
          </Text>
        )}
      </Stack>
    ),
    labels: { confirm: confirmLabel, cancel: cancelLabel },
    // 规约执行：强制 44px 高度与边框样式
    confirmProps: { 
      color: isDangerous ? 'red' : 'blue', 
      h: 44, 
      radius: 'md',
      fw: 900,
      style: { flex: 1 }
    },
    cancelProps: { 
      variant: 'outline', 
      color: 'gray', 
      h: 44, 
      radius: 'md',
      fw: 700,
      style: { 
        flex: 1,
        border: '1px solid #64748b' // 严格锁定 slate-500
      }
    },
    onConfirm,
  });
};
