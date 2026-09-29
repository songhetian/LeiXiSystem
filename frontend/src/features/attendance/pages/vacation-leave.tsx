'use client';

import { useState, useEffect } from 'react';
import { Message, Tag, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, LeaveRecord, LeaveCreateDto } from '@/services/attendance';
import { employeeApi, Employee } from '@/services/employee';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { todayStr } from '@/lib/format';
import { isMonthlyDays } from '@/lib/vacation-type';

/** 请假表单的假期类型下拉项：monthlyDays 为 12 元素数组即月假 */
interface VacationTypeOption {
  id: number;
  name: string;
  monthlyDays: number[] | null;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} 月`,
}));

export default function VacationLeavePage() {
  const { can } = usePermission();

  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leavePagination, setLeavePagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveModalLoading, setLeaveModalLoading] = useState(false);

  const [vacationTypes, setVacationTypes] = useState<VacationTypeOption[]>([]);
  // 表单中当前选中的假期类型：月假类型需额外展示「抵扣月份」
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

  const fetchMyProfile = async () => {
    try {
      const res = await employeeApi.getMe();
      if (res.code === 0 && res.data) {
        setMyEmployee(res.data);
      }
    } catch (e) {
      notifyError(e, '个人信息加载失败');
    }
  };

  // 仅用于申请请假表单的「假期类型」下拉选项
  const fetchVacationTypes = async () => {
    try {
      const res = await attendanceApi.getMyBalances({ year: new Date().getFullYear() });
      if (res.code === 0 && res.data) {
        const types = [...new Set(res.data.map((b) => b.vacationType.id))].map((id) => {
          const b = res.data!.find((x) => x.vacationType.id === id)!;
          return {
            id: b.vacationType.id,
            name: b.vacationType.name,
            monthlyDays: b.vacationType.monthlyDays ?? null,
          };
        });
        setVacationTypes(types);
      }
    } catch (e) {
      // 静默失败会让「假期类型」下拉变空，用户无法提交却不知原因 → 显式提示
      notifyError(e, '假期类型加载失败，请刷新重试');
    }
  };

  const fetchLeaves = async (page = 1, pageSize = 20) => {
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const res = await attendanceApi.getMyLeaves({ page, pageSize });
      if (res.code === 0 && res.data) {
        // 后端接口一致返回 {list,total,page,pageSize}；旧版可能返回裸数组，兜底保留。
        const data = res.data;
        const list = Array.isArray(data) ? data : (data.list ?? []);
        const total = data.total ?? list.length;
        setLeaves(list);
        // 页码/页长以本次请求为准，否则翻页后会被重置回第 1 页
        setLeavePagination({ current: page, pageSize, total });
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
    fetchVacationTypes();
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
    setSelectedTypeId(null);
    setLeaveModalVisible(true);
  };

  const handleCloseLeaveModal = () => {
    setLeaveModalVisible(false);
    setSelectedTypeId(null);
  };

  // 导出请假记录到 Excel
  const handleExportLeave = () => {
    const statusMap: Record<string, string> = {
      pending: '待提交', approving: '审批中', approved: '已通过', rejected: '已拒绝', cancelled: '已取消',
    };
    if (!exportToExcel(
      `请假记录_${todayStr()}.xlsx`,
      '请假记录',
      [
        { title: '假期类型', value: (r: LeaveRecord) => r.vacationType?.name ?? '-' },
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
        ...(values.month ? { month: Number(values.month) } : {}),
        reason: values.reason,
      };
      const res = await attendanceApi.createLeave(dto);
      if (res.code === 0) {
        Message.success('申请已提交，请等待审批');
        handleCloseLeaveModal();
        // 保留当前页，避免提交后列表跳回第 1 页
        fetchLeaves(leavePagination.current, leavePagination.pageSize);
        fetchVacationTypes();
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
        // 保留当前页，避免提交后列表跳回第 1 页
        fetchLeaves(leavePagination.current, leavePagination.pageSize);
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const leaveColumns: ProTableColumn[] = [
    { title: '假期类型', dataIndex: 'vacationTypeName', width: 120, render: (_: any, r: LeaveRecord) => r.vacationType?.name || '-' },
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

  const selectedType = vacationTypes.find((t) => t.id === selectedTypeId);

  const leaveFormFields: FormFieldConfig[] = [
    {
      key: 'vacationTypeId',
      label: '假期类型',
      type: 'select',
      required: true,
      options: vacationTypes.map((t) => ({ value: String(t.id), label: t.name })),
    },
    // 月假不结转，只能抵扣当月，故必须显式选择抵扣月份
    ...(isMonthlyDays(selectedType?.monthlyDays)
      ? ([
          {
            key: 'month',
            label: '抵扣月份',
            type: 'select',
            required: true,
            placeholder: '请选择抵扣月份',
            options: MONTH_OPTIONS,
          },
        ] as FormFieldConfig[])
      : []),
    { key: 'startDate', label: '开始日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'endDate', label: '结束日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'reason', label: '请假原因', type: 'textarea', required: true, placeholder: '请输入原因' },
  ];

  return (
    <PageContainer >
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
        onCancel={handleCloseLeaveModal}
        onValuesChange={(key, value) => {
          if (key === 'vacationTypeId') setSelectedTypeId(value ? Number(value) : null);
        }}
        confirmLoading={leaveModalLoading}
        width={500}
      />
    </PageContainer>
  );
}
