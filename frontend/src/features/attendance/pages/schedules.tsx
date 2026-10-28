'use client';

import { useState } from 'react';
import { Message, Modal, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { SearchFieldConfig } from '@/components/SearchForm';
import { attendanceApi, Schedule, Shift, ScheduleCreateDto } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { toDateOnly } from '@/lib/leave-days';

interface ScheduleListEnvelope {
  code: number;
  message?: string;
  data?: { list: Schedule[]; page: number; pageSize: number; total: number };
}

export default function SchedulesPage() {
  const { can } = usePermission();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // SWR 缓存：参数编入 cacheKey，搜索/翻页即重新订阅；同参数复用缓存
  const cacheKey = `attendance:schedules:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<ScheduleListEnvelope>(
    cacheKey,
    async () => {
      const envelope = await attendanceApi.getScheduleList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchParams,
      });
      // 业务码非 0 视为失败，避免失败被渲染成「暂无排班」
      if (envelope.code !== 0) throw new Error(envelope.message || '排班列表读取失败');
      return envelope;
    },
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  // 班次下拉参考数据：共享缓存，跨组件去重
  const { data: shiftsRes } = useCachedData<{ code: number; data?: { list: Shift[] } }>(
    'attendance:shifts',
    () => attendanceApi.getShiftList(),
    { staleTime: 60_000 },
  );
  const shifts = shiftsRes?.code === 0 && shiftsRes.data ? shiftsRes.data.list : [];

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const handleAdd = () => {
    setEditingSchedule(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Schedule) => {
    setEditingSchedule(record);
    setModalVisible(true);
  };

  const handleDelete = (record: Schedule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除该排班吗？`,
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        try {
          const res = await attendanceApi.deleteSchedule(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            revalidate();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e) {
          Message.error('删除失败');
        }
      },
    });
  };

  const handleModalOk = async (values: Record<string, any>) => {
    setModalLoading(true);
    try {
      const dto: ScheduleCreateDto = {
        employeeId: Number(values.employeeId),
        shiftId: Number(values.shiftId),
        // 后端 workDate 仅接受 YYYY-MM-DD，编辑回填的可能带 datetime 串，需归一化
        workDate: toDateOnly(String(values.workDate ?? '')),
      };
      let res;
      if (editingSchedule) {
        res = await attendanceApi.updateSchedule(editingSchedule.id, dto);
      } else {
        res = await attendanceApi.createSchedule(dto);
      }
      if (res.code === 0) {
        Message.success(editingSchedule ? '修改成功' : '创建成功');
        setModalVisible(false);
        revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingSchedule(null);
  };

  const searchFields: SearchFieldConfig[] = [
    { key: 'startDate', label: '开始日期', type: 'date', placeholder: '请选择日期', span: 4 },
    { key: 'endDate', label: '结束日期', type: 'date', placeholder: '请选择日期', span: 4 },
  ];

  const formFields: FormFieldConfig[] = [
    { key: 'employeeId', label: '员工', type: 'input', required: true, placeholder: '请输入员工ID' },
    {
      key: 'shiftId',
      label: '班次',
      type: 'select',
      required: true,
      options: shifts.map((s) => ({ value: String(s.id), label: s.name })),
    },
    { key: 'workDate', label: '工作日期', type: 'date', required: true, placeholder: '请选择日期' },
  ];

  const columns: ProTableColumn[] = [
    { title: '工作日期', dataIndex: 'workDate', width: 140 },
    {
      title: '员工',
      dataIndex: 'employeeName',
      width: 140,
      render: (_: any, record: Schedule) => record.employee?.name || '-',
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 120,
      render: (_: any, record: Schedule) => record.employee?.employeeNo || '-',
    },
    {
      title: '班次',
      dataIndex: 'shiftName',
      width: 140,
      render: (_: any, record: Schedule) => record.shift?.name || '-',
    },
    {
      title: '时间',
      dataIndex: 'time',
      width: 180,
      render: (_: any, record: Schedule) => {
        if (!record.shift) return '-';
        return `${record.shift.startTime} - ${record.shift.endTime}${record.shift.isNextDay ? ' (跨天)' : ''}`;
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_: any, record: Schedule) => (
        <Space>
          <Button size="small" type="text" onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新增排班', type: 'primary', onClick: handleAdd, disabled: !can('attendance:manage') },
  ];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pageResult}
        onPageChange={handlePageChange}
      />
      <ModalForm
        visible={modalVisible}
        title={editingSchedule ? '编辑排班' : '新增排班'}
        fields={formFields}
        initialValues={editingSchedule ? {
          employeeId: Number(editingSchedule.employeeId),
          shiftId: String(editingSchedule.shiftId),
          workDate: editingSchedule.workDate,
        } : {}}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        width={500}
      />
    </PageContainer>
  );
}
