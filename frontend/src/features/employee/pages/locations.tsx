'use client';

import { useState, useEffect, useCallback } from 'react';
import { Message, Modal, Button, Select, Input, Table, Tag, Space, Spin } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import type { ProTableColumn } from '@/components/ProTable';
import { attendanceLocationApi, AttendanceLocation, AttendanceLocationCreateDto, AttendanceLocationUpdateDto } from '@/services/employee';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

/** 工作类型中文映射 */
const WORK_TYPE_MAP: Record<string, { label: string; color: string }> = {
  office: { label: '办公', color: 'arcoblue' },
  home: { label: '居家', color: 'purple' },
  field: { label: '外勤', color: 'orange' },
};
const WORK_TYPE_OPTIONS = [
  { value: 'office', label: '办公' },
  { value: 'home', label: '居家' },
  { value: 'field', label: '外勤' },
];

export default function LocationsPage() {
  const { can } = usePermission();
  const canManage = can('attendance:location:manage');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AttendanceLocation[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AttendanceLocation | null>(null);

  // 表单字段
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [workType, setWorkType] = useState('office');
  const [enabled, setEnabled] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceLocationApi.list();
      if (res.code === 0 && res.data) {
        setData(res.data.list);
      } else {
        setError(res.message || '获取打卡定位列表失败');
        Message.error(res.message || '获取打卡定位列表失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取打卡定位列表失败');
      notifyError(e, '获取打卡定位列表失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = () => {
    if (!canManage) return;
    setEditingLocation(null);
    setName('');
    setAddress('');
    setLatitude('');
    setLongitude('');
    setRadius('100');
    setWorkType('office');
    setEnabled(true);
    setModalVisible(true);
  };

  const handleEdit = (record: AttendanceLocation) => {
    if (!canManage) return;
    setEditingLocation(record);
    setName(record.name);
    setAddress(record.address || '');
    setLatitude(String(record.latitude));
    setLongitude(String(record.longitude));
    setRadius(String(record.radius ?? 100));
    setWorkType(record.workType || 'office');
    setEnabled(record.enabled);
    setModalVisible(true);
  };

  const handleToggleEnabled = async (record: AttendanceLocation) => {
    if (!canManage) return;
    try {
      const res = await attendanceLocationApi.update(record.id, { enabled: !record.enabled });
      if (res.code === 0) {
        Message.success(record.enabled ? '已停用该定位' : '已启用该定位');
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      notifyError(e, '操作失败');
    }
  };

  const handleDelete = (record: AttendanceLocation) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除打卡定位「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await attendanceLocationApi.remove(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchList();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e: any) {
          notifyError(e, '删除失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    if (!name.trim()) {
      Message.warning('请填写定位名称');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (latitude === '' || Number.isNaN(lat)) {
      Message.warning('请填写有效纬度');
      return;
    }
    if (longitude === '' || Number.isNaN(lng)) {
      Message.warning('请填写有效经度');
      return;
    }
    setModalLoading(true);
    try {
      const dto: AttendanceLocationCreateDto | AttendanceLocationUpdateDto = {
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
        radius: radius === '' ? undefined : Math.max(0, Math.round(Number(radius) || 0)),
        workType,
        enabled,
      };
      let res;
      if (editingLocation) {
        res = await attendanceLocationApi.update(editingLocation.id, dto);
      } else {
        res = await attendanceLocationApi.create(dto as AttendanceLocationCreateDto);
      }
      if (res.code === 0) {
        Message.success(editingLocation ? '修改成功' : '创建成功');
        setModalVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      notifyError(e, '操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExport = () => {
    if (!exportToExcel(
      `打卡定位_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '打卡定位',
      [
        { title: '名称', dataIndex: 'name' },
        { title: '地址', value: (l: AttendanceLocation) => l.address || '' },
        { title: '纬度', value: (l: AttendanceLocation) => String(l.latitude) },
        { title: '经度', value: (l: AttendanceLocation) => String(l.longitude) },
        { title: '半径(米)', value: (l: AttendanceLocation) => l.radius },
        { title: '工作类型', value: (l: AttendanceLocation) => WORK_TYPE_MAP[l.workType]?.label ?? l.workType },
        { title: '状态', value: (l: AttendanceLocation) => (l.enabled ? '启用' : '停用') },
      ],
      data,
    )) {
      Message.info('当前没有可导出的打卡定位数据');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '地址', dataIndex: 'address', width: 220, ellipsis: true, render: (v: string) => v || '--' },
    { title: '纬度', dataIndex: 'latitude', width: 110, render: (v: number | string) => String(v) },
    { title: '经度', dataIndex: 'longitude', width: 110, render: (v: number | string) => String(v) },
    { title: '半径(米)', dataIndex: 'radius', width: 100 },
    {
      title: '工作类型',
      dataIndex: 'workType',
      width: 100,
      render: (v: string) => {
        const map = WORK_TYPE_MAP[v];
        return map ? <Tag color={map.color}>{map.label}</Tag> : v;
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'gray'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 200,
      render: (_: any, record: AttendanceLocation) => (
        <Space size={4}>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleToggleEnabled(record)}>
            {record.enabled ? '停用' : '启用'}
          </Button>
          <Button size="small" type="text" status="danger" disabled={!canManage} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="打卡定位" breadcrumbs={['首页', '考勤管理', '打卡定位']}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {data.length} 个打卡定位</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" disabled={!canManage} onClick={handleAdd}>+ 新建定位</Button>
        </div>
      </div>

      <div className="bg-surface border border-border-1 rounded-md overflow-hidden">
        <Spin loading={loading} style={{ display: 'block' }}>
          {error ? (
            <div className="text-center py-16">
              <p className="text-text-3 mb-3">{error}</p>
              <Button onClick={() => fetchList()}>重试</Button>
            </div>
          ) : (
            <Table
              columns={columns}
              data={data}
              rowKey="id"
              pagination={false}
              stripe
              style={{ borderRadius: 0 }}
              noDataElement={<span className="p-8 inline-block text-text-3">暂无打卡定位，点击右上角新建</span>}
            />
          )}
        </Spin>
      </div>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingLocation ? '编辑定位' : '新建定位'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={modalLoading}
        okText="确定"
        cancelText="取消"
        style={{ width: 520 }}
        maskClosable={false}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">名称</label>
            <Input value={name} onChange={(v) => setName(v)} placeholder="如：总部大楼 / 居家办公 / 客户现场" maxLength={100} />
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">地址</label>
            <Input value={address} onChange={(v) => setAddress(v)} placeholder="请输入详细地址" maxLength={255} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-2 mb-1.5">纬度</label>
              <Input value={latitude} onChange={(v) => setLatitude(v)} placeholder="如 23.123456" />
            </div>
            <div>
              <label className="block text-sm text-text-2 mb-1.5">经度</label>
              <Input value={longitude} onChange={(v) => setLongitude(v)} placeholder="如 113.123456" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-2 mb-1.5">半径(米)</label>
              <Input
                value={radius}
                onChange={(v) => setRadius(v.replace(/[^\d]/g, ''))}
                placeholder="默认 100"
                type="number"
              />
            </div>
            <div>
              <label className="block text-sm text-text-2 mb-1.5">工作类型</label>
              <Select value={workType} onChange={(v) => setWorkType(String(v))} style={{ width: '100%' }} options={WORK_TYPE_OPTIONS} />
            </div>
            <div>
              <label className="block text-sm text-text-2 mb-1.5">状态</label>
              <Select
                value={enabled ? 'true' : 'false'}
                onChange={(v) => setEnabled(String(v) === 'true')}
                style={{ width: '100%' }}
                options={[
                  { value: 'true', label: '启用' },
                  { value: 'false', label: '停用' },
                ]}
              />
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}