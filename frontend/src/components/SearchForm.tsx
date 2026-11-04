'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Card } from '@arco-design/web-react';
import { IconClose, IconDown, IconUp } from '@arco-design/web-react/icon';
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
  /** 是否让“查询/重置”与字段排在同一行（右侧固定），默认 true（全站统一单行布局） */
  inlineActions?: boolean;
  /**
   * 内嵌模式：脱掉自身 Card 外壳（无边框/阴影/外边距），由宿主容器提供分区与分隔线。
   * 用于 ProTable —— 避免出现「卡片套卡片」的双重边框；独立使用（如 shifts 页）保持默认 false。
   */
  bare?: boolean;
}

export default function SearchForm({
  fields,
  onSearch,
  onReset,
  initialValues = {},
  column = 3,
  debounceMs = 0,
  expandable = true,
  inlineActions = true,
  bare = false,
}: SearchFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  // 「已生效条件」只反映真正提交过（或页面默认带）的筛选，不跟着正在编辑的输入框实时变
  const [applied, setApplied] = useState<Record<string, any>>(initialValues);
  // 防抖定时器用 ref 保存（不用 state），便于卸载清理
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);

  /**
   * 起止日期成对校验：startDate/endDate、startTime/endTime 这类字段，
   * 开始晚于结束时给出明确提示并阻断查询（倒序区间在列表接口上没有意义）。
   */
  const findRangeError = (vals: Record<string, any>): string | null => {
    for (const field of fields) {
      if (!/^start/i.test(field.key)) continue;
      const endKey = `end${field.key.slice('start'.length)}`;
      const endField = fields.find((f) => f.key === endKey);
      if (!endField) continue;
      const start = vals[field.key];
      const end = vals[endKey];
      if (!start || !end) continue;
      if (String(start) > String(end)) {
        return `「${field.label}」不能晚于「${endField.label}」`;
      }
    }
    return null;
  };
  const rangeError = findRangeError(values);

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
        // 区间非法时不把请求发出去：列表接口不接受倒序区间，
        // 打过去只会拿到空结果或 400，用户看不出是自己填反了
        if (findRangeError(newValues)) return;
        setApplied(newValues);
        onSearch(newValues);
      }, debounceMs);
    }
  };

  /**
   * 清掉待触发的防抖回调。
   * 提交/重置/删条件都必须先调用：否则 300ms 后定时器会用「改动前」的值再发一次
   * onSearch，表现为列表闪回旧结果、刚删掉的 chip 又复活。
   */
  const clearPendingSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const handleSubmit = () => {
    clearPendingSearch();
    if (findRangeError(values)) return;
    setApplied(values);
    onSearch(values);
  };

  const handleReset = () => {
    clearPendingSearch();
    setValues(initialValues);
    setApplied(initialValues);
    onReset?.();
  };

  /** 删除单个已生效条件：同步清空输入值与回显，并立即重新查询 */
  const removeCondition = (key: string) => {
    clearPendingSearch();
    const nextValues = { ...values };
    delete nextValues[key];
    const nextApplied = { ...applied };
    delete nextApplied[key];
    setValues(nextValues);
    setApplied(nextApplied);
    if (findRangeError(nextValues)) return;
    onSearch(nextValues);
  };

  const showToggle = expandable && fields.length > column;
  const visibleFields = useMemo(() => {
    if (!showToggle || expanded) return fields;
    const shown = fields.slice(0, column);
    // 成对字段保护：截断正好切在 startDate 上时把配对的 endDate 补回来，
    // 否则用户能设起始却设不了结束，区间筛选形同虚设
    for (const field of shown) {
      if (!/^start/i.test(field.key)) continue;
      const endKey = `end${field.key.slice('start'.length)}`;
      if (shown.some((f) => f.key === endKey)) continue;
      const endField = fields.find((f) => f.key === endKey);
      if (endField) shown.push(endField);
    }
    // 按配置原始顺序输出，避免补齐的字段被甩到末尾
    return fields.filter((f) => shown.some((s) => s.key === f.key));
  }, [fields, showToggle, expanded, column]);

  const isEmptyValue = (v: any) =>
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.every((x) => x === undefined || x === null || x === ''));

  /** 条件回显的可读文案：下拉显示选项标签，区间用 ~ 连接，其余原样 */
  const displayValue = (field: SearchFieldConfig, value: any): string => {
    if (field.type === 'select') {
      const opt = field.options?.find((o) => String(o.value) === String(value));
      return opt ? opt.label : String(value);
    }
    if (Array.isArray(value)) return value.filter((x) => !isEmptyValue(x)).join(' ~ ');
    return String(value);
  };

  // 只回显仍存在的字段配置项（表单内部临时 key 不外露）
  const activeConditions = useMemo(
    () =>
      Object.entries(applied).filter(
        ([key, value]) => fields.some((f) => f.key === key) && !isEmptyValue(value),
      ),
    [applied, fields],
  );

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
      <div className="lx-search-field-wrap" data-type={field.type}>
        <div className="lx-search-control">{control}</div>
        {renderPresets(field)}
      </div>
    );
  };

  const form = (
    // 自绘布局：每个字段 = flex(label + 控件)，避开 Arco FormItem 的 arco-col 栅格导致的
    // label 固定百分比压缩/错位问题
    <Form
      layout="vertical"
      className={inlineActions ? 'lx-search-form lx-search-form-inline' : 'lx-search-form'}
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
      {rangeError && (
        <div className="text-danger text-xs mb-2" role="alert">
          {rangeError}
        </div>
      )}
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
      {/* 已生效条件：把「当前列表到底被什么条件过滤着」摊开说，避免用户忘了
          之前设过筛选项、对着空列表反复点查询 */}
      {activeConditions.length > 0 && (
        <div className="lx-search-active" data-testid="search-active">
          <span className="lx-search-active-label">已生效</span>
          {activeConditions.map(([key, value]) => {
            const field = fields.find((f) => f.key === key)!;
            return (
              <button
                key={key}
                type="button"
                className="lx-search-chip"
                data-testid={`chip-${key}`}
                title="点击移除该条件"
                onClick={() => removeCondition(key)}
              >
                <span className="lx-search-chip-key">{field.label}</span>
                <span className="lx-search-chip-value">{displayValue(field, value)}</span>
                <IconClose className="lx-search-chip-close" />
              </button>
            );
          })}
        </div>
      )}
    </Form>
  );

  // bare：内嵌到 ProTable，去外壳由宿主统一控制分区边界
  if (bare) {
    return form;
  }

  return (
    <Card size="small" className="lx-search-card">
      {form}
    </Card>
  );
}