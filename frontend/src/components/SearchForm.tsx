'use client';

import { useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Grid, Card } from '@arco-design/web-react';

const FormItem = Form.Item;
const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

export interface SearchFieldOption {
  value: string | number;
  label: string;
}

export interface SearchFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'range';
  placeholder?: string;
  options?: SearchFieldOption[];
  span?: number;
  /** 日期/范围类型的时间格式，默认 YYYY-MM-DD */
  format?: string;
}

export interface SearchFormProps {
  fields: SearchFieldConfig[];
  onSearch: (values: Record<string, any>) => void;
  onReset?: () => void;
  initialValues?: Record<string, any>;
  column?: number;
  debounceMs?: number;
}

export default function SearchForm({
  fields,
  onSearch,
  onReset,
  initialValues = {},
  column = 3,
  debounceMs = 0,
}: SearchFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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

  const span = Math.floor(24 / column);

  const renderField = (field: SearchFieldConfig) => {
    const value = values[field.key];

    switch (field.type) {
      case 'select':
        return (
          <Select
            style={{ width: '100%' }}
            placeholder={field.placeholder || '请选择'}
            value={value}
            options={field.options || []}
            onChange={(val) => handleChange(field.key, val)}
          />
        );
      case 'date':
        return (
          <DatePicker
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
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            value={value}
            format={field.format || 'YYYY-MM-DD'}
            onChange={(dateStrings) => handleChange(field.key, dateStrings)}
          />
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
    <Card size="small" style={{ marginBottom: 16 }}>
      <Form layout="horizontal" onSubmit={handleSubmit}>
        <Row gutter={16}>
          {fields.map((field) => (
            <Col key={field.key} span={field.span || span}>
              <FormItem label={field.label} field={field.key}>
                {renderField(field)}
              </FormItem>
            </Col>
          ))}
          <Col span={span} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <FormItem>
              <Button type="primary" htmlType="submit" style={{ marginRight: 8 }} size="small">
                查询
              </Button>
              <Button onClick={handleReset} size="small">重置</Button>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}
