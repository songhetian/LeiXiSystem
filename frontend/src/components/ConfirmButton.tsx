'use client';
import { Button, Modal } from '@arco-design/web-react';
import { ReactNode } from 'react';

interface ConfirmButtonProps {
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
  title?: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  disabled?: boolean;
  type?: 'primary' | 'secondary' | 'dashed' | 'outline' | 'text';
  status?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'mini' | 'small' | 'default' | 'large';
}

/**
 * 带二次确认的按钮组件。
 * 点击后弹出 Modal.confirm，确认后执行 onConfirm（支持异步）。
 */
export function ConfirmButton({
  children,
  onConfirm,
  title = '确认操作',
  content = '确定要执行此操作吗？此操作不可撤销。',
  okText = '确定',
  cancelText = '取消',
  disabled,
  type = 'text',
  status = 'default',
  size = 'small',
}: ConfirmButtonProps) {
  return (
    <Button
      type={type}
      status={status}
      size={size}
      disabled={disabled}
      onClick={() => {
        Modal.confirm({
          title,
          content,
          okText,
          cancelText,
          onOk: async () => {
            await onConfirm();
          },
        });
      }}
    >
      {children}
    </Button>
  );
}

export default ConfirmButton;
