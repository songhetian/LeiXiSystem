'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, Button, Space, Empty, Popover, Checkbox, Select, Message, Skeleton } from '@arco-design/web-react';
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
  /** 横向滚动时固定列；操作列固定在右侧，避免窄屏下滚出可视区 */
  fixed?: 'left' | 'right';
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
  /**
   * 搜索表单初始值。
   * 页面若默认带筛选条件（如「当前月」），必须回填到这里，否则用户看到的是
   * 空筛选框、却在看被隐藏条件过滤后的数据，点重置也看不出发生了什么。
   */
  searchInitialValues?: Record<string, any>;
  /** 搜索表单每行列数，默认 3；传入 4 及以上可让字段排成一行 */
  searchColumn?: number;
  /** 是否允许“展开/收起”搜索框（默认 true）；不想让字段藏起来时传 false */
  searchExpandable?: boolean;
  /** 是否让查询/重置与搜索字段同一行（右侧固定），默认 false */
  searchInlineActions?: boolean;
  /** 搜索字段变更后自动提交的防抖毫秒数（>0 时变更即查，无需点查询按钮）；默认 0 关闭 */
  searchDebounceMs?: number;
  /** 搜索字段变更后自动提交的防抖毫秒数（>0 时变更即查，无需点查询按钮）；默认 0 关闭 */
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
  /**
   * 全量导出的数据源：传入后「导出 CSV」会等待该函数返回全部行，
   * 而不是只导出当前页。未传入时保持原有「导出当前页」行为。
   */
  onExportAll?: () => Promise<Record<string, any>[]>;
  batchActions?: ProTableBatchAction[];
  /** 启用虚拟滚动（适用于大列表 + 大 pageSize，Arco Table 原生支持） */
  virtual?: boolean;
  /** 虚拟滚动时表格最大高度（px），配合 virtual 使用 */
  maxHeight?: number;
  /** 自定义空态节点；不传时默认显示“暂无数据” */
  emptyElement?: React.ReactNode;
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
  searchInitialValues,
  searchColumn,
  searchExpandable,
  searchInlineActions,
  searchDebounceMs,
  toolbar,
  pagination,
  onPageChange,
  onRowClick,
  rowSelection,
  bordered = false,
  // 默认关闭斑马纹（内部始终透传此值）：此前声明默认 true 却写死 false，
  // 调用方即使传 stripe 也被忽略——现在声明与行为一致，传 true 即生效
  stripe = false,
  showColumnSetting = false,
  showExport = false,
  showDensity = false,
  exportFilename = 'export.csv',
  onExport,
  onExportAll,
  batchActions,
  virtual = false,
  maxHeight = 480,
  emptyElement,
}: ProTableProps) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<TableDensity>('default');
  const [exporting, setExporting] = useState(false);

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
        // 支持自定义每页条数
        sizeCanChange: true,
        pageSizeOptions: [10, 20, 50, 100],
      };

  // 首屏（还没有任何数据）用骨架行；翻页/刷新已有数据时继续用表格 loading，
  // 否则每次翻页都会把整表替换成骨架，产生一次无意义的内容闪动。
  const firstLoading = loading && data.length === 0;

  const handleRowClick = (record: any) => {
    onRowClick?.(record);
  };

  // ---- 行的键盘可达性（WCAG SC 2.1.1 Keyboard）----
  // 行点击（进入详情/编辑）是后台最高频交互，但 <tr> 默认不可聚焦、不响应 Enter。
  // 采用「roving tabindex」：整张表只保留一个可 Tab 到达的行（避免几十行把 Tab 序列撑爆，
  // 那本身违反 SC 2.4.3 焦点顺序），表内用 ↑/↓ 移动焦点、Enter/Space 打开。
  const [focusRowIndex, setFocusRowIndex] = useState(0);

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, record: any) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(record);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const row = e.currentTarget;
      const sibling = (
        e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling
      ) as HTMLElement | null;
      // 只移动到同样是「可聚焦行」的兄弟节点上，跳过展开行等非交互行
      if (sibling && sibling.hasAttribute('tabindex')) {
        e.preventDefault();
        sibling.focus();
      }
    }
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

  const handleExportCSV = async () => {
    if (onExport) {
      onExport(data);
      return;
    }
    let exportData: Record<string, any>[] = data;
    if (onExportAll) {
      // 全量导出：分页拉取在页面侧完成，这里只负责等待与降级提示
      setExporting(true);
      try {
        exportData = await onExportAll();
      } catch (e) {
        Message.error((e as Error).message || '导出失败');
        return;
      } finally {
        setExporting(false);
      }
    }
    const headers = visibleColumns.map((col) => col.title).join(',');
    const rows = exportData.map((row) =>
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

  const showSearch = !!(searchFields && searchFields.length > 0);
  const hasUtilities = !!(showExport || showDensity || showColumnSetting);
  const hasToolbarActions = !!(toolbar && toolbar.length > 0);
  const showToolbarRow = showSearch || hasToolbarActions || hasUtilities;
  const utilities = (
    <div className="flex items-center gap-2.5">
      {showExport && (
        <Button size="small" loading={exporting} onClick={handleExportCSV}>导出 CSV</Button>
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
  );
  const toolbarActions = hasToolbarActions ? (
    <div className="flex items-center gap-2.5">
      {toolbar!.map((action) => (
        <Button
          key={action.key}
          type={action.type || 'primary'}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
          status={action.status}
        >
          {action.label}
        </Button>
      ))}
    </div>
  ) : null;

  return (
    <div className="bg-surface border border-border-1 rounded-md overflow-hidden shadow-card">
      {showSearch && (
        <div className="pro-search-section">
          <SearchForm
            bare
            fields={searchFields!}
            onSearch={onSearch || (() => {})}
            onReset={onReset}
            initialValues={searchInitialValues}
            column={searchColumn}
            expandable={searchExpandable}
            inlineActions={searchInlineActions}
            debounceMs={searchDebounceMs}
          />
        </div>
      )}

      {showToolbarRow && (
        <div className="pro-toolbar">
          {toolbarActions}
          {/* 主操作缺失时左占位，保证工具组始终贴右 */}
          {!hasToolbarActions && <div className="flex-1 min-w-0" />}
          {utilities}
        </div>
      )}

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
        {/* 键盘用户看不到"行可点击"的鼠标暗示，用屏读可及但视觉隐藏的说明补上提示 */}
        {onRowClick && (
          <span className="lx-sr-only">表格行可用方向键上下移动，按回车键或空格键打开详情</span>
        )}
        {firstLoading ? (
          // 骨架行：列数与可见列一致（上限 6），首屏不再出现「空表 + 转圈遮罩」
          <div role="status" aria-live="polite" aria-busy="true" className="protable-skeleton">
            <span className="sr-only">正在加载列表数据</span>
            <div className="protable-skeleton-head" aria-hidden="true">
              {visibleColumns.slice(0, 6).map((col) => (
                <div key={col.key || col.dataIndex} className="protable-skeleton-cell" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="protable-skeleton-row" aria-hidden="true">
                {visibleColumns.slice(0, 6).map((col, colIndex) => (
                  <div key={col.key || col.dataIndex} className="protable-skeleton-cell">
                    <Skeleton text={{ rows: 1, width: colIndex === 0 ? '50%' : '80%' }} animation />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
        <Table
          columns={visibleColumns}
          data={data}
          rowKey={rowKey}
          loading={loading}
          pagination={tablePagination}
          border={bordered}
          stripe={stripe}
          rowSelection={rowSelection}
          size={density === 'default' ? 'default' : density}
          onRow={(record, index) => ({
            onClick: () => handleRowClick(record),
            // 行内键盘通路：roving tabindex + ↑↓ 移动 + Enter/Space 打开
            ...(onRowClick
              ? {
                  tabIndex: index === focusRowIndex ? 0 : -1,
                  onFocus: () => setFocusRowIndex(index),
                  onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) =>
                    handleRowKeyDown(e, record),
                }
              : {}),
            style: { cursor: onRowClick ? 'pointer' : 'default' } as React.CSSProperties,
          })}
          noDataElement={emptyElement ?? <Empty description="暂无数据" />}
          scroll={{
            x: true, // 按内容横向扩展，列不被压缩换行，杜绝中文逐字竖排
            ...(virtual ? { y: maxHeight } : {}),
          }}
          {...(virtual
            ? { virtual: true, pageSize: (pagination === false ? undefined : pagination?.pageSize) || 20 }
            : {})}
        />
        )}
      </DataState>
    </div>
  );
}
