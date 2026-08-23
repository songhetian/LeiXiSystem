'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, Button, Space, Empty, Popover, Checkbox, Select } from '@arco-design/web-react';
import SearchForm, { SearchFieldConfig } from './SearchForm';
import DataState from './DataState';
import { sanitizeCell } from '@/lib/excel';

export type TableDensity = 'default' | 'middle' | 'small';

export interface ProTableColumn {
  title: string;
  dataIndex: string;
  key?: string;
  width?: number;
  render?: (value: any, record: any, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  hideable?: boolean;
}

export interface ProTableToolbarAction {
  key: string;
  label: string;
  onClick?: () => void;
  type?: 'primary' | 'secondary' | 'dashed' | 'outline' | 'text';
  disabled?: boolean;
  loading?: boolean;
  status?: 'default' | 'success' | 'warning' | 'danger';
}

export interface ProTablePagination {
  current: number;
  pageSize: number;
  total?: number;
}

export interface ProTableBatchAction {
  key: string;
  label: string;
  onClick: (selectedKeys: (string | number)[], selectedRecords: any[]) => void;
  type?: 'primary' | 'secondary' | 'dashed' | 'outline' | 'text';
  disabled?: boolean;
  danger?: boolean;
}

export interface ProTableRowSelection {
  selectedRowKeys: (string | number)[];
  onChange: (selectedRowKeys: (string | number)[], records: any[]) => void;
  getCheckboxProps?: (record: any) => { disabled?: boolean };
}

export interface ProTableProps {
  columns: ProTableColumn[];
  data: any[];
  rowKey: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchFields?: SearchFieldConfig[];
  onSearch?: (values: Record<string, any>) => void;
  onReset?: () => void;
  toolbar?: ProTableToolbarAction[];
  pagination?: ProTablePagination | false;
  onPageChange?: (page: number, pageSize: number) => void;
  onRowClick?: (record: any) => void;
  rowSelection?: ProTableRowSelection;
  bordered?: boolean;
  stripe?: boolean;
  showColumnSetting?: boolean;
  showExport?: boolean;
  showDensity?: boolean;
  exportFilename?: string;
  onExport?: (data: any[]) => void;
  batchActions?: ProTableBatchAction[];
  /** 启用虚拟滚动（适用于大列表 + 大 pageSize，Arco Table 原生支持） */
  virtual?: boolean;
  /** 虚拟滚动时表格最大高度（px），配合 virtual 使用 */
  maxHeight?: number;
}

export default function ProTable({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  searchFields,
  onSearch,
  onReset,
  toolbar,
  pagination,
  onPageChange,
  onRowClick,
  rowSelection,
  bordered = false,
  stripe = true,
  showColumnSetting = false,
  showExport = false,
  showDensity = false,
  exportFilename = 'export.csv',
  onExport,
  batchActions,
  virtual = false,
  maxHeight = 480,
}: ProTableProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<TableDensity>('default');

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => {
      const key = col.key || col.dataIndex;
      return !hiddenKeys.has(key);
    });
  }, [columns, hiddenKeys]);

  const hideableColumns = useMemo(() => {
    return columns.filter((col) => col.hideable !== false);
  }, [columns]);

  const hasSelection = !!rowSelection;
  const selectedCount = rowSelection?.selectedRowKeys.length || 0;
  const showBatchBar = hasSelection && selectedCount > 0 && batchActions && batchActions.length > 0;

  const selectedRecords = useMemo(() => {
    if (!rowSelection?.selectedRowKeys.length) return [];
    const keySet = new Set(rowSelection.selectedRowKeys);
    return data.filter((row) => keySet.has(row[rowKey]));
  }, [rowSelection?.selectedRowKeys, data, rowKey]);

  const isPaginationEnabled = pagination !== false && !!pagination;
  const currentPage = isPaginationEnabled ? pagination.current : 1;
  const pageSize = isPaginationEnabled ? pagination.pageSize : 10;
  const total = isPaginationEnabled ? pagination.total : undefined;

  useEffect(() => {
    if (pagination === false || total === undefined || total === null) return;
    if (total === 0) {
      if (currentPage !== 1) {
        onPageChange?.(1, pageSize);
      }
      return;
    }
    const maxPage = Math.ceil(total / pageSize);
    if (currentPage > maxPage) {
      onPageChange?.(maxPage, pageSize);
    }
  }, [currentPage, pageSize, total, pagination, onPageChange]);

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

  const toggleColumn = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    if (onExport) {
      onExport(data);
      return;
    }
    const headers = visibleColumns.map((col) => col.title).join(',');
    const rows = data.map((row) =>
      visibleColumns
        .map((col) => {
          const val = row[col.dataIndex];
          const raw = val === null || val === undefined ? '' : String(val);
          const str = String(sanitizeCell(raw));
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );
    const csv = '\ufeff' + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columnSettingContent = (
    <div className="p-2 min-w-[160px]">
      <div className="mb-2 font-medium text-sm">列显示设置</div>
      {hideableColumns.map((col) => {
        const key = col.key || col.dataIndex;
        return (
          <div key={key} className="py-1">
            <Checkbox
              checked={!hiddenKeys.has(key)}
              onChange={() => toggleColumn(key)}
            >
              {col.title}
            </Checkbox>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-surface border border-border-1 rounded-md overflow-hidden shadow-card">
      {searchFields && searchFields.length > 0 && (
        <div className="pt-4 px-[18px] border-b border-border-2 bg-surface">
          <SearchForm
            fields={searchFields}
            onSearch={onSearch || (() => {})}
            onReset={onReset}
          />
        </div>
      )}

      {(toolbar && toolbar.length > 0) || showColumnSetting || showExport || showDensity ? (
        <div className="flex items-center justify-between py-3 px-[18px] border-b border-border-2 bg-surface">
          <div className="flex items-center gap-2.5">
            {toolbar?.map((action) => (
              <Button
                key={action.key}
                type={action.type || 'primary'}
                onClick={action.onClick}
                disabled={action.disabled}
                loading={action.loading}
                status={action.status}
                size="small"
              >
                {action.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            {showExport && (
              <Button size="small" onClick={handleExportCSV}>导出 CSV</Button>
            )}
            {showDensity && (
              <Select
                size="small"
                value={density}
                style={{ width: 100 }}
                onChange={(val) => setDensity(val as TableDensity)}
              >
                <Select.Option value="default">默认</Select.Option>
                <Select.Option value="middle">中等</Select.Option>
                <Select.Option value="small">紧凑</Select.Option>
              </Select>
            )}
            {showColumnSetting && (
              <Popover
                content={columnSettingContent}
                trigger="click"
                position="br"
              >
                <Button size="small">列设置</Button>
              </Popover>
            )}
          </div>
        </div>
      ) : null}

      {showBatchBar && (
        <div className="py-2 px-[18px] bg-brand-bg flex justify-between items-center border-b border-border-2">
          <span className="text-sm text-brand font-normal">
            已选择 <span className="font-medium">{selectedCount}</span> 项
          </span>
          <Space>
            {batchActions!.map((action) => (
              <Button
                key={action.key}
                size="small"
                type={action.type || 'secondary'}
                status={action.danger ? 'danger' : undefined}
                disabled={action.disabled}
                onClick={() => action.onClick(rowSelection!.selectedRowKeys, selectedRecords)}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        </div>
      )}

      <DataState error={error} onRetry={onRetry}>
        <Table
          columns={visibleColumns}
          data={data}
          rowKey={rowKey}
          loading={loading}
          pagination={tablePagination as any}
          border={bordered}
          stripe={false}
          rowSelection={rowSelection as any}
          size={density === 'default' ? 'default' : density}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: onRowClick ? 'pointer' : 'default' } as React.CSSProperties,
          })}
          noDataElement={<Empty description="暂无数据" />}
          style={{ borderRadius: 0 }}
          {...(virtual
            ? { virtual: true, scroll: { y: maxHeight }, pageSize: (pagination === false ? undefined : pagination?.pageSize) || 20 }
            : {})}
        />
      </DataState>
    </div>
  );
}
