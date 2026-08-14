'use client';

import { Table, Button, Space } from '@arco-design/web-react';
import SearchForm, { SearchFieldConfig } from './SearchForm';

export interface ProTableColumn {
  title: string;
  dataIndex: string;
  key?: string;
  width?: number;
  render?: (value: any, record: any, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  /** 超长内容省略号截断（透传给 Arco Table 列） */
  ellipsis?: boolean;
}

export interface ProTableToolbarAction {
  key: string;
  label: string;
  onClick?: () => void;
  type?: 'primary' | 'secondary' | 'dashed' | 'outline' | 'text';
  disabled?: boolean;
}

export interface ProTablePagination {
  current: number;
  pageSize: number;
  total: number;
}

export interface ProTableProps {
  columns: ProTableColumn[];
  data: any[];
  rowKey: string;
  loading?: boolean;
  searchFields?: SearchFieldConfig[];
  onSearch?: (values: Record<string, any>) => void;
  onReset?: () => void;
  toolbar?: ProTableToolbarAction[];
  pagination?: ProTablePagination | false;
  onPageChange?: (page: number, pageSize: number) => void;
  onRowClick?: (record: any) => void;
  bordered?: boolean;
  stripe?: boolean;
}

export default function ProTable({
  columns,
  data,
  rowKey,
  loading = false,
  searchFields,
  onSearch,
  onReset,
  toolbar,
  pagination,
  onPageChange,
  onRowClick,
  bordered = false,
  stripe = true,
}: ProTableProps) {
  const handlePageChange = (page: number, pageSize: number) => {
    onPageChange?.(page, pageSize);
  };

  const tablePagination = pagination === false
    ? false
    : {
        current: pagination?.current || 1,
        pageSize: pagination?.pageSize || 10,
        total: pagination?.total || 0,
        onChange: handlePageChange,
        showTotal: true,
      };

  const handleRowClick = (record: any) => {
    onRowClick?.(record);
  };

  return (
    <div>
      {searchFields && searchFields.length > 0 && (
        <SearchForm
          fields={searchFields}
          onSearch={onSearch || (() => {})}
          onReset={onReset}
        />
      )}

      {(toolbar && toolbar.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <Space>
            {toolbar.map((action) => (
              <Button
                key={action.key}
                type={action.type || 'primary'}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        </div>
      )}

      <Table
        columns={columns}
        data={data}
        rowKey={rowKey}
        loading={loading}
        pagination={tablePagination as any}
        border={bordered}
        stripe={stripe}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' } as React.CSSProperties,
        })}
      />
    </div>
  );
}
