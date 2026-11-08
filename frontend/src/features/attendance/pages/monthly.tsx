'use client';

import { useState, useMemo } from 'react';
import { Message, Modal } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { ConfirmButton } from '@/components/ConfirmButton';
import { PermissionGate } from '@/components/PermissionGate';
import { useCachedData } from '@/hooks/use-cached-data';
import { useDepartments } from '@/hooks/use-departments';
import { attendanceApi, MonthlyRecord, MonthlyListResult, MonthlyListParams } from '@/services/attendance';
import { SearchFieldConfig } from '@/components/SearchForm';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { fetchAllPages } from '@/lib/fetch-all';
import { todayStr, getTzParts } from '@/lib/format';

const baseSearchFields: SearchFieldConfig[] = [
  // 月份统一用月选择器，避免手输 2026-8 / 2026/08 这类查不到的写法
  { key: 'month', label: '月份', type: 'month', placeholder: '请选择月份', span: 4 },
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

/** 取当前月份，格式 YYYY-MM（按北京时间，宿主机时区不同也不会在月初取到上个月） */
function getCurrentMonth(): string {
  const { Y, M } = getTzParts(new Date());
  return `${Y}-${M}`;
}

export default function AttendanceMonthlyPage() {
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Omit<MonthlyListParams, 'page' | 'pageSize'>>({});
  const { departments } = useDepartments();

  // 部门维度筛选：后端 GET /attendance/monthly 已支持 departmentId，这里补前端入口
  const searchFields = useMemo<SearchFieldConfig[]>(
    () => [
      ...baseSearchFields,
      {
        key: 'departmentId',
        label: '部门',
        type: 'select',
        placeholder: '请选择部门',
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
    ],
    [departments],
  );

  // SWR 缓存：以 页码/大小/筛选条件 为 key。同一查询在有效期内切回本页直接复用，不重复请求。
  const cacheKey = `attendance:monthly:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<MonthlyListResult>(
    cacheKey,
    async () => {
      const res = await attendanceApi.getMonthlyList({ page, pageSize, ...searchParams });
      // 业务码非 0 视为失败，否则表格会显示成「暂无数据」
      if (res.code !== 0) throw new Error(res.message || '考勤月报读取失败');
      return res;
    },
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
  const runGenerate = async (month: string) => {
    try {
      const result = await attendanceApi.generateMonthly({ month });
      if (result.code === 0) {
        Message.success(`月报生成完成，共 ${result.data?.count || 0} 条记录`);
        await revalidate();
      } else {
        Message.error(result.message || '生成失败');
      }
    } catch {
      Message.error('生成失败');
    }
  };

  // 生成会按当月考勤重算并覆盖已有草稿月报，动手前把月份写清楚
  const handleGenerate = () => {
    const month = (searchParams.month as string) || getCurrentMonth();
    Modal.confirm({
      title: '生成考勤月报',
      content: `将按 ${month} 的日报重算并生成月报（已确认的月份会被后端拒绝）。确定继续吗？`,
      okText: '开始生成',
      cancelText: '取消',
      onOk: () => runGenerate(month),
    });
  };

  // 导出 Excel：拉取符合当前筛选条件的全部月报
  const handleExport = async () => {
    try {
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<MonthlyRecord>(async (page, pageSize) => {
        const res = await attendanceApi.getMonthlyList({ page, pageSize, ...searchParams });
        if (res.code !== 0) throw new Error(res.message || '导出失败');
        return { list: res.data?.list ?? [], total: res.data?.total ?? 0 };
      });
      if (!exportToExcel(
        `考勤月报_${todayStr()}.xlsx`,
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
          {
            title: '加班明细(平/休/法定)',
            value: (r: MonthlyRecord) =>
              `${Number(r.overtimeWeekdayHours ?? 0)} / ${Number(r.overtimeWeekendHours ?? 0)} / ${Number(r.overtimeHolidayHours ?? 0)}`,
          },
          { title: '状态', value: (r: MonthlyRecord) => (r.status === 'confirmed' ? '已确认' : '待确认') },
        ],
        list,
      )) {
        Message.info('当前没有可导出的月报数据');
      }
    } catch (e) {
      Message.error(e instanceof Error ? e.message : '导出失败');
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
    } catch {
      Message.error('确认失败');
    }
  };

  // 撤销确认：确认会锁住当月（再次生成会被后端拒绝），需要修正时先退回草稿
  const handleUnconfirm = async (id: number) => {
    try {
      const result = await attendanceApi.unconfirmMonthly(id);
      if (result.code === 0) {
        Message.success('已撤销确认');
        await revalidate();
      } else {
        Message.error(result.message || '撤销确认失败');
      }
    } catch {
      Message.error('撤销确认失败');
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
    { title: '出勤天数', dataIndex: 'workDays', width: 100, align: 'center' },
    { title: '迟到次数', dataIndex: 'lateCount', width: 100, align: 'center' },
    { title: '早退次数', dataIndex: 'earlyCount', width: 100, align: 'center' },
    { title: '缺勤天数', dataIndex: 'absentDays', width: 100, align: 'center' },
    {
      title: '请假时长',
      dataIndex: 'leaveMinutes',
      width: 110,
      align: 'center',
      render: (value: number | null) => `${(Number(value ?? 0) / 60).toFixed(1)}h`,
    },
    {
      title: '加班时长',
      dataIndex: 'overtimeHours',
      width: 110,
      align: 'center',
      render: (value: unknown) => `${Number(value ?? 0)}h`,
    },
    {
      title: '加班明细(平/休/法定)',
      dataIndex: 'overtimeWeekdayHours',
      width: 190,
      align: 'center',
      render: (_: unknown, r: MonthlyRecord) =>
        `${Number(r.overtimeWeekdayHours ?? 0)} / ${Number(r.overtimeWeekendHours ?? 0)} / ${Number(r.overtimeHolidayHours ?? 0)} h`,
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
      width: 130,
      render: (_value, record) => (
        // 确认/撤销确认是月结写操作：无 attendance:manage 不渲染
        <PermissionGate code="attendance:manage">
          {record.status === 'draft' ? (
            <ConfirmButton
              type="text"
              size="small"
              title="确认月报"
              content={`确认后 ${record.employee?.name || record.employeeName || '该员工'} ${record.month} 的月报将被锁定并作为薪资核算依据，当月不能再重新生成。`}
              okText="确认并锁定"
              onConfirm={() => handleConfirm(record.id)}
            >
              确认
            </ConfirmButton>
          ) : (
            <ConfirmButton
              type="text"
              size="small"
              status="warning"
              title="撤销确认"
              content={`撤销后 ${record.employee?.name || record.employeeName || '该员工'} ${record.month} 的月报回到待确认，可重新生成。已据此核算的工资不会自动回滚。`}
              okText="确认撤销"
              onConfirm={() => handleUnconfirm(record.id)}
            >
              撤销确认
            </ConfirmButton>
          )}
        </PermissionGate>
      ),
    },
  ];

  // 生成月报是考勤管理写操作：无权限时工具栏不渲染（导出为查看类，不受限）
  const manageActions: ProTableToolbarAction[] = [
    { key: 'generate', label: '生成月报', type: 'primary', onClick: handleGenerate },
  ];
  const toolbar: ProTableToolbarAction[] = [
    ...(can('attendance:manage') ? manageActions : []),
    { key: 'export', label: '导出 Excel', onClick: handleExport, disabled: !can('attendance:view') },
  ];

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
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </PageContainer>
  );
}
