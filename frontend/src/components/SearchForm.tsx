'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Card } from '@arco-design/web-react';
import { IconDown, IconUp } from '@arco-design/web-react/icon';
import EmployeeSelect from '@/components/EmployeeSelect';

const { RangePicker } = DatePicker;

export interface SearchFieldOption {
  value: string | number;
  label: string;
}

export interface SearchFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'range' | 'month' | 'employee';
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
  // 防抖定时器用 ref 保存（不用 state），便于卸载清理
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 卸载时清理防抖定时器，避免组件销毁后仍触发 onSearch
  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const handleChange = (key: string, value: any) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);

    if (debounceMs > 0) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onSearch(newValues);
      }, debounceMs);
    }
  };

  const handleSubmit = () => {
    onSearch(values);
  };

  const handleReset = () => {
    // 先清掉残留的防抖回调，避免用重置前的值再发一次查询
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setValues(initialValues);
    onReset?.();
  };

  const showToggle = expandable && fields.length > column;
  const visibleFields = useMemo(() => {
    if (!showToggle || expanded) return fields;
    return fields.slice(0, column);
  }, [fields, showToggle, expanded, column]);

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
    const control = (() => {
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
          return (
            <DatePicker
              // Arco Picker 不透传原生 id，需经 inputProps 落到真实 input 上，
              // 否则外层 <label htmlFor> 悬空、屏幕阅读器不朗读字段名（WCAG SC 1.3.1 / 3.3.2）
              inputProps={{ id: field.key }}
              style={{ width: '100%' }}
              placeholder={field.placeholder || '请选择月份'}
              value={value}
              format={field.format || 'YYYY-MM'}
              onChange={(dateString) => handleChange(field.key, dateString)}
            />
          );
        case 'date':
          return (
            <DatePicker
              inputProps={{ id: field.key }}
              style={{ width: '100%' }}
              placeholder={field.placeholder || '请选择日期'}
              value={value}
              format={field.format || 'YYYY-MM-DD'}
              onChange={(dateString) => handleChange(field.key, dateString)}
            />
          );
        case 'range':
          return (
            <RangePicker
              inputProps={[{ id: field.key }, { id: `${field.key}-end` }]}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              value={value}
              format={field.format || 'YYYY-MM-DD'}
              onChange={(dateStrings) => handleChange(field.key, dateStrings)}
            />
          );
        case 'employee':
          return (
            <EmployeeSelect
              id={field.key}
              value={value || undefined}
              onChange={(val, emp) =>
                handleChange(field.key, val && emp && !Array.isArray(emp) ? emp.name : undefined)
              }
              placeholder={field.placeholder || '搜索员工姓名或工号'}
            />
          );
        case 'input':
        default:
          return (
            <Input
              id={field.key}
              placeholder={field.placeholder || '请输入'}
              value={value}
              onChange={(val) => handleChange(field.key, val)}
            />
          );
      }
    })();

    return (
      <div className="lx-search-field-wrap">
        {control}
        {renderPresets(field)}
      </div>
    );
  };

  return (
    <Card size="small" className="lx-search-card">
      {/* 自绘布局：每个字段 = flex(label + 控件)，避开 Arco FormItem 的 arco-col 栅格导致的
          label 固定百分比压缩/错位问题 */}
      <Form
        layout="vertical"
        className={inlineActions
          ? 'lx-search-form lx-search-form-inline lx-form-glow'
          : 'lx-search-form lx-form-glow'}
        onSubmit={handleSubmit}
      >
        <div className="lx-search-fields" data-testid="search-fields">
          {visibleFields.map((field) => (
            <div className="lx-search-item" data-testid={`form-item-${field.key}`} key={field.key}>
              <label className="lx-search-item-label" htmlFor={field.key}>
                {field.label}
              </label>
              <div className="lx-search-item-control">{renderField(field)}</div>
            </div>
          ))}
        </div>
        <div className="lx-search-actions" data-testid="search-actions">
          <Button type="primary" htmlType="submit">
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
          {showToggle && (
            <Button type="text" data-testid="toggle-collapse" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '收起' : '展开'}
              {expanded ? (
                <IconUp style={{ fontSize: 12, marginLeft: 4 }} />
              ) : (
                <IconDown style={{ fontSize: 12, marginLeft: 4 }} />
              )}
            </Button>
          )}
        </div>
      </Form>
    </Card>
  );
}