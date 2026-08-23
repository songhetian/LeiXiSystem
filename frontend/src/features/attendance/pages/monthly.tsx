'use client';

import { useState } from 'react';
import { Button, Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { useCachedData } from '@/hooks/use-cached-data';
import { attendanceApi, MonthlyRecord, MonthlyListResult } from '@/services/attendance';
import { SearchFieldConfig } from '@/components/SearchForm';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

const searchFields: SearchFieldConfig[] = [
  { key: 'month', label: '月份', type: 'date', format: 'YYYY-MM', placeholder: '请选择月份', span: 4 },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'draft', label: '待确认' },
      { value: 'confirmed', label: '已确认' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '待确认', color: 'orange' },
  confirmed: { label: '已确认', color: 'green' },
};

/** 取当前月份，格式 YYYY-MM */
function getCurrentMonth(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export default function AttendanceMonthlyPage() {
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  // SWR 缓存：以 页码/大小/筛选条件 为 key。同一查询在有效期内切回本页直接复用，不重复请求。
  const cacheKey = `attendance:monthly:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<MonthlyListResult>(
    cacheKey,
    () => attendanceApi.getMonthlyList({ page, pageSize, ...searchParams }),
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

  // 生成月报：以当前月份（或搜索条件中的月份）为参数
  const handleGenerate = async () => {
    const month = (searchParams.month as string) || getCurrentMonth();
    try {
      const result = await attendanceApi.generateMonthly({ month });
      if (result.code === 0) {
        Message.success(`月报生成完成，共 ${result.data?.count || 0} 条记录`);
        await revalidate();
      } else {
        Message.error(result.message || '生成失败');
      }
    } catch (e) {
      Message.error('生成失败');
    }
  };

  // 导出 Excel：拉取符合当前筛选条件的全部月报
  const handleExport = async () => {
    try {
      const res = await attendanceApi.getMonthlyList({ page: 1, pageSize: 10000, ...searchParams });
      const list = (res.data?.list ?? []) as MonthlyRecord[];
      if (!exportToExcel(
        `考勤月报_${new Date().toISOString().slice(0, 10)}.xlsx`,
        '考勤月报',
        [
          { title: '工号', value: (r: MonthlyRecord) => r.employee?.employeeNo ?? r.employeeNo },
          { title: '姓名', value: (r: MonthlyRecord) => r.employee?.name ?? r.employeeName },
          { title: '部门', value: (r: MonthlyRecord) => r.employee?.department?.name ?? r.departmentName },
          { title: '月份', dataIndex: 'month' },
          { title: '出勤天数', dataIndex: 'workDays' },
          { title: '迟到次数', dataIndex: 'lateCount' },
          { title: '早退次数', dataIndex: 'earlyCount' },
          { title: '缺勤天数', dataIndex: 'absentDays' },
          { title: '请假时长(小时)', value: (r: MonthlyRecord) => ((r.leaveMinutes ?? 0) / 60).toFixed(1) },
          { title: '加班时长(小时)', dataIndex: 'overtimeHours' },
          { title: '状态', value: (r: MonthlyRecord) => (r.status === 'confirmed' ? '已确认' : '待确认') },
        ],
        list,
      )) {
        Message.info('当前没有可导出的月报数据');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  // 确认单条月报记录
  const handleConfirm = async (id: number) => {
    try {
      const result = await attendanceApi.confirmMonthly(id);
      if (result.code === 0) {
        Message.success('确认成功');
        await revalidate();
      } else {
        Message.error(result.message || '确认失败');
      }
    } catch (e) {
      Message.error('确认失败');
    }
  };

  const columns: ProTableColumn[] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
      render: (_value, record) => record.employee?.employeeNo || record.employeeNo,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      render: (_value, record) => record.employee?.name || record.employeeName,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
      render: (_value, record) => record.employee?.department?.name || record.departmentName,
    },
    { title: '月份', dataIndex: 'month', width: 100 },
    { title: '出勤天数', dataIndex: 'workDays', width: 100 },
    { title: '迟到次数', dataIndex: 'lateCount', width: 100 },
    { title: '早退次数', dataIndex: 'earlyCount', width: 100 },
    { title: '缺勤天数', dataIndex: 'absentDays', width: 100 },
    {
      title: '请假时长',
      dataIndex: 'leaveMinutes',
      width: 110,
      render: (value: number) => `${(value / 60).toFixed(1)}h`,
    },
    {
      title: '加班时长',
      dataIndex: 'overtimeHours',
      width: 110,
      render: (value: number) => `${value}h`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      width: 100,
      render: (_value, record) =>
        record.status === 'draft' ? (
          <Button
            type="text"
            size="small"
            disabled={!can('attendance:manage')}
            onClick={() => handleConfirm(record.id)}
          >
            确认
          </Button>
        ) : null,
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'generate', label: '生成月报', type: 'primary', onClick: handleGenerate, disabled: !can('attendance:manage') },
    { key: 'export', label: '导出 Excel', onClick: handleExport, disabled: !can('attendance:view') },
  ];

  return (
    <PageContainer title="考勤月报">
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
        toolbar={toolbar}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </PageContainer>
  );
}
