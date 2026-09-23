'use client';

import { useRef, useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Message } from '@arco-design/web-react';

const FormItem = Form.Item;

/** 未提供 initialValues 时的稳定空值哨兵：避免默认 {} 每次渲染生成新引用导致效应反复触发 */
const EMPTY_INITIAL: Record<string, any> = {};

export interface FormFieldOption {
  value: string | number;
  label: string;
}

export interface ValidationRule {
  pattern?: RegExp;
  message: string;
}

/** 默认颜色选择预设（班次取色） */
const DEFAULT_COLOR_PRESETS = [
  '#3B82F6',
  '#16A34A',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#F97316',
  '#10B981',
  '#6366F1',
];

export interface FormFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'month' | 'textarea' | 'colorPicker' | 'tags';
  placeholder?: string;
  options?: FormFieldOption[];
  required?: boolean;
  disabled?: boolean;
  rules?: ValidationRule[];
  /** colorPicker 的预设颜色；缺省使用 DEFAULT_COLOR_PRESETS */
  colorPresets?: string[];
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
  /** 表单列数：>1 时按网格排布（textarea/colorPicker 自动占整行） */
  columns?: number;
}

export default function ModalForm({
  visible,
  title,
  fields,
  initialValues,
  onOk,
  onCancel,
  confirmLoading = false,
  okText = '确定',
  cancelText = '取消',
  width = 600,
  columns = 1,
}: ModalFormProps) {
  // 未传 initialValues 时使用稳定哨兵，避免每次渲染生成新引用
  const initial = initialValues ?? EMPTY_INITIAL;
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [internalLoading, setInternalLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLElement | null>>({});
  // 记录最近一次已回填的 initialValues 引用：打开弹窗、或详情异步晚到导致引用变化时重新回填；
  // 用引用相等避免父组件无关重渲染传入同内容新对象而清空用户已输入内容。
  const seedRef = useRef<Record<string, any> | null>(null);

  useEffect(() => {
    if (!visible) {
      // 关闭时复位，确保下次打开必定按新 initialValues 回填
      seedRef.current = null;
      return;
    }
    if (initial !== seedRef.current) {
      seedRef.current = initial;
      setValues(initial);
      setErrors({});
    }
    setInternalLoading(false);
  }, [visible, initial]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // 修正后清除对应字段的内联错误
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const val = values[field.key];
      if (field.required && (val === undefined || val === null || val === '')) {
        nextErrors[field.key] = `请填写${field.label}`;
        continue;
      }
      if (field.rules && val) {
        for (const rule of field.rules) {
          if (rule.pattern && !rule.pattern.test(String(val))) {
            nextErrors[field.key] = rule.message;
            break;
          }
        }
      }
    }
    setErrors(nextErrors);
    return nextErrors;
  };

  const handleOk = async () => {
    if (internalLoading || confirmLoading) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      // 聚焦第一个错误字段（按 fields 顺序）
      const firstError = fields.find((f) => nextErrors[f.key]);
      const el = firstError && inputRefs.current[firstError.key];
      if (el) el.focus();
      return;
    }

    setInternalLoading(true);
    try {
      const result = onOk(values);
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  const registerRef = (key: string) => (el: any) => {
    inputRefs.current[key] = el;
  };

  const renderField = (field: FormFieldConfig) => {
    const value = values[field.key];

    switch (field.type) {
      case 'select':
        return (
          <Select
            id={field.key}
            ref={registerRef(field.key)}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择'}
            value={value}
            options={field.options || []}
            disabled={field.disabled}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
      case 'tags':
        return (
          <Select
            mode="multiple"
            id={field.key}
            ref={registerRef(field.key)}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择标签'}
            value={value}
            options={field.options || []}
            allowClear
            disabled={field.disabled}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
      case 'month':
        return (
          <DatePicker
            {...{ id: field.key }}
            ref={registerRef(field.key)}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择生效月份'}
            value={value}
            {...{ precision: 'month', format: 'YYYY-MM' } as any}
            disabled={field.disabled}
            onChange={(dateString: string) => handleChange(field.key, dateString)}
          />
        );
      case 'date':
        return (
          <DatePicker
            {...{ id: field.key }}
            ref={registerRef(field.key)}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择日期'}
            value={value}
            format="YYYY-MM-DD"
            disabled={field.disabled}
            onChange={(dateString: string) => handleChange(field.key, dateString)}
          />
        );
      case 'textarea':
        return (
          <Input.TextArea
            id={field.key}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请输入'}
            value={value}
            disabled={field.disabled}
            onChange={(val) => handleChange(field.key, val)}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        );
      case 'colorPicker': {
        const presets = field.colorPresets?.length
          ? field.colorPresets
          : DEFAULT_COLOR_PRESETS;
        const current = (value as string) || presets[0];
        return (
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((c) => {
                const active =
                  String(current).toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => handleChange(field.key, c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: c,
                      cursor: 'pointer',
                      border: active
                        ? '2px solid #2455D9'
                        : '1px solid rgba(0,0,0,0.12)',
                      outline: 'none',
                      boxShadow: active
                        ? '0 0 0 2px rgba(36,85,217,0.25)'
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
            <Input
              placeholder="#3B82F6"
              value={current}
              maxLength={7}
              style={{ width: 116 }}
              disabled={field.disabled}
              onChange={(val) => handleChange(field.key, val)}
            />
          </div>
        );
      }
      case 'input':
      default:
        return (
          <Input
            id={field.key}
            ref={registerRef(field.key)}
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
      confirmLoading={confirmLoading || internalLoading}
      okText={okText}
      cancelText={cancelText}
      style={{ width }}
      maskClosable={false}
    >
      <Form layout="vertical">
        <div
          data-testid="modal-form-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: columns > 1 ? '1fr 1fr' : '1fr',
            columnGap: 16,
          }}
        >
          {fields.map((field) => {
            const fullRow = columns > 1 && (field.type === 'textarea' || field.type === 'colorPicker');
            return (
              <FormItem
                key={field.key}
                label={field.label}
                required={field.required}
                validateStatus={errors[field.key] ? 'error' : undefined}
                help={errors[field.key]}
                style={fullRow ? { gridColumn: '1 / -1' } : undefined}
              >
                {renderField(field)}
              </FormItem>
            );
          })}
        </div>
      </Form>
    </Modal>
  );
}
