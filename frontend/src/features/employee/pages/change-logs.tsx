'use client';

import { useState, useMemo } from 'react';
import { Tooltip, Message, Space } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { employeeApi, EmployeeChangeLog, EmployeeChangeType, EmployeeChangeLogResult, EmployeeChangeLogParams } from '@/services/employee';
import { useDepartments } from '@/hooks/use-departments';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { fetchAllPages } from '@/lib/fetch-all';
import { todayStr, formatDateTime } from '@/lib/format';
import { notifyError } from '@/lib/request';

// changeType 映射（后端 EmployeeChangeLog.changeType）
const TYPE_META: Record<EmployeeChangeType, { label: string; color: string }> = {
  admin_update: { label: '管理员修改', color: 'arcoblue' },
  self_update: { label: '本人修改', color: 'blue' },
  resign: { label: '离职', color: 'red' },
  restore: { label: '恢复', color: 'green' },
  batch_update: { label: '批量调整', color: 'purple' },
};

// 变动字段可读名（对齐参考项目的可读展示，避免直接暴露数据库字段名）
const FIELD_LABELS: Record<string, string> = {
  departmentId: '部门',
  positionId: '职位',
  status: '状态',
  resignDate: '离职日期',
  resignReason: '离职原因',
  hireDate: '入职日期',
  salary: '薪资',
  phone: '手机号',
  email: '邮箱',
  address: '地址',
  name: '姓名',
  employeeNo: '工号',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// 字段值兜底展示（null/空置横线）
function fmt(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

const baseSearchFields: SearchFieldConfig[] = [
  { key: 'keyword', label: '姓名', type: 'input', placeholder: '姓名 / 工号' },
  {
    key: 'changeType',
    label: '类型',
    type: 'select',
    placeholder: '全部类型',
    options: Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
  },
];

const columns: ProTableColumn[] = [
  {
    title: '员工',
    dataIndex: 'employee',
    width: 180,
    render: (_: unknown, r: EmployeeChangeLog) => (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--lx-text-1)' }}>{r.employee?.name ?? '-'}</div>
        <div style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>{r.employee?.employeeNo ?? ''}</div>
      </div>
    ),
  },
  {
    title: '部门',
    dataIndex: 'employee',
    width: 120,
    render: (_: unknown, r: EmployeeChangeLog) => r.employee?.department?.name ?? '—',
  },
  {
    title: '类型',
    dataIndex: 'changeType',
    width: 110,
    render: (value: EmployeeChangeType) => {
      const meta = TYPE_META[value] ?? { label: value, color: 'default' };
      // 变更类型属于状态语义，统一走公共 StatusTag
      return <StatusTag status={value} statusMap={{ [value]: meta }} />;
    },
  },
  {
    title: '变动字段',
    dataIndex: 'field',
    width: 100,
    render: (value: string) => fieldLabel(value),
  },
  {
    title: '变动内容',
    dataIndex: 'field',
    ellipsis: true,
    render: (_: unknown, r: EmployeeChangeLog) => (
      <Space size={4}>
        <span style={{ color: 'var(--lx-text-3)' }}>{fmt(r.oldValue)}</span>
        <span style={{ color: 'var(--lx-text-4)' }}>→</span>
        <Tooltip content={`${fieldLabel(r.field)}：${fmt(r.oldValue)} → ${fmt(r.newValue)}`}>
          <span style={{ color: 'var(--lx-primary)', fontWeight: 500 }}>{fmt(r.newValue)}</span>
        </Tooltip>
      </Space>
    ),
  },
  {
    title: '变动时间',
    dataIndex: 'createdAt',
    width: 170,
    render: (value: unknown) => formatDateTime(value, '—'),
  },
];

export default function EmployeeChangeLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Omit<EmployeeChangeLogParams, 'page' | 'pageSize'>>({});
  const { departments } = useDepartments();

  // 部门维度筛选（对齐员工变动 / 入职审批）：前置部门下拉
  const searchFields = useMemo<SearchFieldConfig[]>(
    () => [
      {
        key: 'departmentId',
        label: '部门',
        type: 'select',
        placeholder: '请选择部门',
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
      ...baseSearchFields,
    ],
    [departments],
  );

  const cacheKey = `employee:change-logs:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<EmployeeChangeLogResult>(
    cacheKey,
    () => employeeApi.getChangeLogs({ page, pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );

  const data = result?.data?.list ?? [];
  const pagination = { current: page, pageSize, total: result?.data?.total ?? 0 };

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPage(1);
  };

  const handleReset = () => {
    setSearchParams({});
    setPage(1);
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPage(page);
    setPageSize(pageSize);
  };

  const handleExport = async () => {
    try {
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<EmployeeChangeLog>(async (page, pageSize) => {
        const res = await employeeApi.getChangeLogs({ page, pageSize, ...searchParams });
        return { list: res.data?.list ?? [], total: res.data?.total ?? 0 };
      });
      if (!exportToExcel(
        `员工变动流水_${todayStr()}.xlsx`,
        '员工变动流水',
        [
          { title: '工号', value: (r: EmployeeChangeLog) => r.employee?.employeeNo ?? '' },
          { title: '姓名', value: (r: EmployeeChangeLog) => r.employee?.name ?? '' },
          { title: '部门', value: (r: EmployeeChangeLog) => r.employee?.department?.name ?? '' },
          { title: '类型', value: (r: EmployeeChangeLog) => (TYPE_META[r.changeType]?.label ?? r.changeType) },
          { title: '变动字段', value: (r: EmployeeChangeLog) => fieldLabel(r.field) },
          { title: '原值', value: (r: EmployeeChangeLog) => fmt(r.oldValue) },
          { title: '新值', value: (r: EmployeeChangeLog) => fmt(r.newValue) },
          { title: '变动时间', value: (r: EmployeeChangeLog) => formatDateTime(r.createdAt, '—') },
        ],
        list,
      )) {
        Message.info('当前没有可导出的变动流水');
      }
    } catch (e) {
      notifyError(e, '导出失败');
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
        onRetry={() => revalidate()}
        searchFields={searchFields}
        searchColumn={3}
        searchExpandable={false}
        searchInlineActions
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