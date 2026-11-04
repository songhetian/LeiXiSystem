'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { approvalApi, ApprovedItem } from '@/services/approval';
import { useCachedData } from '@/hooks/use-cached-data';

const instanceStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤销', color: 'gray' },
};

// 审批动作状态（StatusTag 色值规范：green→success、red→danger）
const actionMap: Record<string, { label: string; color: string }> = {
  approved: { label: '已同意', color: 'success' },
  rejected: { label: '已驳回', color: 'danger' },
};

const { Option } = Select;

export default function ApprovalApprovedPage() {
  const router = useRouter();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [actionFilter, setActionFilter] = useState<string | undefined>();

  // SWR 缓存：翻页/筛选参数编入 cacheKey，同参数复用缓存
  const cacheKey = `approval:approved:${pagination.current}:${pagination.pageSize}:${actionFilter ?? ''}`;
  const { data: res, loading, error, revalidate } = useCachedData<{
    code: number;
    data?: { list: ApprovedItem[]; page: number; pageSize: number; total: number };
  }>(
    cacheKey,
    () => approvalApi.listMyApproved({ page: pagination.current, pageSize: pagination.pageSize, status: actionFilter }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const columns: ProTableColumn[] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      render: (v: string, record: ApprovedItem) => (
        <a
          style={{ cursor: 'pointer' }}
          onClick={() => router.push(`/approval/instances/${record.instanceId}`)}
        >
          {v}
        </a>
      ),
    },
    { title: '审批流', dataIndex: 'workflowName', width: 120 },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    { title: '审批节点', dataIndex: 'nodeName', width: 120 },
    {
      title: '我的操作',
      dataIndex: 'action',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={actionMap} />,
    },
    {
      title: '当前状态',
      dataIndex: 'instanceStatus',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={instanceStatusMap} />,
    },
    { title: '审批时间', dataIndex: 'handledAt', width: 160 },
    {
      title: '操作',
      dataIndex: 'action',
      width: 80,
      render: (_: any, record: ApprovedItem) => (
        <Button
          size="small"
          type="text"
          onClick={() => router.push(`/approval/instances/${record.instanceId}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="pro-card">
        <div className="pro-toolbar pro-toolbar-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-3">操作筛选</span>
            <Select
              placeholder="全部"
              style={{ width: 140 }}
              allowClear
              value={actionFilter}
              onChange={(v) => {
                setActionFilter(v);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            >
              <Option value="approved">已同意</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </div>
        </div>
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
          emptyElement={<Empty description="暂无已办审批" />}
        />
      </div>
    </PageContainer>
  );
}
