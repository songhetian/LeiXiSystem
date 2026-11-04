'use client';

import { useState } from 'react';
import { Message, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { SearchFieldConfig } from '@/components/SearchForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { punchMakeupApi, PunchMakeupRecord, PunchMakeupType } from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';
import { fetchAllPages } from '@/lib/fetch-all';
import { todayStr, formatDateTime } from '@/lib/format';
import { useCachedData } from '@/hooks/use-cached-data';
import { LEAVE_STATUS_MAP as STATUS_MAP } from '@/features/attendance/lib/status-maps';

// 值域必须与后端 punch-makeup-type.ts 一致（C3：上班卡=当日首次打卡，下班卡=当日最后一次打卡）
const PUNCH_TYPE_OPTIONS: { label: string; value: PunchMakeupType }[] = [
  { label: '上班卡', value: 'check_in' },
  { label: '下班卡', value: 'check_out' },
];

// color 使用 StatusTag 语义色（Arco Design Pro 标准）
export default function PunchMakeupPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<PunchMakeupRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // SWR 缓存：参数编入 cacheKey，搜索/翻页即重新订阅；同参数复用缓存
  const cacheKey = `attendance:punch-makeup:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<{
    code: number;
    message?: string;
    data?: { list: PunchMakeupRecord[]; page: number; pageSize: number; total: number };
  }>(
    cacheKey,
    () => punchMakeupApi.list({ page: pagination.current, pageSize: pagination.pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

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

  // 导出补卡记录到 Excel
  const handleExport = async () => {
    try {
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<PunchMakeupRecord>(async (page, pageSize) => {
        const res = await punchMakeupApi.list({ page, pageSize, ...searchParams });
        return { list: (res.data?.list ?? []) as PunchMakeupRecord[], total: res.data?.total ?? 0 };
      });
      const typeLabel = (v: string) => PUNCH_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
      if (!exportToExcel(
        `补卡申请_${todayStr()}.xlsx`,
        '补卡申请',
        [
          { title: '补卡日期', dataIndex: 'punchDate' },
          { title: '打卡类型', value: (r: PunchMakeupRecord) => typeLabel(r.punchType) },
          { title: '应打卡时间', dataIndex: 'originalTime' },
          { title: '实际打卡时间', dataIndex: 'makeupTime' },
          { title: '补卡原因', dataIndex: 'reason' },
          { title: '状态', value: (r: PunchMakeupRecord) => STATUS_MAP[r.status]?.label ?? r.status },
          { title: '创建时间', value: (r: PunchMakeupRecord) => formatDateTime(r.createdAt) },
        ],
        list,
      )) {
        Message.info('当前没有可导出的补卡记录');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (record: PunchMakeupRecord) => {
    setEditing(record);
    setModalVisible(true);
  };

  const handleModalOk = async (values: Record<string, any>) => {
    setModalLoading(true);
    try {
      if (editing) {
        const res = await punchMakeupApi.update(editing.id, values);
        if (res.code === 0) {
          Message.success('修改成功');
          setModalVisible(false);
          revalidate();
        } else {
          Message.error(res.message || '修改失败');
        }
      } else {
        const res = await punchMakeupApi.create({
          punchDate: values.punchDate,
          punchType: values.punchType,
          originalTime: values.originalTime,
          makeupTime: values.makeupTime,
          reason: values.reason,
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          revalidate();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await punchMakeupApi.remove(id);
      if (res.code === 0) {
        Message.success('删除成功');
        revalidate();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  const handleSubmit = async (id: number) => {
    try {
      const res = await punchMakeupApi.submit(id);
      if (res.code === 0) {
        Message.success('提交成功');
        revalidate();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const searchFields: SearchFieldConfig[] = [
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '请选择状态',
      options: [
        { label: '待提交', value: 'pending' },
        { label: '审批中', value: 'approving' },
        { label: '已通过', value: 'approved' },
        { label: '已拒绝', value: 'rejected' },
      ],
    },
  ];

  const formFields: FormFieldConfig[] = [
    { key: 'punchDate', label: '补卡日期', type: 'date', required: true, placeholder: '请选择日期' },
    {
      key: 'punchType',
      label: '打卡类型',
      type: 'select',
      required: true,
      placeholder: '请选择打卡类型',
      options: PUNCH_TYPE_OPTIONS,
    },
    { key: 'originalTime', label: '应打卡时间', type: 'input', placeholder: '如 09:00' },
    { key: 'makeupTime', label: '实际打卡时间', type: 'input', placeholder: '如 08:55' },
    { key: 'reason', label: '补卡原因', type: 'textarea', required: true, placeholder: '请输入补卡原因' },
  ];

  const columns: ProTableColumn[] = [
    { title: '补卡日期', dataIndex: 'punchDate', width: 120 },
    {
      title: '打卡类型',
      dataIndex: 'punchType',
      width: 100,
      render: (v: string) => {
        const opt = PUNCH_TYPE_OPTIONS.find((o) => o.value === v);
        return opt ? opt.label : v;
      },
    },
    { title: '应打卡时间', dataIndex: 'originalTime', width: 120 },
    { title: '实际打卡时间', dataIndex: 'makeupTime', width: 120 },
    { title: '补卡原因', dataIndex: 'reason', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={STATUS_MAP} />,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (v: unknown) => formatDateTime(v) },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_: any, record: PunchMakeupRecord) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button type="text" size="small" onClick={() => openEdit(record)}>
                编辑
              </Button>
              <Button type="text" size="small" status="success" onClick={() => handleSubmit(record.id)}>
                提交审批
              </Button>
              <ConfirmButton
                type="text"
                size="small"
                status="danger"
                content="确定删除此补卡申请吗？"
                onConfirm={() => handleDelete(record.id)}
              >
                删除
              </ConfirmButton>
            </>
          )}
          {record.status !== 'pending' && (
            <Button type="text" size="small" onClick={() => openEdit(record)}>
              查看
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '申请补卡', type: 'primary', onClick: openCreate },
    { key: 'export', label: '导出 Excel', onClick: handleExport },
  ];

  return (
    <PageContainer >
      <ProTable
        rowKey="id"
        columns={columns}
        data={data}
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
        title={editing ? '编辑补卡申请' : '申请补卡'}
        fields={formFields}
        initialValues={editing ? {
          punchDate: editing.punchDate,
          punchType: editing.punchType,
          originalTime: editing.originalTime,
          makeupTime: editing.makeupTime,
          reason: editing.reason,
        } : {}}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={modalLoading}
        okText={editing ? '保存' : '创建'}
      />
    </PageContainer>
  );
}
