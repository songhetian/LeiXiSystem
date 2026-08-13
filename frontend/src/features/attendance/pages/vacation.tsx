'use client';

import { useState, useEffect } from 'react';
import { Message, Tabs, Tag, Space, Button, Modal } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, VacationBalance, LeaveRecord, OvertimeRecord, LeaveCreateDto, OvertimeCreateDto } from '@/services/attendance';

const TabPane = Tabs.TabPane;

export default function VacationPage() {
  const [activeTab, setActiveTab] = useState('balance');

  // 额度
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balances, setBalances] = useState<VacationBalance[]>([]);

  // 请假
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leavePagination, setLeavePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveModalLoading, setLeaveModalLoading] = useState(false);

  // 加班
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [overtimePagination, setOvertimePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [overtimeModalVisible, setOvertimeModalVisible] = useState(false);
  const [overtimeModalLoading, setOvertimeModalLoading] = useState(false);

  const [vacationTypes, setVacationTypes] = useState<{ id: number; name: string }[]>([]);

  const fetchBalances = async () => {
    setBalanceLoading(true);
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
    } catch (e) {
      Message.error('获取休假额度失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchLeaves = async (page = 1, pageSize = 20) => {
    setLeaveLoading(true);
    try {
      const res = await attendanceApi.getLeaveList({ page, pageSize });
      if (res.code === 0 && res.data) {
        setLeaves(res.data.list);
        setLeavePagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      }
    } catch (e) {
      Message.error('获取请假记录失败');
    } finally {
      setLeaveLoading(false);
    }
  };

  const fetchOvertimes = async (page = 1, pageSize = 20) => {
    setOvertimeLoading(true);
    try {
      const res = await attendanceApi.getOvertimeList({ page, pageSize });
      if (res.code === 0 && res.data) {
        setOvertimes(res.data.list);
        setOvertimePagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      }
    } catch (e) {
      Message.error('获取加班记录失败');
    } finally {
      setOvertimeLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    fetchLeaves();
    fetchOvertimes();
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

  // 请假
  const handleAddLeave = () => {
    setLeaveModalVisible(true);
  };

  const handleLeaveSubmit = async (values: Record<string, any>) => {
    setLeaveModalLoading(true);
    try {
      const days = Math.ceil(
        (new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      const dto: LeaveCreateDto = {
        employeeId: Number(values.employeeId),
        vacationTypeId: Number(values.vacationTypeId),
        startDate: values.startDate,
        endDate: values.endDate,
        days,
        reason: values.reason,
      };
      const res = await attendanceApi.createLeave(dto);
      if (res.code === 0) {
        Message.success('提交成功');
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

  const handleSubmitLeaveApproval = async (id: number) => {
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

  // 加班
  const handleAddOvertime = () => {
    setOvertimeModalVisible(true);
  };

  const handleOvertimeSubmit = async (values: Record<string, any>) => {
    setOvertimeModalLoading(true);
    try {
      const [startH, startM] = values.startTime.split(':').map(Number);
      const [endH, endM] = values.endTime.split(':').map(Number);
      let hours = (endH * 60 + endM - startH * 60 - startM) / 60;
      if (hours <= 0) hours += 24;
      const dto: OvertimeCreateDto = {
        employeeId: Number(values.employeeId),
        overtimeDate: values.overtimeDate,
        startTime: values.startTime,
        endTime: values.endTime,
        hours: Math.round(hours * 10) / 10,
        reason: values.reason,
      };
      const res = await attendanceApi.createOvertime(dto);
      if (res.code === 0) {
        Message.success('提交成功');
        setOvertimeModalVisible(false);
        fetchOvertimes();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    } finally {
      setOvertimeModalLoading(false);
    }
  };

  const handleSubmitOvertimeApproval = async (id: number) => {
    try {
      const res = await attendanceApi.submitOvertime(id);
      if (res.code === 0) {
        Message.success('已提交审批');
        fetchOvertimes();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const balanceColumns: ProTableColumn[] = [
    { title: '假期类型', dataIndex: 'vacationTypeName', width: 140, render: (_: any, r: VacationBalance) => r.vacationType?.name },
    { title: '年度', dataIndex: 'year', width: 100 },
    { title: '总天数', dataIndex: 'totalDays', width: 100 },
    { title: '已用', dataIndex: 'usedDays', width: 100 },
    {
      title: '剩余',
      dataIndex: 'remaining',
      width: 100,
      render: (_: any, r: VacationBalance) => {
        const remaining = Number(r.totalDays) - Number(r.usedDays);
        return <Tag color={remaining > 0 ? 'green' : 'red'}>{remaining.toFixed(1)} 天</Tag>;
      },
    },
  ];

  const leaveColumns: ProTableColumn[] = [
    { title: '假期类型', dataIndex: 'vacationTypeName', width: 120, render: (_: any, r: LeaveRecord) => r.vacationType?.name },
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
            <Button size="small" type="text" onClick={() => handleSubmitLeaveApproval(record.id)}>提交审批</Button>
          )}
        </Space>
      ),
    },
  ];

  const overtimeColumns: ProTableColumn[] = [
    { title: '加班日期', dataIndex: 'overtimeDate', width: 120 },
    { title: '开始时间', dataIndex: 'startTime', width: 100 },
    { title: '结束时间', dataIndex: 'endTime', width: 100 },
    { title: '时长(小时)', dataIndex: 'hours', width: 100 },
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
      render: (_: any, record: OvertimeRecord) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="text" onClick={() => handleSubmitOvertimeApproval(record.id)}>提交审批</Button>
          )}
        </Space>
      ),
    },
  ];

  const leaveFormFields: FormFieldConfig[] = [
    { key: 'employeeId', label: '员工ID', type: 'input', required: true, placeholder: '请输入员工ID' },
    {
      key: 'vacationTypeId',
      label: '假期类型',
      type: 'select',
      required: true,
      options: vacationTypes.map((t) => ({ value: String(t.id), label: t.name })),
    },
    { key: 'startDate', label: '开始日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'endDate', label: '结束日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'reason', label: '请假原因', type: 'input', required: true, placeholder: '请输入原因' },
  ];

  const overtimeFormFields: FormFieldConfig[] = [
    { key: 'employeeId', label: '员工ID', type: 'input', required: true, placeholder: '请输入员工ID' },
    { key: 'overtimeDate', label: '加班日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'startTime', label: '开始时间', type: 'input', required: true, placeholder: '如 18:00' },
    { key: 'endTime', label: '结束时间', type: 'input', required: true, placeholder: '如 21:00' },
    { key: 'reason', label: '加班原因', type: 'input', placeholder: '请输入原因' },
  ];

  return (
    <AppLayout title="休假管理" activeMenu="attendance">
      <PageContainer title="休假管理">
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="balance" title="休假额度">
            <ProTable
              columns={balanceColumns}
              data={balances}
              rowKey="id"
              loading={balanceLoading}
              pagination={false}
            />
          </TabPane>
          <TabPane key="leave" title="请假记录">
            <ProTable
              columns={leaveColumns}
              data={leaves}
              rowKey="id"
              loading={leaveLoading}
              toolbar={[{ key: 'add', label: '申请请假', type: 'primary', onClick: handleAddLeave }]}
              pagination={leavePagination}
              onPageChange={(p, ps) => fetchLeaves(p, ps)}
            />
          </TabPane>
          <TabPane key="overtime" title="加班记录">
            <ProTable
              columns={overtimeColumns}
              data={overtimes}
              rowKey="id"
              loading={overtimeLoading}
              toolbar={[{ key: 'add', label: '申请加班', type: 'primary', onClick: handleAddOvertime }]}
              pagination={overtimePagination}
              onPageChange={(p, ps) => fetchOvertimes(p, ps)}
            />
          </TabPane>
        </Tabs>

        <ModalForm
          visible={leaveModalVisible}
          title="申请请假"
          fields={leaveFormFields}
          onOk={handleLeaveSubmit}
          onCancel={() => setLeaveModalVisible(false)}
          confirmLoading={leaveModalLoading}
          width={500}
        />

        <ModalForm
          visible={overtimeModalVisible}
          title="申请加班"
          fields={overtimeFormFields}
          onOk={handleOvertimeSubmit}
          onCancel={() => setOvertimeModalVisible(false)}
          confirmLoading={overtimeModalLoading}
          width={500}
        />
      </PageContainer>
    </AppLayout>
  );
}
