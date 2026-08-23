'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch } from '@arco-design/web-react';
import type { SysDepartment } from '@/services/system';

const FormItem = Form.Item;

const VIBRANT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12', '#E67E22',
  '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#FF85A2', '#FFB6C1', '#87CEEB', '#98FB98',
  '#DDA0DD', '#F0E8CE', '#B0E0E6', '#FFDAB9', '#E0BBE4', '#FFDFD3', '#FFD700', '#FF1493',
];

export interface ShiftFormValues {
  name: string;
  departmentId: string;
  startTime: string;
  endTime: string;
  isNextDay: boolean;
  restDuration: number;
  lateThreshold: number;
  earlyThreshold: number;
  useGlobalThreshold: boolean;
  description: string;
  isActive: boolean;
  color: string;
}

interface ShiftFormProps {
  visible: boolean;
  title: string;
  departments: SysDepartment[];
  initialValues: ShiftFormValues;
  confirmLoading?: boolean;
  onOk: (values: ShiftFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export default function ShiftForm({
  visible,
  title,
  departments,
  initialValues,
  confirmLoading = false,
  onOk,
  onCancel,
}: ShiftFormProps) {
  const [form] = Form.useForm();
  const [internalLoading, setInternalLoading] = useState(false);
  const [useGlobalThreshold, setUseGlobalThreshold] = useState(
    initialValues.useGlobalThreshold ?? true,
  );
  // 颜色字段的响应式值（Form.getFieldValue 不会触发重渲染）
  const colorValue = Form.useWatch('color', form) ?? (initialValues.color ?? '#3B82F6');
  const startTimeValue = Form.useWatch('startTime', form);
  const endTimeValue = Form.useWatch('endTime', form);
  const restDurationValue = Form.useWatch('restDuration', form);

  // 用于校验失败时聚焦首个错误字段
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const registerFieldRef = (field: string) => (el: any) => {
    fieldRefs.current[field] = el;
  };

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ ...initialValues });
      setUseGlobalThreshold(initialValues.useGlobalThreshold ?? true);
      setInternalLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialValues, form]);

  // 依据上下班时间 + 休息时长自动计算工作时长
  const workHours = useMemo(() => {
    const start = startTimeValue;
    const end = endTimeValue;
    const rest = Number(restDurationValue) || 0;
    if (!start || !end) return '0.0';
    const [sh, sm] = String(start).split(':').map(Number);
    const [eh, em] = String(end).split(':').map(Number);
    let total = eh * 60 + em - (sh * 60 + sm);
    if (total < 0) total += 24 * 60;
    return Math.max(0, (total - rest) / 60).toFixed(1);
  }, [startTimeValue, endTimeValue, restDurationValue]);

  const randomColor = () => {
    const c = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];
    form.setFieldValue('color', c);
  };

  const handleOk = async () => {
    let errorFields: { field: string | number }[] = [];
    try {
      await form.validate();
    } catch (err: any) {
      // Arco 校验失败抛出的错误，其字段在 err[field].field
      if (err && typeof err === 'object') {
        const isFieldError = (v: unknown): v is { field: string | number } =>
          !!v && typeof v === 'object' && 'field' in v &&
          (typeof (v as { field: unknown }).field === 'string' ||
            typeof (v as { field: unknown }).field === 'number');
        errorFields = Object.values(err)
          .filter(isFieldError)
          .map((e) => ({ field: e.field }));
      }
    }
    if (errorFields.length > 0) {
      const first = errorFields[0];
      const el = fieldRefs.current[String(first.field)];
      if (el && typeof el.focus === 'function') el.focus();
      return;
    }
    const values = form.getFieldsValue();
    const name = String(values.name || '').trim();
    if (!name) return;
    if (!values.startTime || !values.endTime) return;
    const payload: ShiftFormValues = {
      name,
      departmentId: values.departmentId || 'global',
      startTime: values.startTime,
      endTime: values.endTime,
      isNextDay: !!values.isNextDay,
      restDuration: Number(values.restDuration) || 0,
      lateThreshold: Number(values.lateThreshold) || 0,
      earlyThreshold: Number(values.earlyThreshold) || 0,
      useGlobalThreshold: !!useGlobalThreshold,
      description: (values.description || '').trim(),
      isActive: values.isActive !== false,
      color: values.color || '#3B82F6',
    };
    if (!useGlobalThreshold && (payload.lateThreshold < 0 || payload.earlyThreshold < 0)) return;
    setInternalLoading(true);
    try {
      await onOk(payload);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      title={title}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading || internalLoading}
      okText="保存"
      cancelText="取消"
      style={{ width: 620, top: 48 }}
      maskClosable={false}
      autoFocus={false}
      focusLock={true}
    >
      <div className="shift-form-scroll" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4, marginRight: -4 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="班次名称" field="name" rules={[{ required: true, message: '请输入班次名称' }]}>
            <Input id="name" placeholder="例如：早班" maxLength={50} ref={registerFieldRef('name')} />
          </FormItem>
          <FormItem label="所属部门" field="departmentId">
            <Select placeholder="全公司通用" allowClear>
              {departments.map((d) => (
                <Select.Option key={d.id} value={String(d.id)}>{d.name}</Select.Option>
              ))}
            </Select>
          </FormItem>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="上班时间" field="startTime" rules={[{ required: true, message: '请选择上班时间' }]}>
            <Input placeholder="如 08:00" maxLength={5} />
          </FormItem>
          <FormItem label="下班时间" field="endTime" rules={[{ required: true, message: '请选择下班时间' }]}>
            <Input placeholder="如 16:00" maxLength={5} />
          </FormItem>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="休息时长（分钟）" field="restDuration">
            <InputNumber min={0} max={480} style={{ width: '100%' }} placeholder="默认 60 分钟" />
          </FormItem>
          <FormItem label="工作时长（小时）" extra="自动计算：下班 - 上班 - 休息时长">
            <div
              className="w-full border border-border-2 rounded px-3 py-1.5 bg-bg-page text-text-1 font-normal"
              key={workHours}
            >
              {workHours}
            </div>
          </FormItem>
        </div>

        {/* 阈值设置 */}
        <div className="mb-2 rounded-lg border border-brand-bg bg-brand-bg/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-normal text-text-1">⏰ 阈值设置</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-3">
                {useGlobalThreshold ? '使用全局设置' : '使用自定义'}
              </span>
              <Switch
                size="small"
                checked={useGlobalThreshold}
                onChange={(v) => {
                  setUseGlobalThreshold(v);
                  if (v) {
                    form.setFieldValue('lateThreshold', 0);
                    form.setFieldValue('earlyThreshold', 0);
                  } else {
                    form.setFieldValue('lateThreshold', form.getFieldValue('lateThreshold') || 30);
                    form.setFieldValue('earlyThreshold', form.getFieldValue('earlyThreshold') || 30);
                  }
                }}
              />
            </div>
          </div>
          {useGlobalThreshold && (
            <div className="text-xs text-text-3 bg-bg-page rounded px-3 py-2">
              当前班次使用全局考勤设置中的迟到 / 早退阈值。
            </div>
          )}
          {!useGlobalThreshold && (
            <div className="grid grid-cols-2 gap-4">
              <FormItem label="迟到阈值（分钟）" field="lateThreshold" className="mb-0">
                <InputNumber min={0} max={480} style={{ width: '100%' }} />
              </FormItem>
              <FormItem label="早退阈值（分钟）" field="earlyThreshold" className="mb-0">
                <InputNumber min={0} max={480} style={{ width: '100%' }} />
              </FormItem>
            </div>
          )}
        </div>

        <FormItem label="班次描述" field="description">
          <Input.TextArea
            placeholder="可选，描述班次的特点或适用场景"
            maxLength={200}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </FormItem>

        {/* 颜色 */}
        <FormItem label="班次颜色" field="color" className="color-field">
          <div className="flex items-center gap-2">
            <Input
              value={colorValue}
              maxLength={7}
              onChange={(val) => form.setFieldValue('color', val)}
              style={{ width: 110 }}
              placeholder="颜色代码，如 3B82F6"
            />
            <div
              className="flex items-center justify-center h-10 w-10 rounded border border-border-2 cursor-pointer text-lg"
              style={{ background: colorValue || '#3B82F6' }}
              onClick={randomColor}
              title="随机取色"
            >
              🎲
            </div>
            <div className="flex flex-wrap gap-1 ml-1">
              {VIBRANT_COLORS.map((c) => {
                const active = String(colorValue).toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => form.setFieldValue('color', c)}
                    className={`h-6 w-6 rounded transition-all hover:scale-110 ${active ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                    style={{ background: c }}
                    title={c}
                  />
                );
              })}
            </div>
          </div>
        </FormItem>

        <FormItem label="启用此班次" field="isActive" className="mb-0">
          <Switch checkedText="是" uncheckedText="否" />
        </FormItem>
      </Form>
      </div>
    </Modal>
  );
}