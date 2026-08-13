'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, Card, Grid } from '@arco-design/web-react';

const FormItem = Form.Item;
const { Row, Col } = Grid;

export interface SearchFieldOption {
  value: string | number;
  label: string;
}

export interface SearchFieldConfig {
  key: string;
  label: string;
  type: 'input' | 'select';
  placeholder?: string;
  options?: SearchFieldOption[];
  span?: number;
}

export interface SearchFormProps {
  fields: SearchFieldConfig[];
  onSearch: (values: Record<string, any>) => void;
  onReset?: () => void;
  initialValues?: Record<string, any>;
  column?: number;
}

export default function SearchForm({
  fields,
  onSearch,
  onReset,
  initialValues = {},
  column = 3,
}: SearchFormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
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
    <Card style={{ marginBottom: 16 }}>
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
              <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}
