'use client';

import { useState, useMemo } from 'react';
import { Tag, Message, Tooltip } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { employeeApi, TimelineRecord } from '@/services/employee';
import { useCachedData } from '@/hooks/use-cached-data';
import { useDepartments } from '@/hooks/use-departments';
import { exportToExcel } from '@/lib/excel';
import { formatDate, todayStr } from '@/lib/format';
import { buildTimelineSearchFields, TYPE_META } from '../lib/timeline-fields';

const EMPTY_TIMELINE: TimelineRecord[] = [];

const columns: ProTableColumn[] = [
  { title: '变动日期', dataIndex: 'occurredAt', width: 130 },
  {
    title: '员工',
    dataIndex: 'employeeName',
    width: 180,
    render: (_, r: TimelineRecord) => (
      <div>
        <div style={{ fontWeight: 500, color: '#1d2129' }}>{r.employeeName}</div>
        <div style={{ fontSize: 12, color: '#86909c' }}>{r.employeeNo}</div>
      </div>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 100,
    render: (_, r: TimelineRecord) => {
      const meta = TYPE_META[r.type] || TYPE_META.transfer;
      return <Tag color={meta.color}>{meta.label}</Tag>;
    },
  },
  {
    title: '详情',
    dataIndex: 'detailText',
    ellipsis: true,
    render: (_, r: TimelineRecord) => (
      <Tooltip content={r.detailText}>
        <span>{r.detailText}</span>
      </Tooltip>
    ),
  },
  {
    title: '备注',
    dataIndex: 'reason',
    ellipsis: true,
    render: (_, r: TimelineRecord) =>
      r.reason ? <span style={{ color: '#4e5969' }}>{r.reason}</span> : <span style={{ color: '#c9cdd4' }}>—</span>,
  },
];

export default function TimelinePage() {
  // 部门参考数据：用于搜索下拉，跨页共享缓存
  const { departments } = useDepartments();
  const searchFields = useMemo(() => buildTimelineSearchFields(departments), [departments]);

  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<Record<string, any>>({});

  // 履历列表：分页与筛选编入缓存键，变化即重新获取
  const cacheKey = `employee:timeline:${pagination.current}:${pagination.pageSize}:${JSON.stringify(filters)}`;
  const { data: resData, loading, error, revalidate } = useCachedData<{
    code: number;
    data?: { list: TimelineRecord[]; page: number; pageSize: number; total: number };
  }>(
    cacheKey,
    async () => {
      const result = await employeeApi.getTimeline({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword,
        type: filters.type,
        departmentId: filters.departmentId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      return { code: result.code, data: result.data ?? undefined };
    },
    { staleTime: 30_000 },
  );
  const data = resData?.code === 0 && resData.data ? resData.data.list : EMPTY_TIMELINE;
  const pageResult = resData?.code === 0 && resData.data
    ? { current: resData.data.page, pageSize: resData.data.pageSize, total: resData.data.total }
    : pagination;

  // 从搜索表单值换算日期范围 + 部门
  const resolveFilters = (values: Record<string, any>) => {
    const { keyword, type, range, departmentId } = values;
    const dateFrom = Array.isArray(range) && range[0] ? formatDate(range[0]) : undefined;
    const dateTo = Array.isArray(range) && range[1] ? formatDate(range[1]) : undefined;
    return { keyword, type, departmentId, dateFrom, dateTo };
  };

  const applyFilters = (f: Record<string, any>) => {
    setFilters(f);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleSearch = (values: Record<string, any>) => {
    applyFilters(resolveFilters(values));
  };

  const handleReset = () => {
    setFilters({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize, total: pageResult.total });
  };

  const handleExport = async () => {
    try {
      const res = await employeeApi.getTimeline({ page: 1, pageSize: 10000, ...filters });
      const list = (res.data?.list ?? []) as TimelineRecord[];
      if (!exportToExcel(
        `人员履历_${todayStr()}.xlsx`,
        '人员履历',
        [
          { title: '变动日期', dataIndex: 'occurredAt' },
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'employeeName' },
          { title: '类型', value: (r: TimelineRecord) => (TYPE_META[r.type]?.label ?? r.type) },
          { title: '详情', dataIndex: 'detailText' },
          { title: '备注', dataIndex: 'reason' },
        ],
        list,
      )) {
        Message.info('当前没有可导出的履历数据');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  return (
    <PageContainer>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        searchColumn={4}
        searchExpandable={false}
        searchInlineActions
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={[
          { key: 'export', label: '导出报表', type: 'outline', onClick: handleExport },
        ]}
        pagination={pageResult}
        onPageChange={handlePageChange}
        bordered
      />
    </PageContainer>
  );
}