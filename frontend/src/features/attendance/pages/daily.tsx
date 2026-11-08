'use client';

import { useState, useMemo } from 'react';
import { Message, Modal } from '@arco-design/web-react';
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
import { fetchAllPages } from '@/lib/fetch-all';
import { formatDate, todayStr, getTzParts } from '@/lib/format';

/**
 * 日报状态：与后端 AttendanceDailyStatus 枚举一一对应。
 * 漏掉的枚举会原样吐英文（late_early / half_absent…），业务方读不懂。
 */
const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'green' },
  late: { label: '迟到', color: 'red' },
  early: { label: '早退', color: 'red' },
  late_early: { label: '迟到+早退', color: 'red' },
  absent: { label: '旷工', color: 'orangered' },
  half_absent: { label: '半天旷工', color: 'orangered' },
  abnormal: { label: '异常', color: 'gold' },
  makeup: { label: '补卡', color: 'arcoblue' },
  leave: { label: '请假', color: 'purple' },
  holiday: { label: '节假日出勤', color: 'purple' },
  weekend: { label: '周末出勤', color: 'gray' },
};

const statusOptions = Object.entries(statusMap).map(([value, { label }]) => ({ value, label }));

const baseSearchFields: SearchFieldConfig[] = [
  // 后端只接受 employeeId：此前用「工号」文本框，填了也被接口忽略，筛选看起来毫无反应
  { key: 'employeeId', label: '员工', type: 'employee', placeholder: '搜索姓名或工号', span: 4 },
  { key: 'startDate', label: '开始日期', type: 'date', placeholder: '请选择日期', span: 4 },
  { key: 'endDate', label: '结束日期', type: 'date', placeholder: '请选择日期', span: 4 },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: statusOptions,
  },
];

/** 迟到/早退分钟数为 0 时展示 --，避免一眼看去全是 0 */
const minutesText = (v: number | null | undefined) => (v && v > 0 ? String(v) : '--');

/** 加班分钟 → 小时（保留 1 位），0 展示 -- */
const overtimeText = (v: number | null | undefined) =>
  v && v > 0 ? (v / 60).toFixed(1) : '--';

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
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<DailyRecord>(async (page, pageSize) => {
        const res = await attendanceApi.getDailyList({ page, pageSize, ...searchParams });
        if (res.code !== 0) throw new Error(res.message || '导出失败');
        return { list: res.data?.list ?? [], total: res.data?.total ?? 0 };
      });
      if (!exportToExcel(
        `考勤日报_${todayStr()}.xlsx`,
        '考勤日报',
        [
          // 导出口径与列表保持一致：字段是嵌套的 employee/shift，状态走 statusMap
          { title: '工号', value: (r: DailyRecord) => r.employee?.employeeNo ?? '' },
          { title: '姓名', value: (r: DailyRecord) => r.employee?.name ?? '' },
          { title: '部门', value: (r: DailyRecord) => r.employee?.department?.name ?? '' },
          { title: '日期', value: (r: DailyRecord) => formatDate(r.workDate, 'YYYY-MM-DD', '') },
          { title: '班次', value: (r: DailyRecord) => r.shift?.name ?? '' },
          { title: '上班打卡', value: (r: DailyRecord) => formatDate(r.firstPunch, 'HH:mm', '') },
          { title: '下班打卡', value: (r: DailyRecord) => formatDate(r.lastPunch, 'HH:mm', '') },
          { title: '迟到(分)', dataIndex: 'lateMinutes' },
          { title: '早退(分)', dataIndex: 'earlyMinutes' },
          {
            title: '加班(小时)',
            value: (r: DailyRecord) => ((r.overtimeMinutes ?? 0) / 60).toFixed(1),
          },
          // 状态文案复用列表的 statusMap：此前另抄一份缺了「补卡」，
          // 导出里补卡行会原样吐 makeup
          { title: '状态', value: (r: DailyRecord) => statusMap[r.status]?.label ?? r.status },
        ],
        list,
      )) {
        Message.info('当前没有可导出的日报数据');
      }
    } catch (e) {
      // 业务码非 0 时把后端原因透出来，而不是笼统的「导出失败」
      Message.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPage(page);
    setPageSize(pageSize);
  };

  const runRecalc = async () => {
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
        Message.success(`重新计算完成，更新 ${result.data?.count || 0} 条记录`);
        await revalidate();
      } else {
        Message.error(result.message || '计算失败');
      }
    } catch {
      Message.error('计算失败');
    }
  };

  // 重算会覆盖当月已生成的日报（含人工补卡后的结果），动手前把范围写清楚
  const handleRecalc = () => {
    const { Y, M } = getTzParts(new Date());
    const lastDay = new Date(Date.UTC(Number(Y), Number(M), 0)).getUTCDate();
    Modal.confirm({
      title: '重新计算日报',
      content: `将按排班与打卡重算北京时间 ${Y}-${M}-01 ~ ${Y}-${M}-${String(lastDay).padStart(2, '0')} 的日报，并覆盖现有计算结果。`,
      okText: '开始重算',
      cancelText: '取消',
      onOk: () => runRecalc(),
    });
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
        await runRecalc();
      } else {
        Message.error(result.message || '模拟打卡失败');
      }
    } catch {
      Message.error('模拟打卡失败');
    }
  };

  const columns: ProTableColumn[] = [
    // 字段全部取后端真实出参：嵌套 employee / shift，打卡时间取 firstPunch / lastPunch
    { title: '工号', dataIndex: 'employeeNo', width: 100, render: (_: any, r: DailyRecord) => r.employee?.employeeNo ?? '--' },
    { title: '姓名', dataIndex: 'employeeName', width: 100, render: (_: any, r: DailyRecord) => r.employee?.name ?? '--' },
    { title: '部门', dataIndex: 'departmentName', width: 120, render: (_: any, r: DailyRecord) => r.employee?.department?.name ?? '--' },
    { title: '日期', dataIndex: 'workDate', width: 110, render: (v: string) => formatDate(v) },
    { title: '班次', dataIndex: 'shiftName', width: 100, render: (_: any, r: DailyRecord) => r.shift?.name ?? '--' },
    { title: '上班打卡', dataIndex: 'firstPunch', width: 100, render: (v: string | null) => formatDate(v, 'HH:mm', '--') },
    { title: '下班打卡', dataIndex: 'lastPunch', width: 100, render: (v: string | null) => formatDate(v, 'HH:mm', '--') },
    { title: '迟到(分)', dataIndex: 'lateMinutes', width: 90, align: 'center', render: (v: number) => minutesText(v) },
    { title: '早退(分)', dataIndex: 'earlyMinutes', width: 90, align: 'center', render: (v: number) => minutesText(v) },
    { title: '加班(小时)', dataIndex: 'overtimeMinutes', width: 110, align: 'center', render: (v: number) => overtimeText(v) },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
  ];

  // 模拟打卡/重算是考勤管理写操作：无 attendance:manage 时工具栏不渲染（导出为查看类，不受限）
  const canManage = can('attendance:manage');
  const manageActions: ProTableToolbarAction[] = [
    { key: 'demo-punch', label: '模拟打卡', type: 'primary', onClick: handleDemoPunch },
    { key: 'recalc', label: '重新计算', onClick: handleRecalc },
  ];
  const toolbar: ProTableToolbarAction[] = [
    ...(canManage ? manageActions : []),
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
