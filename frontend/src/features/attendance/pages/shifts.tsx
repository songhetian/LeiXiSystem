'use client';

import { useState } from 'react';
import { Message, Modal, Button, Spin } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import SearchForm, { SearchFieldConfig } from '@/components/SearchForm';
import { attendanceApi, Shift, ShiftCreateDto, ShiftUpdateDto } from '@/services/attendance';
import { useDepartments } from '@/hooks/use-departments';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import ShiftForm, { ShiftFormValues } from './ShiftForm';
import { exportToExcel } from '@/lib/excel';
import { todayStr } from '@/lib/format';

const EMPTY_SHIFTS: Shift[] = [];

/** 鲜艳色系推荐（与旧项目保持一致，供随机取色） */
const VIBRANT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12', '#E67E22',
  '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#FF85A2', '#FFB6C1', '#87CEEB', '#98FB98',
  '#DDA0DD', '#B0E0E6', '#FFDAB9', '#E0BBE4', '#FFDFD3', '#FFD700', '#FF1493',
];

interface Filters {
  departmentId: string;
  status: string;
  keyword: string;
}

export default function ShiftsPage() {
  const { can } = usePermission();
  const canManage = can('attendance:manage');
  const { departments } = useDepartments();
  const [filters, setFilters] = useState<Filters>({ departmentId: '', status: '', keyword: '' });

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // 班次列表：筛选条件编入缓存键，变化即重新获取
  const cacheKey = `attendance:shifts:${filters.departmentId}:${filters.status}:${filters.keyword}`;
  const { data: resData, loading, error, revalidate } = useCachedData<Shift[]>(
    cacheKey,
    async () => {
      const params: any = {};
      if (filters.departmentId === 'global') params.departmentId = '';
      else if (filters.departmentId) params.departmentId = Number(filters.departmentId);
      if (filters.status !== '') params.isActive = filters.status === 'active';
      if (filters.keyword) params.keyword = filters.keyword;
      const res: any = await attendanceApi.getShiftList();
      let list = (res.data?.list ?? res?.list ?? []) as Shift[];
      // 服务端若未支持筛选，则本地兜底过滤
      if (params.departmentId !== undefined) {
        list = list.filter((s) => (s.departmentId ?? null) === (params.departmentId === '' ? null : params.departmentId));
      }
      if (params.isActive !== undefined) {
        const wantActive = params.isActive;
        list = list.filter((s) => !!s.isActive === wantActive);
      }
      if (params.keyword) {
        const kw = String(params.keyword).toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(kw));
      }
      return list;
    },
    { staleTime: 30_000 },
  );
  const data = resData ?? EMPTY_SHIFTS;

  const handleSearch = (values: Record<string, any>) => {
    setFilters({
      departmentId: String(values.departmentId ?? ''),
      status: String(values.status ?? ''),
      keyword: String(values.keyword ?? ''),
    });
  };

  const handleReset = () => {
    setFilters({ departmentId: '', status: '', keyword: '' });
  };

  // 筛选字段（部门选项经 useDepartments 异步加载，内联构建以随数据刷新）
  const searchFields: SearchFieldConfig[] = [
    {
      key: 'departmentId',
      label: '所属部门',
      type: 'select',
      placeholder: '全部部门',
      options: [
        { value: 'global', label: '全公司通用' },
        ...departments.map((d) => ({ value: String(d.id), label: d.name })),
      ],
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '全部状态',
      options: [
        { value: 'active', label: '启用中' },
        { value: 'disabled', label: '已禁用' },
      ],
    },
    { key: 'keyword', label: '搜索', type: 'input', placeholder: '班次名称' },
  ];

  const handleAdd = () => {
    if (!canManage) return;
    setEditingShift(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Shift) => {
    if (!canManage) return;
    setEditingShift(record);
    setModalVisible(true);
  };

  const handleToggleActive = async (record: Shift) => {
    if (!canManage) return;
    try {
      const res = await attendanceApi.updateShift(record.id, { isActive: !record.isActive });
      if (res.code === 0) {
        Message.success(record.isActive ? '已禁用该班次' : '已启用该班次');
        revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    }
  };

  const handleDelete = (record: Shift) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除班次「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await attendanceApi.deleteShift(record.id);
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

  const handleModalOk = async (values: ShiftFormValues) => {
    setModalLoading(true);
    try {
      const dto: ShiftCreateDto | ShiftUpdateDto = {
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        isNextDay: values.isNextDay,
        restDuration: Number(values.restDuration) || 0,
        lateThreshold: values.useGlobalThreshold ? 0 : Number(values.lateThreshold) || 0,
        earlyThreshold: values.useGlobalThreshold ? 0 : Number(values.earlyThreshold) || 0,
        useGlobalThreshold: values.useGlobalThreshold,
        color: values.color,
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        description: values.description || '',
        isActive: values.isActive,
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
    setEditingShift(null);
  };

  // 导出当前（筛选后的）班次数据
  const handleExport = () => {
    if (!exportToExcel(
      `班次管理_${todayStr()}.xlsx`,
      '班次',
      [
        { title: '班次名称', dataIndex: 'name' },
        { title: '所属部门', value: (s: Shift) => s.department?.name ?? '全公司' },
        { title: '上班时间', dataIndex: 'startTime' },
        { title: '下班时间', dataIndex: 'endTime' },
        { title: '次日下班', value: (s: Shift) => (s.isNextDay ? '是' : '否') },
        { title: '休息时长(分钟)', dataIndex: 'restDuration' },
        { title: '工作时长(小时)', value: (s: Shift) => calcWorkHours(s) },
        { title: '迟到阈值(分钟)', value: (s: Shift) => (s.useGlobalThreshold !== false ? '(全局默认)' : `${s.lateThreshold ?? 0}`) },
        { title: '早退阈值(分钟)', value: (s: Shift) => (s.useGlobalThreshold !== false ? '(全局默认)' : `${s.earlyThreshold ?? 0}`) },
        { title: '颜色', dataIndex: 'color' },
        { title: '状态', value: (s: Shift) => (s.isActive === false ? '已禁用' : '启用中') },
        { title: '描述', dataIndex: 'description' },
      ],
      data,
    )) {
      Message.info('当前没有可导出的班次数据');
    }
  };

  const filteredCount = data.length;

  return (
    <PageContainer >
      {/* 筛选栏：Pro 标准 SearchForm（部门/状态/搜索），提交与重置驱动列表刷新 */}
      <SearchForm
        fields={searchFields}
        initialValues={filters}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {filteredCount} 个班次</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" icon={null} onClick={handleAdd} disabled={!canManage}>
            + 新建班次
          </Button>
        </div>
      </div>

      {/* 班次卡片 */}
      <Spin loading={loading} style={{ display: 'block' }}>
        {error ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
            <p className="text-text-3 mb-3">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md text-text-3">
            {loading ? '加载中...' : '暂无班次，点击右上角新建班次'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((shift) => {
              const color = shift.color || '#3B82F6';
              const isActive = shift.isActive !== false;
              return (
                <div
                  key={shift.id}
                  className="border-2 rounded-lg p-5 bg-surface transition-all hover:shadow-md"
                  style={{ borderColor: color, backgroundColor: `${color}10` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-text-1">{shift.name}</h3>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-normal"
                          style={{
                            background: isActive ? 'rgba(22,163,74,0.12)' : 'rgba(107,119,140,0.12)',
                            color: isActive ? '#16a34a' : '#6b778c',
                          }}
                        >
                          {isActive ? '启用中' : '已禁用'}
                        </span>
                        {shift.department ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs"
                            style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}
                          >
                            {shift.department.name}
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs"
                            style={{ background: 'rgba(36,85,217,0.12)', color: '#2455D9' }}
                          >
                            全公司
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 w-4 h-4 rounded"
                      style={{ background: color, border: '1px solid rgba(0,0,0,0.08)' }}
                      title={color}
                    />
                  </div>

                  <div className="space-y-1.5 text-sm text-text-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span>⏰</span>
                      <span>{shift.startTime} - {shift.endTime}{shift.isNextDay ? '（次日）' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span>工作时长：{calcWorkHours(shift)} 小时</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>☕</span>
                      <span>休息时长：{(shift.restDuration ?? 0) || '--'} 分钟</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>
                        {shift.useGlobalThreshold !== false ? (
                          <span>迟到/早退阈值：(全局默认)</span>
                        ) : (
                          <span>迟到：{shift.lateThreshold ?? 0}分钟 / 早退：{shift.earlyThreshold ?? 0}分钟</span>
                        )}
                      </span>
                    </div>
                    {shift.description && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t border-black/5">
                        <span>📝</span>
                        <span className="text-xs text-text-3">{shift.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="primary"
                      size="small"
                      style={{ flex: 1 }}
                      disabled={!canManage}
                      onClick={() => handleEdit(shift)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      style={{ flex: 1 }}
                      disabled={!canManage}
                      onClick={() => handleToggleActive(shift)}
                    >
                      {isActive ? '禁用' : '启用'}
                    </Button>
                    <Button
                      size="small"
                      status="danger"
                      disabled={!canManage}
                      onClick={() => handleDelete(shift)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      <ShiftForm
        visible={modalVisible}
        title={editingShift ? '编辑班次' : '新建班次'}
        departments={departments}
        initialValues={editingShift ? {
          name: editingShift.name,
          departmentId: editingShift.departmentId ? String(editingShift.departmentId) : 'global',
          startTime: editingShift.startTime,
          endTime: editingShift.endTime,
          isNextDay: editingShift.isNextDay,
          restDuration: editingShift.restDuration ?? 60,
          lateThreshold: editingShift.lateThreshold ?? 30,
          earlyThreshold: editingShift.earlyThreshold ?? 30,
          useGlobalThreshold: editingShift.useGlobalThreshold !== false,
          description: editingShift.description || '',
          isActive: editingShift.isActive !== false,
          color: editingShift.color || '#3B82F6',
        } : {
          name: '',
          departmentId: 'global',
          startTime: '',
          endTime: '',
          isNextDay: false,
          restDuration: 60,
          lateThreshold: 30,
          earlyThreshold: 30,
          useGlobalThreshold: true,
          description: '',
          isActive: true,
          color: VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)],
        }}
        confirmLoading={modalLoading}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
      />
    </PageContainer>
  );
}

function calcWorkHours(shift: Shift): string {
  if (!shift.startTime || !shift.endTime) return '0.0';
  const [sH, sM] = shift.startTime.split(':').map(Number);
  const [eH, eM] = shift.endTime.split(':').map(Number);
  let total = eH * 60 + eM - (sH * 60 + sM);
  if (total < 0) total += 24 * 60;
  const rest = shift.restDuration ?? 0;
  return Math.max(0, (total - rest) / 60).toFixed(1);
}