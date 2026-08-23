'use client';

import { useState } from 'react';
import { Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { useCachedData } from '@/hooks/use-cached-data';
import { attendanceApi, DailyRecord, DailyListResult } from '@/services/attendance';
import { SearchFieldConfig } from '@/components/SearchForm';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

const searchFields: SearchFieldConfig[] = [
  { key: 'employeeNo', label: '工号', type: 'input', placeholder: '请输入工号' },
  { key: 'startDate', label: '开始日期', type: 'date', placeholder: '请选择日期', span: 4 },
  { key: 'endDate', label: '结束日期', type: 'date', placeholder: '请选择日期', span: 4 },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'normal', label: '正常' },
      { value: 'abnormal', label: '异常' },
      { value: 'leave', label: '请假' },
      { value: 'absent', label: '旷工' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'green' },
  abnormal: { label: '异常', color: 'red' },
  leave: { label: '请假', color: 'arcoblue' },
  absent: { label: '旷工', color: 'orangered' },
};

export default function AttendanceDailyPage() {
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  // SWR 缓存：以 页码/大小/筛选条件 为 key。同一查询在有效期内切回本页直接复用，不重复请求。
  const cacheKey = `attendance:daily:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<DailyListResult>(
    cacheKey,
    () => attendanceApi.getDailyList({ page, pageSize, ...searchParams }),
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

  // 导出 Excel：拉取符合当前筛选条件的全部日报
  const handleExport = async () => {
    try {
      const res = await attendanceApi.getDailyList({ page: 1, pageSize: 10000, ...searchParams });
      const list = (res.data?.list ?? []) as DailyRecord[];
      const statusLabel: Record<string, string> = {
        normal: '正常', abnormal: '异常', leave: '请假', absent: '旷工',
      };
      if (!exportToExcel(
        `考勤日报_${new Date().toISOString().slice(0, 10)}.xlsx`,
        '考勤日报',
        [
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'employeeName' },
          { title: '部门', dataIndex: 'departmentName' },
          { title: '日期', dataIndex: 'date' },
          { title: '班次', dataIndex: 'shiftName' },
          { title: '上班打卡', dataIndex: 'checkIn' },
          { title: '下班打卡', dataIndex: 'checkOut' },
          { title: '工时(小时)', dataIndex: 'workHours' },
          { title: '状态', value: (r: DailyRecord) => statusLabel[r.status] ?? r.status },
        ],
        list,
      )) {
        Message.info('当前没有可导出的日报数据');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPage(page);
    setPageSize(pageSize);
  };

  const handleRecalc = async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    try {
      const result = await attendanceApi.recalcDaily({
        startDate: startOfMonth,
        endDate: endOfMonth,
      });
      if (result.code === 0) {
        Message.success(`重新计算完成，更新 ${result.data?.updated || 0} 条记录`);
        await revalidate();
      } else {
        Message.error(result.message || '计算失败');
      }
    } catch (e) {
      Message.error('计算失败');
    }
  };

  // 模拟打卡：生成一条当前时间的打卡记录（等价于打卡机推一条数据）
  const handleDemoPunch = async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const csv = `工号,打卡时间,设备号\nE001,${ts},DEMO-001`;
    try {
      const result = await attendanceApi.importPunchLogs(csv);
      if (result.code === 0) {
        Message.success(`模拟打卡成功（E001 ${ts}），正在重算日报...`);
        await handleRecalc();
      } else {
        Message.error(result.message || '模拟打卡失败');
      }
    } catch (e) {
      Message.error('模拟打卡失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '班次', dataIndex: 'shiftName', width: 100 },
    { title: '工时(小时)', dataIndex: 'workHours', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'demo-punch', label: '模拟打卡', type: 'primary', onClick: handleDemoPunch, disabled: !can('attendance:manage') },
    { key: 'recalc', label: '重新计算', onClick: handleRecalc, disabled: !can('attendance:manage') },
    { key: 'export', label: '导出 Excel', onClick: handleExport, disabled: !can('attendance:view') },
  ];

  return (
    <PageContainer title="考勤日报">
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
