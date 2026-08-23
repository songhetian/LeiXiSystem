'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Space, Tag, Message, Tooltip } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { employeeApi, TimelineRecord, TimelineRecordType } from '@/services/employee';
import { notifyError } from '@/lib/request';
import { exportToExcel } from '@/lib/excel';

const TYPE_META: Record<TimelineRecordType, { label: string; color: string }> = {
  hire: { label: '入职', color: 'green' },
  transfer: { label: '调动', color: 'blue' },
  promotion: { label: '晋升', color: 'arcoblue' },
  demotion: { label: '降职', color: 'orange' },
  salary_adjust: { label: '调薪', color: 'cyan' },
  resign: { label: '离职', color: 'red' },
};

const QUICK_RANGES = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '7d', label: '近7天' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function dayOffset(d: Date, offset: number): string {
  const t = new Date(d);
  t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

// 快捷筛选 -> 日期范围
function quickRange(key: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (key) {
    case 'today': {
      const d = dayOffset(now, 0);
      return { dateFrom: d, dateTo: d };
    }
    case 'yesterday': {
      const d = dayOffset(now, -1);
      return { dateFrom: d, dateTo: d };
    }
    case '7d':
      return { dateFrom: dayOffset(now, -6), dateTo: dayOffset(now, 0) };
    case 'month':
      return { dateFrom: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, dateTo: dayOffset(now, 0) };
    default:
      return {};
  }
}

const searchFields: SearchFieldConfig[] = [
  { key: 'keyword', label: '关键字', type: 'input', placeholder: '姓名 / 工号' },
  {
    key: 'type',
    label: '变动类型',
    type: 'select',
    placeholder: '全部类型',
    options: Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
  },
  { key: 'range', label: '变动日期', type: 'range', placeholder: '选择日期范围' },
];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TimelineRecord[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [quick, setQuick] = useState('all');

  const fetchData = useCallback(async (page = 1, pageSize = 20, f: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeApi.getTimeline({
        page,
        pageSize,
        keyword: f.keyword,
        type: f.type,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
      });
      if (result.code === 0 && result.data) {
        setData(result.data.list);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
      notifyError(e, '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 从搜索表单值换算日期范围
  const resolveFilters = (values: Record<string, any>) => {
    const { keyword, type, range } = values;
    const dateFrom = Array.isArray(range) && range[0] ? String(range[0]).slice(0, 10) : undefined;
    const dateTo = Array.isArray(range) && range[1] ? String(range[1]).slice(0, 10) : undefined;
    return { keyword, type, dateFrom, dateTo };
  };

  const applyFilters = (f: Record<string, any>) => {
    setFilters(f);
    fetchData(1, pagination.pageSize, f);
  };

  const handleSearch = (values: Record<string, any>) => {
    setQuick('all');
    applyFilters(resolveFilters(values));
  };

  const handleReset = () => {
    setQuick('all');
    setFilters({});
    fetchData(1, pagination.pageSize, {});
  };

  const handleQuick = (key: string) => {
    setQuick(key);
    const range = quickRange(key);
    applyFilters({ ...filters, ...range });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize, filters);
  };

  const handleExport = async () => {
    try {
      const res = await employeeApi.getTimeline({ page: 1, pageSize: 10000, ...filters });
      const list = (res.data?.list ?? []) as TimelineRecord[];
      if (!exportToExcel(
        `人员履历_${new Date().toISOString().slice(0, 10)}.xlsx`,
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

  useEffect(() => {
    fetchData(1, 20, {});
  }, [fetchData]);

  return (
    <PageContainer
      title="人员履历"
      subTitle="汇总员工入职、调动、晋升、降职、调薪、离职等全部变动记录"
      breadcrumbs={['员工管理', '人员履历']}
    >
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          {QUICK_RANGES.map((r) => (
            <Button
              key={r.key}
              size="small"
              type={quick === r.key ? 'primary' : 'default'}
              onClick={() => handleQuick(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </Space>
      </div>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => fetchData(pagination.current, pagination.pageSize, filters)}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={[
          { key: 'export', label: '导出报表', type: 'outline', onClick: handleExport },
        ]}
        pagination={pagination}
        onPageChange={handlePageChange}
        bordered
      />
    </PageContainer>
  );
}