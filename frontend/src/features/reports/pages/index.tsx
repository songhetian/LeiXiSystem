'use client';

import { useState } from 'react';
import { Message, Card, Statistic, Grid, Button, Space, DatePicker } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import DataState from '@/components/DataState';
import StatusTag from '@/components/StatusTag';
import { reportsApi, ExportTask } from '@/services/reports';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { formatMoney, getTzParts } from '@/lib/format';

const { Row, Col } = Grid;

/**
 * 当前月份一律按北京时间取：宿主机（或容器）用 UTC 时，月末最后几小时
 * 会算出上一个月，报表默认月份就错了。
 */
function currentMonth(): string {
  const { Y, M } = getTzParts(new Date());
  return `${Y}-${M}`;
}

const exportStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'gray' },
  processing: { label: '生成中', color: 'arcoblue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

/** 导出任务类型 → 业务文案（后端存的是 attendance-monthly / labor-cost 这类编码） */
const exportTypeMap: Record<string, string> = {
  'attendance-monthly': '考勤月报',
  'labor-cost': '人力成本',
};

export default function ReportsPage() {
  const { can } = usePermission();
  const [month, setMonth] = useState(currentMonth());

  // 考勤月报（随月份变化）
  const { data: attRes, loading: attLoading, error: attError, revalidate: attRevalidate } = useCachedData<{
    code: number;
    data?: any;
  }>(
    `reports:attendance:${month}`,
    async () => {
      const res = await reportsApi.getAttendanceMonthly(month);
      // 业务码非 0 视为失败：否则页面会把失败当「0 人 0 天」展示
      if (res.code !== 0) throw new Error(res.message || '考勤月报读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const attendance = attRes?.code === 0 && attRes.data ? attRes.data : undefined;

  // 人力成本（随月份变化）
  const { data: laborRes, loading: laborLoading, error: laborError, revalidate: laborRevalidate } = useCachedData<{
    code: number;
    data?: any;
  }>(
    `reports:labor-cost:${month}`,
    async () => {
      const res = await reportsApi.getLaborCost(month);
      if (res.code !== 0) throw new Error(res.message || '人力成本读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const labor = laborRes?.code === 0 && laborRes.data ? laborRes.data : undefined;

  // 员工结构：共享缓存
  const {
    data: structRes,
    loading: structLoading,
    error: structError,
    revalidate: structRevalidate,
  } = useCachedData<{ code: number; data?: any }>(
    'reports:employee-structure',
    async () => {
      const res = await reportsApi.getEmployeeStructure();
      if (res.code !== 0) throw new Error(res.message || '员工结构读取失败');
      return res;
    },
    { staleTime: 60_000 },
  );
  const structure = structRes?.code === 0 && structRes.data ? structRes.data : undefined;

  // 导出任务
  const {
    data: tasksRes,
    loading: taskLoading,
    error: taskError,
    revalidate: tasksRevalidate,
  } = useCachedData<{
    code: number;
    data?: { list: ExportTask[] };
  }>(
    'reports:export-tasks',
    async () => {
      const res = await reportsApi.listExportTasks();
      if (res.code !== 0) throw new Error(res.message || '导出任务读取失败');
      return { code: res.code, data: res.data ?? undefined };
    },
    { staleTime: 10_000 },
  );
  const tasks = tasksRes?.code === 0 && tasksRes.data ? tasksRes.data.list ?? [] : [];

  // 查询按钮的忙碌态：只跟「随月份变化」的两路请求走
  const queryLoading = attLoading || laborLoading;

  const handleQuery = () => {
    void attRevalidate();
    void laborRevalidate();
    void structRevalidate();
    void tasksRevalidate();
  };

  const handleExport = async (type: 'attendance-monthly' | 'labor-cost') => {
    try {
      const res = await reportsApi.createExportTask({ type, format: 'xlsx', month });
      if (res.code === 0) {
        Message.success('导出任务已提交，生成完成后可下载');
        void tasksRevalidate();
      } else {
        Message.error(res.message || '导出失败');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  // 失败的导出任务允许重试（后端只接受 failed 状态），重试后回到排队中
  const handleRetryTask = async (task: ExportTask) => {
    try {
      const res = await reportsApi.retryExportTask(task.id);
      if (res.code === 0) {
        Message.success('已重新提交导出任务');
        void tasksRevalidate();
      } else {
        Message.error(res.message || '重试失败');
      }
    } catch {
      Message.error('重试失败');
    }
  };

  const attendanceColumns: ProTableColumn[] = [
    { title: '部门', dataIndex: 'name', width: 140 },
    { title: '人数', dataIndex: 'employeeCount', width: 80, align: 'right' },
    { title: '出勤天数', dataIndex: 'totalWorkDays', width: 100, align: 'right' },
    { title: '迟到', dataIndex: 'totalLateCount', width: 80, align: 'right' },
    { title: '早退', dataIndex: 'totalEarlyCount', width: 80, align: 'right' },
    { title: '缺勤(天)', dataIndex: 'totalAbsentDays', width: 100, align: 'right' },
    { title: '加班(小时)', dataIndex: 'totalOvertimeHours', width: 110, align: 'right' },
  ];

  const laborColumns: ProTableColumn[] = [
    { title: '部门', dataIndex: 'name', width: 140 },
    { title: '人数', dataIndex: 'totalEmployees', width: 80, align: 'right' },
    {
      title: '合计金额',
      dataIndex: 'totalAmount',
      width: 150,
      align: 'right',
      render: (v: unknown) => `¥ ${formatMoney(v)}`,
    },
  ];

  const taskColumns: ProTableColumn[] = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 160,
      // 类型列此前直接吐后端编码（attendance-monthly），业务方读不懂
      render: (value: string) => exportTypeMap[value] ?? value,
    },
    {
      title: '格式',
      dataIndex: 'format',
      width: 70,
      render: (value: string) => (value ? value.toUpperCase() : '--'),
    },
    { title: '月份', dataIndex: 'month', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      // 状态一律走 StatusTag，与全站列表状态呈现一致（不再裸文本）
      render: (value: string) => <StatusTag status={value} statusMap={exportStatusMap} />,
    },
    {
      // 失败原因必须展示：只给一个「失败」标签，用户既不知道原因也不知道能不能重试
      title: '失败原因',
      dataIndex: 'errorMsg',
      width: 220,
      ellipsis: true,
      render: (value: string | null | undefined, record: ExportTask) =>
        record.status === 'failed' ? (
          <span className="text-danger" title={value ?? ''}>
            {value || '导出失败，原因未记录'}
          </span>
        ) : null,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 110,
      render: (_: any, record: ExportTask) => {
        if (record.status === 'completed') {
          return (
            <Button
              size="small"
              type="text"
              disabled={!can('reports:view')}
              // 下载地址统一由 service 生成，避免页面里硬编码 /api/v1 前缀
              onClick={() => window.open(reportsApi.exportTaskDownloadUrl(record.id), '_blank')}
            >
              下载
            </Button>
          );
        }
        if (record.status === 'failed') {
          return (
            <Button
              size="small"
              type="text"
              disabled={!can('reports:view')}
              onClick={() => handleRetryTask(record)}
            >
              重试
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const s1 = attendance?.summary;
  const s2 = labor?.summary;
  const s3 = structure;

  const handleEmployeeExport = (format: 'xlsx' | 'csv') => {
    window.open(reportsApi.employeeListExportUrl(format), '_blank');
  };

  return (
    <PageContainer action={
        <Space>
          <DatePicker.MonthPicker
            // 月份是离散值：用月选择器而非自由文本，避免输入过程中每敲一个字符
            // 就换一次缓存键、连打多次请求
            value={month}
            onChange={(v) => v && setMonth(v)}
            allowClear={false}
            placeholder="选择月份"
            style={{ width: 160 }}
          />
          <Button type="primary" onClick={handleQuery} loading={queryLoading}>
            查询
          </Button>
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={`${month} 考勤月报`} loading={attLoading}>
            <DataState error={attError} onRetry={attRevalidate}>
              <Row gutter={8}>
                <Col span={8}><Statistic title="员工数" value={s1?.totalEmployees ?? 0} suffix="人" /></Col>
                <Col span={8}><Statistic title="出勤天数" value={Number(s1?.totalWorkDays ?? 0)} precision={1} /></Col>
                <Col span={8}><Statistic title="迟到次数" value={s1?.totalLateCount ?? 0} /></Col>
                <Col span={8}><Statistic title="早退次数" value={s1?.totalEarlyCount ?? 0} /></Col>
                <Col span={8}><Statistic title="缺勤天数" value={Number(s1?.totalAbsentDays ?? 0)} precision={1} /></Col>
                <Col span={8}><Statistic title="加班小时" value={Number(s1?.totalOvertimeHours ?? 0)} precision={1} /></Col>
              </Row>
            </DataState>
            <div style={{ marginTop: 12 }}>
              <Button size="small" disabled={!can('reports:view')} onClick={() => handleExport('attendance-monthly')}>
                导出 Excel
              </Button>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`${month} 人力成本`} loading={laborLoading}>
            <DataState error={laborError} onRetry={laborRevalidate}>
              <Row gutter={8}>
                <Col span={6}><Statistic title="人数" value={s2?.totalEmployees ?? 0} suffix="人" /></Col>
                <Col span={6}>
                  <Statistic
                    title="基础工资"
                    value={Number(s2?.totalBaseSalary ?? 0)}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="加班费"
                    value={Number(s2?.totalOvertimePay ?? 0)}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="合计"
                    value={Number(s2?.totalAmount ?? 0)}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
              </Row>
            </DataState>
            <div style={{ marginTop: 12 }}>
              <Button size="small" disabled={!can('reports:view')} onClick={() => handleExport('labor-cost')}>
                导出 Excel
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          {/* ProTable 自带统一卡片外壳，外层不再包 Card（避免卡片套卡片） */}
          <div className="text-sm font-medium text-text-1 mb-2">各部门考勤</div>
          <ProTable
            columns={attendanceColumns}
            data={attendance?.departments ?? []}
            rowKey="id"
            loading={attLoading}
            error={attError}
            onRetry={attRevalidate}
            pagination={false}
          />
        </Col>
        <Col span={12}>
          <div className="text-sm font-medium text-text-1 mb-2">各部门人力成本</div>
          <ProTable
            columns={laborColumns}
            data={labor?.departments ?? []}
            rowKey="id"
            loading={laborLoading}
            error={laborError}
            onRetry={laborRevalidate}
            pagination={false}
          />
        </Col>
      </Row>

      <Card title="员工结构" style={{ marginBottom: 16 }} loading={structLoading}>
        <DataState error={structError} onRetry={structRevalidate}>
          <Row gutter={12}>
            <Col span={8}><Statistic title="在册员工" value={s3?.total ?? 0} suffix="人" /></Col>
            <Col span={8}><Statistic title="试用期" value={s3?.onProbation ?? 0} suffix="人" /></Col>
            <Col span={8}><Statistic title="平均司龄" value={s3?.avgTenure?.formatted ?? '-'} /></Col>
          </Row>
        </DataState>
        <div style={{ marginTop: 12 }}>
          <Space>
            <Button size="small" disabled={!can('reports:view')} onClick={() => handleEmployeeExport('xlsx')}>
              导出 Excel
            </Button>
            <Button size="small" disabled={!can('reports:view')} onClick={() => handleEmployeeExport('csv')}>
              导出 CSV
            </Button>
          </Space>
        </div>
      </Card>

      {/* ProTable 自带外壳：不再用 Card 包裹，去掉卡片套卡片 */}
      <div className="text-sm font-medium text-text-1 mb-2">导出任务</div>
      <ProTable
        columns={taskColumns}
        data={tasks}
        rowKey="id"
        loading={taskLoading}
        error={taskError}
        onRetry={tasksRevalidate}
        pagination={false}
      />
    </PageContainer>
  );
}
