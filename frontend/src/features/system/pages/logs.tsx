'use client';

import { useState, useMemo } from 'react';
import { Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { systemApi, OperationLog } from '@/services/system';
import { useCachedData } from '@/hooks/use-cached-data';
import { formatDateTime } from '@/lib/format';

interface LogListEnvelope {
  code: number;
  message?: string;
  data?: { list: OperationLog[]; page: number; pageSize: number; total: number };
}

/**
 * 动作按语义着色：一眼区分「改了什么」而不是一列黑字。
 * 后端 action 形如「创建users」「修改password_strength_level」「登录」——
 * 动词在前，取前缀匹配；匹配不到回落中性灰。
 */
const ACTION_TONES: Array<{ test: RegExp; color: string }> = [
  { test: /创建|新增|create/i, color: 'green' },
  { test: /修改|更新|编辑|update/i, color: 'arcoblue' },
  { test: /删除|delete|remove/i, color: 'red' },
  { test: /登录|登出|login|logout/i, color: 'gray' },
  { test: /导出|下载|export/i, color: 'purple' },
  { test: /审批|通过|拒绝|approve|reject/i, color: 'orange' },
  { test: /重置|恢复|reset|restore/i, color: 'gold' },
];

function actionColor(action: string): string {
  return ACTION_TONES.find((t) => t.test.test(action || ''))?.color ?? 'gray';
}

export default function SystemLogsPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  // 模块候选：从日志里 distinct 出来，而不是写死一份（新增模块自动出现）
  const { data: modulesData } = useCachedData<string[]>(
    'system:log-modules',
    async () => {
      const res = await systemApi.listLogModules();
      return res.code === 0 ? res.data ?? [] : [];
    },
    { staleTime: 5 * 60_000 },
  );
  const modules = modulesData ?? [];

  // SWR 缓存：参数编入 cacheKey，翻页/搜索即重新订阅；同参数复用缓存
  const cacheKey = `system:logs:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<LogListEnvelope>(
    cacheKey,
    () => systemApi.listLogs({ page: pagination.current, pageSize: pagination.pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  const handleSearch = (values: Record<string, any>) => {
    const { dateRange, ...rest } = values;
    const next: Record<string, any> = { ...rest };
    // 范围选择产出 [start, end]；接口认 startDate/endDate（后端按北京日历日过滤）
    if (
      Array.isArray(dateRange) &&
      dateRange.length === 2 &&
      typeof dateRange[0] === 'string' &&
      typeof dateRange[1] === 'string'
    ) {
      next.startDate = dateRange[0];
      next.endDate = dateRange[1];
    }
    setSearchParams(next);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const searchFields = useMemo<SearchFieldConfig[]>(
    () => [
      { key: 'keyword', label: '关键词', type: 'input', placeholder: '操作人 / 动作 / URL / IP' },
      {
        key: 'module',
        label: '模块',
        type: 'select',
        placeholder: '全部模块',
        options: modules.map((m) => ({ value: m, label: m })),
      },
      {
        key: 'status',
        label: '状态',
        type: 'select',
        placeholder: '全部状态',
        options: [
          { value: 'success', label: '成功' },
          { value: 'failed', label: '失败' },
        ],
      },
      { key: 'dateRange', label: '时间范围', type: 'range', placeholder: '开始日期,结束日期' },
    ],
    [modules],
  );

  const columns: ProTableColumn[] = [
    { title: '操作人', dataIndex: 'username', width: 90 },
    { title: '模块', dataIndex: 'module', width: 100 },
    {
      title: '动作',
      dataIndex: 'action',
      width: 150,
      render: (value: string) => <Tag color={actionColor(value)}>{value || '—'}</Tag>,
    },
    { title: '方法', dataIndex: 'method', width: 70 },
    { title: 'URL', dataIndex: 'url', width: 220, ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 110 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      // 操作结果状态统一走公共 StatusTag（success 绿、其余视为失败红）
      render: (value: string) => (
        <StatusTag status={value} statusMap={{ [value]: { label: value === 'success' ? '成功' : '失败', color: value === 'success' ? 'success' : 'danger' } }} />
      ),
    },
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (v: unknown) => formatDateTime(v) },
  ];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        pagination={pageResult}
        onPageChange={(page, pageSize) => setPagination({ ...pageResult, current: page, pageSize })}
      />
    </PageContainer>
  );
}
