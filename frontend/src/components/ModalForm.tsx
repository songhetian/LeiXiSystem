'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select } from '@arco-design/web-react';

const FormItem = Form.Item;

export interface FormFieldOption {
  value: string | number;
  label: string;
}

export interface FormFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select';
  placeholder?: string;
  options?: FormFieldOption[];
  required?: boolean;
  disabled?: boolean;
}

export interface ModalFormProps {
  visible: boolean;
  title: string;
  fields: FormFieldConfig[];
  initialValues?: Record<string, any>;
  onOk: (values: Record<string, any>) => void | Promise<void>;
  onCancel: () => void;
  confirmLoading?: boolean;
  okText?: string;
  cancelText?: string;
  width?: number | string;
}

export default function ModalForm({
  visible,
  title,
  fields,
  initialValues = {},
  onOk,
  onCancel,
  confirmLoading = false,
  okText = '确定',
  cancelText = '取消',
  width = 600,
}: ModalFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);

  useEffect(() => {
    if (visible) {
      setValues(initialValues || {});
    }
  }, [visible, initialValues]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleOk = () => {
    onOk(values);
  };

  const renderField = (field: FormFieldConfig) => {
    const value = values[field.key];

    switch (field.type) {
      case 'select':
        return (
          <Select
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择'}
            value={value}
            options={field.options || []}
            disabled={field.disabled}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
      case 'input':
      default:
        return (
          <Input
            placeholder={field.placeholder || '请输入'}
            value={value}
            disabled={field.disabled}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
    }
  };

  return (
    <Modal
      visible={visible}
      title={title}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText={okText}
      cancelText={cancelText}
      style={{ width }}
      maskClosable={false}
    >
      <Form layout="vertical">
        {fields.map((field) => (
          <FormItem
            key={field.key}
            label={field.required ? `${field.label} *` : field.label}
            field={field.key}
          >
            {renderField(field)}
          </FormItem>
        ))}
      </Form>
    </Modal>
  );
}
