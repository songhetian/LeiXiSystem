'use client';

import { useState } from 'react';
import { Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { systemApi, OperationLog } from '@/services/system';
import { useCachedData } from '@/hooks/use-cached-data';

interface LogListEnvelope {
  code: number;
  message?: string;
  data?: { list: OperationLog[]; page: number; pageSize: number; total: number };
}

export default function SystemLogsPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

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
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const searchFields: SearchFieldConfig[] = [
    { key: 'module', label: '模块', type: 'input', placeholder: '如 auth/attendance' },
  ];

  const columns: ProTableColumn[] = [
    { title: '操作人', dataIndex: 'username', width: 100 },
    { title: '模块', dataIndex: 'module', width: 120 },
    { title: '动作', dataIndex: 'action', width: 140 },
    { title: '方法', dataIndex: 'method', width: 70 },
    { title: 'URL', dataIndex: 'url', width: 260 },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => <Tag color={value === 'success' ? 'green' : 'red'}>{value}</Tag>,
    },
    { title: '时间', dataIndex: 'createdAt', width: 180 },
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
