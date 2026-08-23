'use client';

import { useState, useEffect } from 'react';
import { Message, Card, Statistic, Grid, Button, Space, Input, Typography, List } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { reportsApi, ExportTask } from '@/services/reports';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';

const { Row, Col } = Grid;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const exportStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'gray' },
  processing: { label: '生成中', color: 'arcoblue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

export default function ReportsPage() {
  const { can } = usePermission();
  const [month, setMonth] = useState(currentMonth());
  const [attendance, setAttendance] = useState<any>(undefined);
  const [labor, setLabor] = useState<any>(undefined);
  const [tasks, setTasks] = useState<ExportTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const [a, l, t] = await Promise.all([
        reportsApi.getAttendanceMonthly(m),
        reportsApi.getLaborCost(m),
        reportsApi.listExportTasks(),
      ]);
      if (a.code === 0) setAttendance(a.data);
      if (l.code === 0) setLabor(l.data);
      if (t.code === 0) setTasks(t.data?.list ?? []);
    } catch (e: any) {
      setError(e?.message || '报表加载失败');
      notifyError(e, '报表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(month);
  }, []);

  const handleQuery = () => {
    fetchAll(month);
  };

  const handleExport = async (type: 'attendance-monthly' | 'labor-cost') => {
    try {
      const res = await reportsApi.createExportTask({ type, format: 'xlsx', month });
      if (res.code === 0) {
        Message.success('导出任务已提交，生成完成后可下载');
        fetchAll(month);
      } else {
        Message.error(res.message || '导出失败');
      }
    } catch (e) {
      Message.error('导出失败');
    }
  };

  const attendanceColumns: ProTableColumn[] = [
    { title: '部门', dataIndex: 'name', width: 140 },
    { title: '人数', dataIndex: 'employeeCount', width: 80 },
    { title: '出勤天数', dataIndex: 'totalWorkDays', width: 100 },
    { title: '迟到', dataIndex: 'totalLateCount', width: 80 },
    { title: '早退', dataIndex: 'totalEarlyCount', width: 80 },
    { title: '缺勤(天)', dataIndex: 'totalAbsentDays', width: 100 },
    { title: '加班(小时)', dataIndex: 'totalOvertimeHours', width: 110 },
  ];

  const laborColumns: ProTableColumn[] = [
    { title: '部门', dataIndex: 'name', width: 140 },
    { title: '人数', dataIndex: 'totalEmployees', width: 80 },
    { title: '合计金额', dataIndex: 'totalAmount', width: 140 },
  ];

  const taskColumns: ProTableColumn[] = [
    { title: '类型', dataIndex: 'type', width: 160 },
    { title: '格式', dataIndex: 'format', width: 70 },
    { title: '月份', dataIndex: 'month', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => exportStatusMap[value]?.label || value,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, record: ExportTask) =>
        record.status === 'completed' ? (
          <Button size="small" type="text" onClick={() => window.open(`/api/v1/reports/export/${record.id}/download`, '_blank')}>
            下载
          </Button>
        ) : null,
    },
  ];

  const s1 = attendance?.summary;
  const s2 = labor?.summary;

  return (
    <PageContainer
      title="报表中心"
      action={
        <Space>
          <Input
            placeholder="月份 YYYY-MM"
            value={month}
            onChange={setMonth}
            style={{ width: 160 }}
          />
          <Button type="primary" onClick={handleQuery} loading={loading}>
            查询
          </Button>
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={`${month} 考勤月报`} loading={loading}>
            <Row gutter={8}>
              <Col span={8}><Statistic title="员工数" value={s1?.totalEmployees ?? 0} suffix="人" /></Col>
              <Col span={8}><Statistic title="出勤天数" value={s1?.totalWorkDays ?? 0} /></Col>
              <Col span={8}><Statistic title="迟到次数" value={s1?.totalLateCount ?? 0} /></Col>
              <Col span={8}><Statistic title="早退次数" value={s1?.totalEarlyCount ?? 0} /></Col>
              <Col span={8}><Statistic title="缺勤天数" value={s1?.totalAbsentDays ?? 0} /></Col>
              <Col span={8}><Statistic title="加班小时" value={s1?.totalOvertimeHours ?? 0} /></Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Button size="small" disabled={!can('reports:view')} onClick={() => handleExport('attendance-monthly')}>
                导出 Excel
              </Button>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`${month} 人力成本`} loading={loading}>
            <Row gutter={8}>
              <Col span={6}><Statistic title="人数" value={s2?.totalEmployees ?? 0} suffix="人" /></Col>
              <Col span={6}><Statistic title="基础工资" value={s2?.totalBaseSalary ?? '0'} /></Col>
              <Col span={6}><Statistic title="加班费" value={s2?.totalOvertimePay ?? '0'} /></Col>
              <Col span={6}><Statistic title="合计" value={s2?.totalAmount ?? '0'} /></Col>
            </Row>
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
          <Card title="各部门考勤" style={{ marginBottom: 16 }}>
            <ProTable
              columns={attendanceColumns}
              data={attendance?.departments ?? []}
              rowKey="id"
              loading={loading}
              error={error}
              onRetry={() => fetchAll(month)}
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="各部门人力成本" style={{ marginBottom: 16 }}>
            <ProTable
              columns={laborColumns}
              data={labor?.departments ?? []}
              rowKey="id"
              loading={loading}
              error={error}
              onRetry={() => fetchAll(month)}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Card title="导出任务">
        <ProTable
          columns={taskColumns}
          data={tasks}
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={() => fetchAll(month)}
          pagination={false}
        />
      </Card>
    </PageContainer>
  );
}
