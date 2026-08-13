'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Tag, Space, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, Shift, ShiftCreateDto, ShiftUpdateDto } from '@/services/attendance';

export default function ShiftsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Shift[]>([]);
  const [total, setTotal] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getShiftList();
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setTotal(res.data.total);
      } else {
        Message.error(res.message || '获取班次列表失败');
      }
    } catch (e) {
      Message.error('获取班次列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleAdd = () => {
    setEditingShift(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Shift) => {
    setEditingShift(record);
    setModalVisible(true);
  };

  const handleDelete = (record: Shift) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除班次「${record.name}」吗？`,
      onOk: async () => {
        try {
          const res = await attendanceApi.deleteShift(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchList();
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
      const dto: ShiftCreateDto | ShiftUpdateDto = {
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        isNextDay: values.isNextDay === 'true',
      };
      let res;
      if (editingShift) {
        res = await attendanceApi.updateShift(editingShift.id, dto);
      } else {
        res = await attendanceApi.createShift(dto as ShiftCreateDto);
      }
      if (res.code === 0) {
        Message.success(editingShift ? '修改成功' : '创建成功');
        setModalVisible(false);
        fetchList();
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
    setEditingShift(null);
  };

  const formFields: FormFieldConfig[] = [
    { key: 'name', label: '班次名称', type: 'input', required: true, placeholder: '请输入班次名称' },
    { key: 'startTime', label: '上班时间', type: 'input', required: true, placeholder: '如 08:00' },
    { key: 'endTime', label: '下班时间', type: 'input', required: true, placeholder: '如 16:00' },
    {
      key: 'isNextDay',
      label: '是否跨天',
      type: 'select',
      options: [
        { value: 'false', label: '否' },
        { value: 'true', label: '是' },
      ],
      required: true,
    },
  ];

  const columns: ProTableColumn[] = [
    { title: '班次名称', dataIndex: 'name', width: 160 },
    { title: '上班时间', dataIndex: 'startTime', width: 120 },
    { title: '下班时间', dataIndex: 'endTime', width: 120 },
    {
      title: '跨天',
      dataIndex: 'isNextDay',
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? 'orange' : 'green'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_: any, record: Shift) => (
        <Space>
          <Button size="small" type="text" onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新增班次', type: 'primary', onClick: handleAdd },
  ];

  return (
    <AppLayout title="班次管理" activeMenu="attendance">
      <PageContainer title="班次管理">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          toolbar={toolbar}
          pagination={false}
        />
        <ModalForm
          visible={modalVisible}
          title={editingShift ? '编辑班次' : '新增班次'}
          fields={formFields}
          initialValues={editingShift ? {
            name: editingShift.name,
            startTime: editingShift.startTime,
            endTime: editingShift.endTime,
            isNextDay: String(editingShift.isNextDay),
          } : { isNextDay: 'false' }}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          confirmLoading={modalLoading}
          width={500}
        />
      </PageContainer>
    </AppLayout>
  );
}
