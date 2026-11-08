'use client';

import { useState } from 'react';
import { Message, Modal, Descriptions, Table, Divider, Space, Button, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { reimbursementApi, Reimbursement } from '@/services/reimbursement';
import { SearchFieldConfig } from '@/components/SearchForm';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime, formatMoney } from '@/lib/format';
import MoneyText from '@/components/MoneyText';
import ReimbursementForm, { resolveFileUrl } from '@/features/expense/components/ReimbursementForm';

interface ReimbursementListEnvelope {
  code: number;
  message?: string;
  data?: { list: Reimbursement[]; page: number; pageSize: number; total: number };
}

const searchFields: SearchFieldConfig[] = [
  { key: 'keyword', label: '关键词', type: 'input', placeholder: '请输入关键词' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'pending', label: '审批中' },
      { value: 'approving', label: '审批中(复核)' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
      { value: 'cancelled', label: '已撤销' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  pending: { label: '审批中', color: 'arcoblue' },
  approving: { label: '复核中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤销', color: 'orange' },
};

type ConfirmAction = { type: 'delete' | 'cancel'; record: Reimbursement } | null;

export default function MyReimbursementPage() {
  const { can } = usePermission();
  // 11.6-3：新建报销对应 reimbursement:create（seed 中 staff 角色含此自助点），无权限不渲染；
  // 提交/撤销/删除是个人单据自助动作，不套管理权限点
  const canCreate = can('reimbursement:create');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  // SWR 缓存：详情按单据 id 共享缓存，detailId 变化自动重拉；未打开详情时不发请求
  const { data: currentReimbursement, loading: detailLoading, error: detailError } =
    useCachedData<Reimbursement>(
      `expense:my-detail:${detailId ?? 'none'}`,
      async () => {
        if (!detailId) return null as unknown as Reimbursement;
        const result = await reimbursementApi.getDetail(detailId);
        if (result.code === 0 && result.data) return result.data;
        throw new Error(result.message || '获取详情失败');
      },
    );

  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // SWR 缓存：参数编入 cacheKey，搜索/翻页即重新订阅；同参数复用缓存
  const cacheKey = `expense:my-reimbursements:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<ReimbursementListEnvelope>(
    cacheKey,
    () => reimbursementApi.getMyReimbursements({
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...searchParams,
    }),
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

  const handleCreate = () => setCreateModalVisible(true);
  const handleCreateCancel = () => setCreateModalVisible(false);

  const viewDetail = (record: Reimbursement) => {
    setDetailId(record.id);
    setDetailVisible(true);
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
  };

  const handleSubmitApproval = async (record: Reimbursement) => {
    try {
      const result = await reimbursementApi.submitApproval(record.id);
      if (result.code === 0) {
        Message.success('提交成功');
        revalidate();
      } else {
        Message.error(result.message || '提交失败');
      }
    } catch {
      Message.error('提交失败');
    }
  };

  const handleConfirmOk = async () => {
    if (!confirm) return;
    const { type, record } = confirm;
    setActionLoading(true);
    try {
      const result = type === 'delete'
        ? await reimbursementApi.removeReimbursement(record.id)
        : await reimbursementApi.cancelReimbursement(record.id);
      if (result.code === 0) {
        Message.success(type === 'delete' ? '删除成功' : '已撤销');
        setConfirm(null);
        revalidate();
      } else {
        Message.error(result.message || (type === 'delete' ? '删除失败' : '撤销失败'));
      }
    } catch {
      Message.error(type === 'delete' ? '删除失败' : '撤销失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ProTableColumn[] = [
    { title: '标题', dataIndex: 'title', width: 240 },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 120,
      // 11.6-6：金额列负数红色标注
      render: (value: number) => (
        <span style={{ fontWeight: 600 }}>¥ <MoneyText value={value} /></span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    {
      title: '当前审批人',
      dataIndex: 'currentApproverName',
      width: 120,
      render: (value: string) => value || '-',
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 200, render: (v: unknown) => formatDateTime(v) },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_: any, record: Reimbursement) => (
        <Space>
          <Button type="text" size="mini" onClick={(e) => { e.stopPropagation(); viewDetail(record); }}>
            详情
          </Button>
          {record.status === 'draft' && (
            <Button type="text" size="mini" status="success" onClick={(e) => { e.stopPropagation(); handleSubmitApproval(record); }}>
              提交
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'approving') && (
            <Button type="text" size="mini" status="warning" onClick={(e) => { e.stopPropagation(); setConfirm({ type: 'cancel', record }); }}>
              撤销
            </Button>
          )}
          {(record.status === 'draft' || record.status === 'rejected' || record.status === 'cancelled') && (
            <Button type="text" size="mini" status="danger" onClick={(e) => { e.stopPropagation(); setConfirm({ type: 'delete', record }); }}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 11.6-3：无 reimbursement:create 时工具栏不出现「新建报销」入口
  const toolbar: ProTableToolbarAction[] = canCreate
    ? [{ key: 'create', label: '新建报销', type: 'primary', onClick: handleCreate }]
    : [];

  const renderDetailContent = () => {
    if (detailError) {
      return <Empty description={detailError} />;
    }
    if (!currentReimbursement) return null;
    const items = currentReimbursement.items ?? [];

    return (
      <div>
        <Descriptions
          title="基本信息"
          column={2}
          data={[
            { label: '报销单号', value: currentReimbursement.reimbursementNo || '-', span: 2 },
            { label: '标题', value: currentReimbursement.title, span: 2 },
            { label: '报销分类', value: currentReimbursement.typeName || '-' },
            { label: '申请人', value: currentReimbursement.applicantName },
            { label: '部门', value: currentReimbursement.departmentName || '-' },
            { label: '总金额', value: <>¥ <MoneyText value={currentReimbursement.totalAmount} /></> },
            {
              label: '状态',
              value: statusMap[currentReimbursement.status]?.label || currentReimbursement.status,
            },
            { label: '创建时间', value: currentReimbursement.createdAt, span: 2 },
            { label: '事由备注', value: currentReimbursement.description || '-', span: 2 },
          ]}
        />
        <Divider />
        <h4>费用明细</h4>
        {items.length > 0 ? (
          <Table
            data={items}
            rowKey={(r: any) => `${r.id ?? r.itemType ?? r.expenseDate ?? Math.random()}`}
            columns={[
              { title: '费用类型', dataIndex: 'itemType', width: 140, render: (v: string) => v || '-' },
              { title: '产生日期', dataIndex: 'expenseDate', width: 130, render: (v: string) => v || '-' },
              { title: '用途说明', dataIndex: 'description', render: (v: string) => v || '-' },
              { title: '金额', dataIndex: 'amount', width: 120, align: 'center', render: (v: number) => `¥ ${formatMoney(v)}` },
              {
                title: '凭证',
                dataIndex: 'attachmentUrl',
                width: 90,
                render: (v: string) => (v ? <a href={resolveFileUrl(v)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lx-primary)' }}>查看</a> : '-'),
              },
            ]}
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        ) : (
          <div style={{ color: 'var(--lx-text-3)', padding: 8 }}>暂无明细</div>
        )}
        {currentReimbursement.attachments && currentReimbursement.attachments.length > 0 && (
          <>
            <Divider />
            <h4>补充证明附件</h4>
            <Space direction="vertical" style={{ width: '100%' }}>
              {currentReimbursement.attachments.map((att, idx) => (
                <div key={`${att.fileName}-${idx}`} style={{ fontSize: 13 }}>
                  <IconLinkInline />
                  <a
                    href={resolveFileUrl(att.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--lx-primary)', marginLeft: 4 }}
                  >
                    {att.fileName}
                  </a>
                </div>
              ))}
            </Space>
          </>
        )}
        {currentReimbursement.status === 'draft' && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button status="danger" onClick={() => { setConfirm({ type: 'delete', record: currentReimbursement }); handleDetailCancel(); }}>
                删除
              </Button>
              <Button type="primary" onClick={() => { handleSubmitApproval(currentReimbursement); handleDetailCancel(); }}>
                提交审批
              </Button>
            </Space>
          </div>
        )}
      </div>
    );
  };

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
        onRowClick={viewDetail}
      />
      <ReimbursementForm
        visible={createModalVisible}
        onSuccess={() => {
          setCreateModalVisible(false);
          revalidate();
        }}
        onCancel={handleCreateCancel}
      />
      <Modal
        title="报销详情"
        visible={detailVisible}
        onCancel={handleDetailCancel}
        footer={null}
        style={{ width: 760 }}
        maskClosable={false}
      >
        {renderDetailContent()}
      </Modal>
      <Modal
        title={confirm?.type === 'delete' ? '确认删除' : '确认撤销'}
        visible={!!confirm}
        onOk={handleConfirmOk}
        onCancel={() => setConfirm(null)}
        confirmLoading={actionLoading}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ fontSize: 14, color: 'var(--lx-text-2)' }}>
          {confirm?.type === 'delete'
            ? '删除后无法恢复，确定删除该报销单？'
            : '撤销后该报销单将变为草稿状态，确定撤销？'}
        </div>
      </Modal>
    </PageContainer>
  );
}

function IconLinkInline() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" fill="none" style={{ verticalAlign: -1 }}>
      <path
        d="M24 32h-8a8 8 0 1 1 0-16h10m-6 16h8a8 8 0 0 0 0-16h-6"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}