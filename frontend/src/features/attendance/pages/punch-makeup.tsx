'use client';

import { useState, useEffect } from 'react';
import { Message, Tag, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { SearchFieldConfig } from '@/components/SearchForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { punchMakeupApi, PunchMakeupRecord } from '@/services/attendance';
import { notifyError } from '@/lib/request';
import { exportToExcel } from '@/lib/excel';

const PUNCH_TYPE_OPTIONS = [
  { label: '上班卡', value: 'morning' },
  { label: '下班卡', value: 'evening' },
  { label: '午休上班', value: 'noon_morning' },
  { label: '午休下班', value: 'noon_evening' },
];

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'gray', text: '待提交' },
  approving: { color: 'arcoblue', text: '审批中' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
};

export default function PunchMakeupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PunchMakeupRecord[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<PunchMakeupRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await punchMakeupApi.list({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      } else {
        setError(res.message || '获取补卡记录失败');
        Message.error(res.message || '获取补卡记录失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取补卡记录失败');
      notifyError(e, '获取补卡记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchData(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchData(1, pagination.pageSize, {});
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize, searchParams);
  };

  // 导出补卡记录到 Excel
  const handleExport = async () => {
    try {
      const res = await punchMakeupApi.list({ page: 1, pageSize: 10000, ...searchParams });
      const list = (res.data?.list ?? []) as PunchMakeupRecord[];
      const typeLabel = (v: string) => PUNCH_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
      if (!exportToExcel(
        `补卡申请_${new Date().toISOString().slice(0, 10)}.xlsx`,
        '补卡申请',
        [
          { title: '补卡日期', dataIndex: 'punchDate' },
          { title: '打卡类型', value: (r: PunchMakeupRecord) => typeLabel(r.punchType) },
          { title: '应打卡时间', dataIndex: 'originalTime' },
          { title: '实际打卡时间', dataIndex: 'makeupTime' },
          { title: '补卡原因', dataIndex: 'reason' },
          { title: '状态', value: (r: PunchMakeupRecord) => STATUS_MAP[r.status]?.text ?? r.status },
          { title: '创建时间', dataIndex: 'createdAt' },
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
          fetchData(pagination.current, pagination.pageSize, searchParams);
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
          fetchData(pagination.current, pagination.pageSize, searchParams);
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
        fetchData(pagination.current, pagination.pageSize, searchParams);
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
        fetchData(pagination.current, pagination.pageSize, searchParams);
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
      render: (v: string) => {
        const info = STATUS_MAP[v] || { color: 'gray', text: v };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
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
    <PageContainer title="补卡申请">
      <ProTable
        rowKey="id"
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        onRetry={() => fetchData(pagination.current, pagination.pageSize, searchParams)}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pagination}
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
