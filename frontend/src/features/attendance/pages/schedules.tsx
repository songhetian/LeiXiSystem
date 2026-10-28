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
  // 后端排班的增/改/删都要求 attendance:manage，前端同步做权限门
  const canManage = can('attendance:manage');
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
  // 失败要明示：空下拉会让用户以为「系统里没有班次」，从而以为排班功能坏了
  const {
    data: shiftsRes,
    loading: shiftsLoading,
    error: shiftsError,
    revalidate: revalidateShifts,
  } = useCachedData<{ code: number; data?: { list: Shift[] } }>(
    'attendance:shifts',
    async () => {
      const res = await attendanceApi.getShiftList();
      if (res.code !== 0) throw new Error(res.message || '班次列表读取失败');
      return res;
    },
    { staleTime: 60_000 },
  );
  const shifts = shiftsRes?.code === 0 && shiftsRes.data ? shiftsRes.data.list : [];
  // 加载中不算「没有班次」；加载完仍为空说明确实还没配置
  const shiftsEmpty = !shiftsLoading && !shiftsError && shifts.length === 0;
  // 班次缺失时不允许新建/编辑排班，否则只能提交一个没有班次的排班
  const shiftsBlocked = !!shiftsError || shiftsEmpty;

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
        } catch {
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
    } catch {
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
    // 选人而不是让人背员工 ID：后端只要 employeeId，前端用员工选择器按姓名/工号搜
    { key: 'employeeId', label: '员工', type: 'employee', required: true, placeholder: '搜索员工姓名或工号' },
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
          <Button
            size="small"
            type="text"
            disabled={!canManage || shiftsBlocked}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            type="text"
            status="danger"
            disabled={!canManage}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    {
      key: 'add',
      label: '新增排班',
      type: 'primary',
      onClick: handleAdd,
      // 班次还没就绪时新增只会提交一个空班次的排班，直接禁用
      disabled: !canManage || shiftsBlocked,
    },
  ];

  return (
    <PageContainer >
      {shiftsError && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-3 rounded-md border border-danger bg-danger-light px-3 py-2 text-sm text-danger"
        >
          <span>班次列表加载失败，暂时无法新增或编辑排班：{shiftsError}</span>
          <Button size="mini" onClick={() => revalidateShifts()}>
            重试
          </Button>
        </div>
      )}
      {shiftsEmpty && (
        <div className="mb-3 rounded-md border border-warning bg-warning-light px-3 py-2 text-sm text-warning-text">
          尚未配置班次，请先在「考勤设置 → 班次管理」创建班次后再排班。
        </div>
      )}
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
