'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Message,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Descriptions,
  Divider,
  Table,
  type TableColumnProps,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import ProTable from '@/components/ProTable';
import type { ProTableColumn } from '@/components/ProTable';
import { reimbursementApi, Reimbursement, ReimbursementItem } from '@/services/reimbursement';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime } from '@/lib/format';
import MoneyText from '@/components/MoneyText';

// 审批状态统一走公共 StatusTag
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending: { label: '待提交', color: 'warning' },
  approving: { label: '审批中', color: 'info' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已驳回', color: 'danger' },
};

/** 审批明细子表：金额统一走 MoneyText（负数标红、千分位与两位小数） */
const detailItemColumns: TableColumnProps<ReimbursementItem>[] = [
  { title: '费用名称', dataIndex: 'description', render: (value) => value || '-' },
  { title: '日期', dataIndex: 'expenseDate', width: 140, render: (value) => value || '-' },
  {
    title: '金额',
    dataIndex: 'amount',
    width: 140,
    align: 'center',
    render: (value) => (
      <>
        ¥ <MoneyText value={value} fallback="0.00" />
      </>
    ),
  },
];

interface ApprovalListEnvelope {
  code: number;
  message?: string;
  data?: { list: Reimbursement[]; page?: number; pageSize?: number; total?: number };
}

export default function ExpenseApprovalPage() {
  const router = useRouter();
  const { can } = usePermission();
  // 11.6-3：通过/驳回对应 reimbursement:approve（seed 中 staff 无此点，仅审批角色可见），
  // 无权限时写操作按钮不渲染，查看保留
  const canApprove = can('reimbursement:approve');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<Reimbursement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  // 动作提交的目标直接用列表行 / 详情里的 record，避免依赖详情接口返回时机
  const [actionTarget, setActionTarget] = useState<Reimbursement | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // SWR 缓存：参数编入 cacheKey，翻页即重新订阅；同参数复用缓存
  const cacheKey = `expense:approvals:${pagination.current}:${pagination.pageSize}`;
  const { data: res, loading, error, revalidate } = useCachedData<ApprovalListEnvelope>(
    cacheKey,
    () => reimbursementApi.getPendingApprovals({ page: pagination.current, pageSize: pagination.pageSize }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? {
        current: res.data.page || 1,
        pageSize: res.data.pageSize || 20,
        total: res.data.total || 0,
      }
    : pagination;

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const openDetail = async (item: Reimbursement) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await reimbursementApi.getDetail(item.id);
      if (res.code === 0 && res.data) {
        setCurrentItem(res.data);
      }
    } catch (e) {
      Message.error('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const openAction = (type: 'approve' | 'reject', target: Reimbursement) => {
    setActionType(type);
    setActionTarget(target);
    setComment('');
  };

  const closeAction = () => {
    setActionType(null);
    setActionTarget(null);
  };

  const handleAction = async () => {
    // 竞态修复：详情接口可能还没返回，提交目标以点击时传入的 record 为准
    if (!actionTarget || !actionType) return;
    // 驳回原因必填：空串/纯空格一律拦截，不发起请求
    if (actionType === 'reject' && !comment.trim()) {
      Message.warning('请输入驳回原因');
      return;
    }
    setActionLoading(true);
    try {
      const payloadComment = actionType === 'reject' ? comment.trim() : comment;
      const res = await reimbursementApi[actionType](actionTarget.id, { comment: payloadComment });
      if (res.code === 0) {
        Message.success(actionType === 'approve' ? '已通过' : '已驳回');
        closeAction();
        setDetailVisible(false);
        revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ProTableColumn[] = [
    {
      title: '工单号',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (v: string, record: Reimbursement) => (
        <a onClick={() => openDetail(record)}>{v}</a>
      ),
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 120,
      // 11.6-6：金额列负数红色标注
      render: (v: number) => (
        <span className="font-medium text-text-1">¥ <MoneyText value={v} fallback="0.00" /></span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={STATUS_MAP} />,
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: unknown) => formatDateTime(v),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 180,
      render: (_v: any, record: Reimbursement) => (
        <Space>
          <Button size="mini" onClick={() => openDetail(record)}>
            查看
          </Button>
          {canApprove && (
            <Button size="mini" type="primary" onClick={() => { openDetail(record); openAction('approve', record); }}>
              通过
            </Button>
          )}
          {canApprove && (
            <Button size="mini" status="danger" onClick={() => { openDetail(record); openAction('reject', record); }}>
              驳回
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        pagination={{
          current: pageResult.current,
          pageSize: pageResult.pageSize,
          total: pageResult.total,
        }}
        onPageChange={handlePageChange}
        emptyElement={<span className="text-text-3">暂无待审批报销单</span>}
      />

      <Modal
        title="报销单详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {currentItem && canApprove && (currentItem.status === 'approving' || currentItem.status === 'pending') && (
              <>
                <Button status="danger" onClick={() => openAction('reject', currentItem)}>
                  驳回
                </Button>
                <Button type="primary" onClick={() => openAction('approve', currentItem)}>
                  通过
                </Button>
              </>
            )}
          </Space>
        }
        style={{ width: 680 }}
      >
        {detailLoading ? (
          <div className="text-center py-10">加载中...</div>
        ) : currentItem ? (
          <>
            <Descriptions
              column={2}
              data={[
                { label: '标题', value: currentItem.title },
                { label: '金额', value: <span className="font-medium text-text-1">¥ <MoneyText value={currentItem.totalAmount} fallback="0.00" /></span> },
                { label: '申请人', value: currentItem.applicantName },
                { label: '部门', value: currentItem.departmentName || '-' },
                { label: '状态', value: <StatusTag status={currentItem.status} statusMap={STATUS_MAP} /> },
                { label: '申请时间', value: currentItem.createdAt },
              ]}
            />
            {currentItem.description && (
              <>
                <Divider />
                <div>
                  <div className="font-medium mb-2">说明</div>
                  <div className="text-text-2">{currentItem.description}</div>
                </div>
              </>
            )}
            {currentItem.items && currentItem.items.length > 0 && (
              <>
                <Divider />
                <div>
                  <div className="font-medium mb-2">明细</div>
                  <Table
                    rowKey={(item) => String(item.id ?? item.expenseDate ?? item.name)}
                    size="small"
                    border={false}
                    pagination={false}
                    columns={detailItemColumns}
                    data={currentItem.items}
                  />
                </div>
              </>
            )}
          </>
        ) : null}
      </Modal>

      <Modal
        title={actionType === 'approve' ? '通过审批' : '驳回审批'}
        visible={!!actionType}
        onOk={handleAction}
        onCancel={closeAction}
        confirmLoading={actionLoading}
        okText={actionType === 'approve' ? '确认通过' : '确认驳回'}
      >
        <Form layout="vertical">
          <Form.Item label={actionType === 'approve' ? '审批意见（可选）' : '驳回原因'}>
            <Input.TextArea
              rows={3}
              value={comment}
              onChange={(v) => setComment(v)}
              placeholder={actionType === 'approve' ? '请输入审批意见' : '请输入驳回原因'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
