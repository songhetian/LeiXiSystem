'use client';

import { useState, useEffect } from 'react';
import { Message, Tag } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { systemApi, OperationLog } from '@/services/system';

export default function SystemLogsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OperationLog[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const fetchList = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await systemApi.listLogs({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      } else {
        Message.error(res.message || '获取日志失败');
      }
    } catch (e) {
      Message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchList(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchList(1, pagination.pageSize, {});
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
    <AppLayout title="操作日志" activeMenu="system-logs">
      <PageContainer title="操作日志">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          pagination={pagination}
          onPageChange={(page, pageSize) => fetchList(page, pageSize, searchParams)}
        />
      </PageContainer>
    </AppLayout>
  );
}
