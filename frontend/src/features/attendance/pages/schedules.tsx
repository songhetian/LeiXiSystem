'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Space, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { SearchFieldConfig } from '@/components/SearchForm';
import { attendanceApi, Schedule, Shift, ScheduleCreateDto } from '@/services/attendance';

export default function SchedulesPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Schedule[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const fetchList = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await attendanceApi.getScheduleList({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({
          current: res.data.page,
          pageSize: res.data.pageSize,
          total: res.data.total,
        });
      } else {
        Message.error(res.message || '获取排班列表失败');
      }
    } catch (e) {
      Message.error('获取排班列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await attendanceApi.getShiftList();
      if (res.code === 0 && res.data) {
        setShifts(res.data.list);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchList(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchList(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchList(1, pagination.pageSize, {});
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchList(page, pageSize, searchParams);
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
      onOk: async () => {
        try {
          const res = await attendanceApi.deleteSchedule(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchList(pagination.current, pagination.pageSize, searchParams);
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
        workDate: values.workDate,
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
        fetchList(pagination.current, pagination.pageSize, searchParams);
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
    { key: 'startDate', label: '开始日期', type: 'input', placeholder: 'YYYY-MM-DD' },
    { key: 'endDate', label: '结束日期', type: 'input', placeholder: 'YYYY-MM-DD' },
  ];

  const formFields: FormFieldConfig[] = [
    { key: 'employeeId', label: '员工ID', type: 'input', required: true, placeholder: '请输入员工ID' },
    {
      key: 'shiftId',
      label: '班次',
      type: 'select',
      required: true,
      options: shifts.map((s) => ({ value: String(s.id), label: s.name })),
    },
    { key: 'workDate', label: '工作日期', type: 'input', required: true, placeholder: 'YYYY-MM-DD' },
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
    { key: 'add', label: '新增排班', type: 'primary', onClick: handleAdd },
  ];

  return (
    <AppLayout title="排班管理" activeMenu="attendance">
      <PageContainer title="排班管理">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          toolbar={toolbar}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
        <ModalForm
          visible={modalVisible}
          title={editingSchedule ? '编辑排班' : '新增排班'}
          fields={formFields}
          initialValues={editingSchedule ? {
            employeeId: String(editingSchedule.employeeId),
            shiftId: String(editingSchedule.shiftId),
            workDate: editingSchedule.workDate,
          } : {}}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          confirmLoading={modalLoading}
          width={500}
        />
      </PageContainer>
    </AppLayout>
  );
}
