'use client';

import { useState } from 'react';
import { Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import type { SearchFieldConfig } from '@/components/SearchForm';
import { useDepartments } from '@/hooks/use-departments';
import { useCachedData } from '@/hooks/use-cached-data';
import {
  attendanceApi,
  AttendanceStatParams,
  AttendanceStatRow,
  AttendanceStatResult,
} from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';
import { getTzParts } from '@/lib/format';

/** 当前北京时间所在年月（与全站展示时区一致，避免宿主机时区偏移） */
function currentYearMonth(): { year: number; month: number } {
  const { Y, M } = getTzParts(new Date());
  return { year: Number(Y), month: Number(M) };
}

/**
 * 考勤统计：按 员工 × 月份 汇总应休/已休/剩余假期天数与加班时长。
 * 额度口径 = 本月月假额度 + 年度型额度（month=0，如年假）。
 */
export default function AttendanceStatisticsPage() {
  const { departments } = useDepartments();

  // 默认筛选（当前北京时间年月）只在挂载时算一次：
  // “重置”要回到这个默认值，且搜索框首屏应显示同样的月份，而不是空着
  const [defaults] = useState(currentYearMonth);
  const [query, setQuery] = useState<AttendanceStatParams>(defaults);
  const defaultMonth = `${defaults.year}-${String(defaults.month).padStart(2, '0')}`;

  // SWR 缓存：相同筛选条件来回切页直接复用；失败由 ProTable 展示 error 并提供重试
  const cacheKey = `attendance:statistics:${query.year}-${query.month}:${query.departmentId ?? 'all'}:${query.employeeId ?? 'all'}:${query.keyword ?? ''}`;
  const { data: res, loading, error, revalidate } = useCachedData<AttendanceStatResult>(
    cacheKey,
    async () => {
      const result = await attendanceApi.getAttendanceStatistics(query);
      // 业务错误（code!==0）不是空数据，必须抛错交给 ProTable 错误态，
      // 否则会被误读为「该月无统计数据」
      if (result.code !== 0) throw new Error(result.message || '获取考勤统计失败');
      return result;
    },
    { staleTime: 30_000 },
  );
  const rows = res?.code === 0 && res.data ? res.data.rows : [];

  // 搜索：把表单值归一化进 query，cacheKey 随之变化即触发重新拉取
  const handleSearch = (filters: Record<string, any>) => {
    let { year, month } = defaults;
    if (filters.month) {
      const [y, m] = String(filters.month).split('-').map(Number);
      if (y && m) {
        year = y;
        month = m;
      }
    }
    setQuery({
      year,
      month,
      departmentId: filters.departmentId ? Number(filters.departmentId) : undefined,
      keyword: filters.keyword || undefined,
    });
  };

  // 重置：回到默认年月口径；query 变化即触发 cacheKey 变化重新拉取
  const handleReset = () => {
    setQuery(defaults);
  };

  const handleExport = () => {
    const header = `${query.year}年${query.month}月考勤统计`;
    if (!exportToExcel(
      `考勤统计_${query.year}-${query.month}.xlsx`,
      header,
      [
        { title: '工号', dataIndex: 'employeeNo' },
        { title: '姓名', dataIndex: 'name' },
        { title: '部门', dataIndex: 'departmentName' },
        { title: '应休(天)', dataIndex: 'totalDays' },
        { title: '已休(天)', dataIndex: 'usedDays' },
        { title: '剩余(天)', dataIndex: 'remainingDays' },
        { title: '加班时长(小时)', dataIndex: 'overtimeHours' },
      ],
      rows,
    )) {
      Message.info('当前没有可导出的统计数据');
    }
  };

  const searchFields: SearchFieldConfig[] = [
    {
      key: 'month',
      label: '月份',
      type: 'month',
      placeholder: '请选择月份',
    },
    {
      key: 'departmentId',
      label: '部门',
      type: 'select',
      options: departments.map((d) => ({ value: d.id, label: d.name })),
      placeholder: '全部部门',
    },
    {
      key: 'keyword',
      label: '姓名/工号',
      type: 'input',
      placeholder: '搜索姓名或工号',
    },
  ];

  const columns: ProTableColumn[] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '部门', dataIndex: 'departmentName', width: 140, ellipsis: true },
    { title: '应休(天)', dataIndex: 'totalDays', width: 100, align: 'center' },
    { title: '已休(天)', dataIndex: 'usedDays', width: 100, align: 'center' },
    {
      title: '剩余(天)',
      dataIndex: 'remainingDays',
      width: 100,
      align: 'center',
      render: (value: number | null) =>
        value == null ? (
          '--'
        ) : (
          <span className={value < 0 ? 'text-danger' : 'text-text-1'}>{value}</span>
        ),
    },
    { title: '加班时长(小时)', dataIndex: 'overtimeHours', width: 120, align: 'center' },
  ];

  return (
    <PageContainer>
      <ProTable
        columns={columns}
        data={rows}
        rowKey="employeeId"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        searchInitialValues={{ month: defaultMonth }}
        onSearch={handleSearch}
        onReset={handleReset}
        searchColumn={3}
        searchExpandable={false}
        searchInlineActions
        toolbar={[
          // 导出是查看类工具动作，不占主按钮位（主色留给页面真正的写操作）
          { key: 'export', label: '导出 Excel', type: 'outline', onClick: handleExport },
        ]}
        pagination={false}
      />
    </PageContainer>
  );
}