'use client';

import { useState, useEffect } from 'react';
import { Message, Tag, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, OvertimeRecord, OvertimeCreateDto } from '@/services/attendance';
import { employeeApi, Employee } from '@/services/employee';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';
import { exportToExcel } from '@/lib/excel';

export default function VacationOvertimePage() {
  const { can } = usePermission();

  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeError, setOvertimeError] = useState<string | null>(null);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [overtimePagination, setOvertimePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [overtimeModalVisible, setOvertimeModalVisible] = useState(false);
  const [overtimeModalLoading, setOvertimeModalLoading] = useState(false);

  const fetchMyProfile = async () => {
    try {
      const res = await employeeApi.getMe();
      if (res.code === 0 && res.data) {
        setMyEmployee(res.data);
      }
    } catch (e) {}
  };

  const fetchOvertimes = async (page = 1, pageSize = 20) => {
    setOvertimeLoading(true);
    setOvertimeError(null);
    try {
      const res = await attendanceApi.getMyOvertimes();
      if (res.code === 0 && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).list || [];
        const total = (res.data as any).total ?? list.length;
        setOvertimes(list);
        setOvertimePagination({ current: 1, pageSize: 20, total });
      }
    } catch (e: any) {
      setOvertimeError(e?.message || '获取加班记录失败');
      notifyError(e, '获取加班记录失败');
    } finally {
      setOvertimeLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProfile();
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

  const handleAddOvertime = () => {
    setOvertimeModalVisible(true);
  };

  // 导出加班记录到 Excel
  const handleExportOvertime = () => {
    const statusMap: Record<string, string> = {
      pending: '待提交', approving: '审批中', approved: '已通过', rejected: '已拒绝', cancelled: '已取消',
    };
    if (!exportToExcel(
      `加班记录_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '加班记录',
      [
        { title: '加班日期', dataIndex: 'overtimeDate' },
        { title: '开始时间', dataIndex: 'startTime' },
        { title: '结束时间', dataIndex: 'endTime' },
        { title: '时长(小时)', dataIndex: 'hours' },
        { title: '原因', dataIndex: 'reason' },
        { title: '状态', value: (r: OvertimeRecord) => statusMap[r.status] ?? r.status },
      ],
      overtimes as OvertimeRecord[],
    )) {
      Message.info('当前没有可导出的加班记录');
    }
  };

  const handleOvertimeSubmit = async (values: Record<string, any>) => {
    if (!myEmployee) {
      Message.error('未获取到员工信息');
      return;
    }
    setOvertimeModalLoading(true);
    try {
      const [startH, startM] = values.startTime.split(':').map(Number);
      const [endH, endM] = values.endTime.split(':').map(Number);
      let hours = (endH * 60 + endM - startH * 60 - startM) / 60;
      if (hours <= 0) hours += 24;
      const dto: OvertimeCreateDto = {
        employeeId: myEmployee.id,
        overtimeDate: values.overtimeDate,
        startTime: values.startTime,
        endTime: values.endTime,
        hours: Math.round(hours * 10) / 10,
        reason: values.reason,
      };
      const res = await attendanceApi.createOvertime(dto);
      if (res.code === 0) {
        Message.success('申请已提交，请等待审批');
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

  const handleSubmitApproval = async (id: number) => {
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
            <Button size="small" type="text" onClick={() => handleSubmitApproval(record.id)}>提交审批</Button>
          )}
        </Space>
      ),
    },
  ];

  const overtimeFormFields: FormFieldConfig[] = [
    { key: 'overtimeDate', label: '加班日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'startTime', label: '开始时间', type: 'input', required: true, placeholder: '如 18:00' },
    { key: 'endTime', label: '结束时间', type: 'input', required: true, placeholder: '如 21:00' },
    { key: 'reason', label: '加班原因', type: 'textarea', placeholder: '请输入原因' },
  ];

  return (
    <PageContainer title="我的加班">
      <ProTable
        columns={overtimeColumns}
        data={overtimes}
        rowKey="id"
        loading={overtimeLoading}
        error={overtimeError}
        onRetry={() => fetchOvertimes(overtimePagination.current, overtimePagination.pageSize)}
        toolbar={[
          { key: 'add', label: '申请加班', type: 'primary', onClick: handleAddOvertime },
          { key: 'export', label: '导出 Excel', onClick: handleExportOvertime },
        ]}
        pagination={overtimePagination}
        onPageChange={(p, ps) => fetchOvertimes(p, ps)}
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
  );
}
