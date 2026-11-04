'use client';

import { useState } from 'react';
import { Message, Modal, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { PermissionGate } from '@/components/PermissionGate';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, PunchDevice, PunchDeviceCreateDto, PunchDeviceUpdateDto } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { ENABLED_STATUS_MAP } from '@/features/attendance/lib/status-maps';

interface DeviceListEnvelope {
  code: number;
  message?: string;
  data?: { list: PunchDevice[]; total: number };
}

export default function PunchDevicesPage() {
  const { can } = usePermission();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PunchDevice | null>(null);

  // SWR 缓存：设备列表共享缓存；增删改后 revalidate 刷新
  const { data: res, loading, error, revalidate } = useCachedData<DeviceListEnvelope>(
    'attendance:punch-devices',
    () => attendanceApi.getPunchDeviceList(),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];

  const handleAdd = () => {
    setEditingDevice(null);
    setModalVisible(true);
  };

  const handleEdit = (record: PunchDevice) => {
    setEditingDevice(record);
    setModalVisible(true);
  };

  const handleDelete = (record: PunchDevice) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除设备「${record.name}」吗？`,
      onOk: async () => {
        try {
          const res = await attendanceApi.deletePunchDevice(record.id);
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
      const dto: PunchDeviceCreateDto | PunchDeviceUpdateDto = {
        name: values.name,
        deviceNo: values.deviceNo,
        ipAddress: values.ipAddress,
        port: values.port ? Number(values.port) : 80,
        apiKey: values.apiKey,
        enabled: values.enabled === 'true',
      };
      let res;
      if (editingDevice) {
        res = await attendanceApi.updatePunchDevice(editingDevice.id, dto);
      } else {
        res = await attendanceApi.createPunchDevice(dto as PunchDeviceCreateDto);
      }
      if (res.code === 0) {
        Message.success(editingDevice ? '修改成功' : '创建成功');
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
    setEditingDevice(null);
  };

  const formFields: FormFieldConfig[] = [
    { key: 'name', label: '设备名称', type: 'input', required: true, placeholder: '请输入设备名称' },
    { key: 'deviceNo', label: '设备编号', type: 'input', required: true, placeholder: '请输入设备编号' },
    { key: 'ipAddress', label: 'IP地址', type: 'input', required: true, placeholder: '如 192.168.1.100' },
    { key: 'port', label: '端口', type: 'input', placeholder: '默认 80' },
    { key: 'apiKey', label: 'API密钥', type: 'input', placeholder: '请输入API密钥' },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'select',
      options: [
        { value: 'true', label: '启用' },
        { value: 'false', label: '禁用' },
      ],
      required: true,
    },
  ];

  const columns: ProTableColumn[] = [
    { title: '设备名称', dataIndex: 'name', width: 160 },
    { title: '设备编号', dataIndex: 'deviceNo', width: 140 },
    { title: 'IP地址', dataIndex: 'ipAddress', width: 140 },
    { title: '端口', dataIndex: 'port', width: 80 },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (value: boolean) => (
        <StatusTag status={value ? 'enabled' : 'disabled'} statusMap={ENABLED_STATUS_MAP} />
      ),
    },
    { title: '最后同步', dataIndex: 'lastSyncTime', width: 180 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_: any, record: PunchDevice) => (
        <Space>
          {/* 设备编辑/删除是考勤管理写操作：无 attendance:manage 不渲染 */}
          <PermissionGate code="attendance:manage">
            <Button size="small" type="text" onClick={() => handleEdit(record)}>编辑</Button>
            <Button size="small" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  // 新增设备是考勤管理写操作：无权限时工具栏不渲染
  const toolbar: ProTableToolbarAction[] = can('attendance:manage')
    ? [{ key: 'add', label: '新增设备', type: 'primary', onClick: handleAdd }]
    : [];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        toolbar={toolbar}
        pagination={false}
      />
      <ModalForm
        visible={modalVisible}
        title={editingDevice ? '编辑设备' : '新增设备'}
        fields={formFields}
        initialValues={editingDevice ? {
          name: editingDevice.name,
          deviceNo: editingDevice.deviceNo,
          ipAddress: editingDevice.ipAddress,
          port: String(editingDevice.port),
          apiKey: editingDevice.apiKey,
          enabled: String(editingDevice.enabled),
        } : { enabled: 'true', port: '80' }}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        width={500}
      />
    </PageContainer>
  );
}
