'use client';

import { useState, useEffect } from 'react';
import { Message, Tag, Space, Button, Card, Statistic, Grid, DatePicker } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, LeaveRecord, LeaveCreateDto, VacationBalance } from '@/services/attendance';
import { employeeApi, Employee } from '@/services/employee';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

const { Row, Col } = Grid;
const { RangePicker } = DatePicker;

export default function VacationLeavePage() {
  const { can } = usePermission();

  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leavePagination, setLeavePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveModalLoading, setLeaveModalLoading] = useState(false);

  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [vacationTypes, setVacationTypes] = useState<{ id: number; name: string }[]>([]);

  const fetchMyProfile = async () => {
    try {
      const res = await employeeApi.getMe();
      if (res.code === 0 && res.data) {
        setMyEmployee(res.data);
      }
    } catch (e) {}
  };

  const fetchBalances = async () => {
    try {
      const res = await attendanceApi.getMyBalances(new Date().getFullYear());
      if (res.code === 0 && res.data) {
        setBalances(res.data);
        const types = [...new Set(res.data.map((b) => b.vacationType.id))].map((id) => {
          const b = res.data!.find((x) => x.vacationType.id === id)!;
          return { id: b.vacationType.id, name: b.vacationType.name };
        });
        setVacationTypes(types);
      }
    } catch (e) {}
  };

  const fetchLeaves = async (page = 1, pageSize = 20) => {
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const res = await attendanceApi.getMyLeaves();
      if (res.code === 0 && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).list || [];
        const total = (res.data as any).total ?? list.length;
        setLeaves(list);
        setLeavePagination({ current: 1, pageSize: 20, total });
      }
    } catch (e: any) {
      setLeaveError(e?.message || '获取请假记录失败');
      notifyError(e, '获取请假记录失败');
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProfile();
    fetchLeaves();
    fetchBalances();
  }, []);

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      pending: { color: 'gray', text: '待提交' },
      approving: { color: 'arcoblue', text: '审批中' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' },
      cancelled: { color: 'gray', text: '已取消' },
    };
    const info = map[status] || { color: 'gray', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const handleAddLeave = () => {
    setLeaveModalVisible(true);
  };

  // 导出请假记录到 Excel
  const handleExportLeave = () => {
    const statusMap: Record<string, string> = {
      pending: '待提交', approving: '审批中', approved: '已通过', rejected: '已拒绝', cancelled: '已取消',
    };
    if (!exportToExcel(
      `请假记录_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '请假记录',
      [
        { title: '假期类型', value: (r: LeaveRecord) => (r as any).vacationType?.name ?? '-' },
        { title: '开始日期', dataIndex: 'startDate' },
        { title: '结束日期', dataIndex: 'endDate' },
        { title: '天数', dataIndex: 'days' },
        { title: '原因', dataIndex: 'reason' },
        { title: '状态', value: (r: LeaveRecord) => statusMap[r.status] ?? r.status },
      ],
      leaves as LeaveRecord[],
    )) {
      Message.info('当前没有可导出的请假记录');
    }
  };

  const handleLeaveSubmit = async (values: Record<string, any>) => {
    if (!myEmployee) {
      Message.error('未获取到员工信息');
      return;
    }
    setLeaveModalLoading(true);
    try {
      const start = new Date(values.startDate);
      const end = new Date(values.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dto: LeaveCreateDto = {
        employeeId: myEmployee.id,
        vacationTypeId: Number(values.vacationTypeId),
        startDate: values.startDate,
        endDate: values.endDate,
        days,
        reason: values.reason,
      };
      const res = await attendanceApi.createLeave(dto);
      if (res.code === 0) {
        Message.success('申请已提交，请等待审批');
        setLeaveModalVisible(false);
        fetchLeaves();
        fetchBalances();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    } finally {
      setLeaveModalLoading(false);
    }
  };

  const handleSubmitApproval = async (id: number) => {
    try {
      const res = await attendanceApi.submitLeave(id);
      if (res.code === 0) {
        Message.success('已提交审批');
        fetchLeaves();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const leaveColumns: ProTableColumn[] = [
    { title: '假期类型', dataIndex: 'vacationTypeName', width: 120, render: (_: any, r: LeaveRecord) => (r as any).vacationType?.name || '-' },
    { title: '开始日期', dataIndex: 'startDate', width: 120 },
    { title: '结束日期', dataIndex: 'endDate', width: 120 },
    { title: '天数', dataIndex: 'days', width: 80 },
    { title: '原因', dataIndex: 'reason', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => getStatusTag(value),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, record: LeaveRecord) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="text" onClick={() => handleSubmitApproval(record.id)}>提交审批</Button>
          )}
        </Space>
      ),
    },
  ];

  const leaveFormFields: FormFieldConfig[] = [
    {
      key: 'vacationTypeId',
      label: '假期类型',
      type: 'select',
      required: true,
      options: vacationTypes.map((t) => ({ value: String(t.id), label: t.name })),
    },
    { key: 'startDate', label: '开始日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'endDate', label: '结束日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'reason', label: '请假原因', type: 'textarea', required: true, placeholder: '请输入原因' },
  ];

  return (
    <PageContainer title="我的请假">
      {balances.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {balances.slice(0, 4).map((b) => {
            const remaining = Number(b.totalDays) - Number(b.usedDays);
            return (
              <Col span={6} key={b.id}>
                <Card className="rounded-md">
                  <Statistic
                    title={b.vacationType.name}
                    value={remaining}
                    suffix="天"
                    precision={1}
                    style={{ fontSize: 14 }}
                  />
                  <div className="text-xs text-text-3 mt-1">
                    剩余 {b.totalDays} 天 / 已用 {b.usedDays} 天                    </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <ProTable
        columns={leaveColumns}
        data={leaves}
        rowKey="id"
        loading={leaveLoading}
        error={leaveError}
        onRetry={() => fetchLeaves(leavePagination.current, leavePagination.pageSize)}
        toolbar={[
          { key: 'add', label: '申请请假', type: 'primary', onClick: handleAddLeave },
          { key: 'export', label: '导出 Excel', onClick: handleExportLeave },
        ]}
        pagination={leavePagination}
        onPageChange={(p, ps) => fetchLeaves(p, ps)}
      />

      <ModalForm
        visible={leaveModalVisible}
        title="申请请假"
        fields={leaveFormFields}
        onOk={handleLeaveSubmit}
        onCancel={() => setLeaveModalVisible(false)}
        confirmLoading={leaveModalLoading}
        width={500}
      />
    </PageContainer>
  );
}
