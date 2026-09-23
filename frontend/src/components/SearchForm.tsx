'use client';

import { useMemo, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Card } from '@arco-design/web-react';
import { IconDown, IconUp } from '@arco-design/web-react/icon';

const FormItem = Form.Item;
const { RangePicker } = DatePicker;

export interface SearchFieldOption {
  value: string | number;
  label: string;
}

export interface SearchFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'range' | 'month';
  placeholder?: string;
  options?: SearchFieldOption[];
  span?: number;
  /** 下拉框首项“全部”文案，默认取 placeholder，兜底“全部” */
  allLabel?: string;
  /** 日期/范围/月份类型的时间格式，默认 YYYY-MM-DD（月份默认 YYYY-MM） */
  format?: string;
  /** 日期/范围/月份类字段的快捷预设按钮：点击直接写入该字段值 */
  presets?: Array<{ label: string; value: any }>;
}

export interface SearchFormProps {
  fields: SearchFieldConfig[];
  onSearch: (values: Record<string, any>) => void;
  onReset?: () => void;
  initialValues?: Record<string, any>;
  column?: number;
  debounceMs?: number;
  /** 是否启用“展开/收起”（Pro 标准），默认 true */
  expandable?: boolean;
  /** 是否让“查询/重置”与字段排在同一行（右侧固定），默认 false */
  inlineActions?: boolean;
}

export default function SearchForm({
  fields,
  onSearch,
  onReset,
  initialValues = {},
  column = 3,
  debounceMs = 0,
  expandable = true,
  inlineActions = false,
}: SearchFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key: string, value: any) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);

    if (debounceMs > 0) {
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        onSearch(newValues);
      }, debounceMs);
      setDebounceTimer(timer);
    }
  };

  const handleSubmit = () => {
    onSearch(values);
  };

  const handleReset = () => {
    setValues({});
    onReset?.();
  };

  const showToggle = expandable && fields.length > column;
  const visibleFields = useMemo(() => {
    if (!showToggle || expanded) return fields;
    return fields.slice(0, column);
  }, [fields, showToggle, expanded, column]);

  // 日期类字段的快捷预设：以按钮形式排在输入框外侧（不进框）
  const renderFieldControl = (field: SearchFieldConfig) => {
    const hasPresets = !!field.presets && field.presets.length > 0;
    const wrap = (control: React.ReactElement) =>
      hasPresets ? (
        <div className="lx-search-field-wrap">
          {control}
          {renderPresets(field)}
        </div>
      ) : (
        control
      );
    return wrap;
  };

  // 日期类字段的快捷预设：点击直接写入字段值
  const renderPresets = (field: SearchFieldConfig) => {
    if (!field.presets || field.presets.length === 0) return null;
    return (
      <div className="lx-search-presets">
        {field.presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="lx-search-preset-btn"
            onClick={() => handleChange(field.key, p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  };

  const renderField = (field: SearchFieldConfig) => {
    const value = values[field.key];
    const wrap = renderFieldControl(field);

    switch (field.type) {
      case 'select':
        return (
          <Select
            id={field.key}
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择'}
            value={value}
            showSearch
            allowClear
            options={[
              { value: '', label: field.allLabel || field.placeholder || '全部' },
              ...(field.options || []),
            ]}
            onChange={(val) => handleChange(field.key, val === '' ? undefined : val)}
          />
        );
      case 'month':
        return wrap(
          <DatePicker
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择月份'}
            value={value}
            format={field.format || 'YYYY-MM'}
            onChange={(dateString) => handleChange(field.key, dateString)}
          />,
        );
      case 'date':
        return wrap(
          <DatePicker
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择日期'}
            value={value}
            format={field.format || 'YYYY-MM-DD'}
            onChange={(dateString) => handleChange(field.key, dateString)}
          />,
        );
      case 'range':
        return wrap(
          <RangePicker
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            value={value}
            format={field.format || 'YYYY-MM-DD'}
            onChange={(dateStrings) => handleChange(field.key, dateStrings)}
          />,
        );
      case 'input':
      default:
        return (
          <Input
            placeholder={field.placeholder || '请输入'}
            value={value}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
    }
  };

  return (
    <Card size="small" className="lx-search-card">
      <Form layout="horizontal" onSubmit={handleSubmit}>
        <div className={`lx-search-body${inlineActions ? ' lx-search-body-inline' : ''}`}>
          {/* 字段区：按 column 列等宽栅格，自动换行 */}
          <div
            className="lx-search-fields"
            data-testid="search-fields"
            style={{ '--sf-cols': column } as React.CSSProperties}
          >
            {visibleFields.map((field) => (
              <div className="lx-search-item" key={field.key}>
                <FormItem label={field.label} field={field.key}>
                  {renderField(field)}
                </FormItem>
              </div>
            ))}
          </div>
          {/* 操作区：固定右侧首行，查询/重置/展开始终可见且不随字段换行漂移 */}
          <div className="lx-search-actions" data-testid="search-actions">
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
            {showToggle && (
              <Button
                type="text"
                data-testid="toggle-collapse"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '收起' : '展开'}
                {expanded ? (
                  <IconUp style={{ fontSize: 12, marginLeft: 4 }} />
                ) : (
                  <IconDown style={{ fontSize: 12, marginLeft: 4 }} />
                )}
              </Button>
            )}
          </div>
        </div>
      </Form>
    </Card>
  );
}
