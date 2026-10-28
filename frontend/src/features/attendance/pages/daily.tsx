'use client';

import { useState, useMemo } from 'react';
import { Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { useCachedData } from '@/hooks/use-cached-data';
import { useDepartments } from '@/hooks/use-departments';
import { attendanceApi, DailyRecord, DailyListResult, DailyListParams } from '@/services/attendance';
import { SearchFieldConfig } from '@/components/SearchForm';
import { usePermission } from '@/hooks/use-permission';
import { Empty } from '@arco-design/web-react';
import { exportToExcel } from '@/lib/excel';
import { todayStr, getTzParts } from '@/lib/format';

const baseSearchFields: SearchFieldConfig[] = [
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
      { value: 'makeup', label: '补卡' },
      { value: 'leave', label: '请假' },
      { value: 'absent', label: '旷工' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'green' },
  abnormal: { label: '异常', color: 'red' },
  makeup: { label: '补卡', color: 'arcoblue' },
  leave: { label: '请假', color: 'arcoblue' },
  absent: { label: '旷工', color: 'orangered' },
};

export default function AttendanceDailyPage() {
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Omit<DailyListParams, 'page' | 'pageSize'>>({});
  const { departments } = useDepartments();

  // 部门维度筛选：后端 GET /attendance/daily 已支持 departmentId，这里补前端入口
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
  const cacheKey = `attendance:daily:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<DailyListResult>(
    cacheKey,
    async () => {
      const res = await attendanceApi.getDailyList({ page, pageSize, ...searchParams });
      // 业务码非 0 视为失败，避免失败被渲染成「暂无日报数据」
      if (res.code !== 0) throw new Error(res.message || '考勤日报读取失败');
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

  // 导出 Excel：拉取符合当前筛选条件的全部日报
  const handleExport = async () => {
    try {
      const res = await attendanceApi.getDailyList({ page: 1, pageSize: 10000, ...searchParams });
      if (res.code !== 0) {
        Message.error(res.message || '导出失败');
        return;
      }
      const list = (res.data?.list ?? []) as DailyRecord[];
      if (!exportToExcel(
        `考勤日报_${todayStr()}.xlsx`,
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
          // 状态文案复用列表的 statusMap：此前另抄一份缺了「补卡」，
          // 导出里补卡行会原样吐 makeup
          { title: '状态', value: (r: DailyRecord) => statusMap[r.status]?.label ?? r.status },
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
    // 重算范围按【北京时间】当月首末日构造：new Date(y, m, 1).toISOString() 会先把
    // 东八区月初零点换算成 UTC 再截断，得到的是上月末日（9/1 → '2026-08-31'），
    // 月末同理丢掉最后一天（9/30 → '2026-09-29'）。这里直接拼北京时间的日期串。
    const { Y, M } = getTzParts(new Date());
    const lastDay = new Date(Date.UTC(Number(Y), Number(M), 0)).getUTCDate();
    const startOfMonth = `${Y}-${M}-01`;
    const endOfMonth = `${Y}-${M}-${String(lastDay).padStart(2, '0')}`;

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
    } catch {
      Message.error('计算失败');
    }
  };

  // 模拟打卡：生成一条当前时间的打卡记录（等价于打卡机推一条数据）
  // 时间戳按展示时区（北京时间）拼装：宿主机时区不一定是 +08，用本地时间会打出偏移的打卡点
  const handleDemoPunch = async () => {
    const { Y, M, D, HH, mm, ss } = getTzParts(new Date());
    const ts = `${Y}-${M}-${D} ${HH}:${mm}:${ss}`;
    const csv = `工号,打卡时间,设备号\nE001,${ts},DEMO-001`;
    try {
      const result = await attendanceApi.importPunchLogs(csv);
      if (result.code === 0) {
        Message.success(`模拟打卡成功（E001 ${ts}），正在重算日报...`);
        await handleRecalc();
      } else {
        Message.error(result.message || '模拟打卡失败');
      }
    } catch {
      Message.error('模拟打卡失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '班次', dataIndex: 'shiftName', width: 100 },
    { title: '工时(小时)', dataIndex: 'workHours', width: 100, align: 'right' },
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
    <PageContainer>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        emptyElement={
          <Empty
            description={
              <div className="text-center">
                <p className="text-text-2 text-sm">暂无日报数据</p>
                <p className="text-text-3 text-xs mt-1">
                  日报由打卡与排班生成，可点击右上角「重新计算」生成
                </p>
              </div>
            }
          />
        }
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
