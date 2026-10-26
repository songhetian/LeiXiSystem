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
import { getApiErrorMessage } from '@/lib/api-error';
import { exportToExcel } from '@/lib/excel';
import { todayStr, formatDate } from '@/lib/format';

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
        const data = res.data;
        const list = Array.isArray(data) ? data : (data.list ?? []);
        const total = data.total ?? list.length;
        setOvertimes(list);
        // 页码/页长以本次请求为准，否则翻页后会被重置回第 1 页
        setOvertimePagination({ current: page, pageSize, total });
      }
    } catch (e) {
      setOvertimeError(getApiErrorMessage(e, '获取加班记录失败'));
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
      `加班记录_${todayStr()}.xlsx`,
      '加班记录',
      [
        // 后端返回的是 Date 序列化后的 ISO 串，必须按北京时间格式化，避免 ISO 原始串泄漏到表格
        { title: '加班日期', value: (r: OvertimeRecord) => formatDate(r.overtimeDate, 'YYYY-MM-DD') },
        { title: '开始时间', value: (r: OvertimeRecord) => formatDate(r.startTime, 'YYYY-MM-DD HH:mm') },
        { title: '结束时间', value: (r: OvertimeRecord) => formatDate(r.endTime, 'YYYY-MM-DD HH:mm') },
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
      const [start, end] = values.timeRange as [string, string];
      // 时长 = 结束 - 开始（支持跨天），精确到 0.1 小时
      const deltaMs = new Date(end).getTime() - new Date(start).getTime();
      const hours = Math.round((deltaMs / 3600000) * 10) / 10;
      const dto: OvertimeCreateDto = {
        employeeId: myEmployee.id,
        overtimeDate: start.slice(0, 10),
        startTime: start,
        endTime: end,
        hours,
        reason: values.reason,
      };
      const res = await attendanceApi.createOvertime(dto);
      if (res.code === 0) {
        Message.success('申请已提交，请等待审批');
        setOvertimeModalVisible(false);
        // 保留当前页，避免提交后列表跳回第 1 页
        fetchOvertimes(overtimePagination.current, overtimePagination.pageSize);
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
        // 保留当前页，避免提交后列表跳回第 1 页
        fetchOvertimes(overtimePagination.current, overtimePagination.pageSize);
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const overtimeColumns: ProTableColumn[] = [
    { title: '加班日期', dataIndex: 'overtimeDate', width: 120, render: (value: string) => formatDate(value, 'YYYY-MM-DD') },
    { title: '开始时间', dataIndex: 'startTime', width: 140, render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm') },
    { title: '结束时间', dataIndex: 'endTime', width: 140, render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm') },
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
    { key: 'timeRange', label: '加班时间', type: 'range', required: true, placeholder: '开始时间,结束时间' },
    { key: 'reason', label: '加班原因', type: 'textarea', placeholder: '请输入原因' },
  ];

  return (
    <PageContainer >
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
