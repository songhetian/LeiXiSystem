'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Card, Button, Space, Select, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { approvalApi, ApprovedItem } from '@/services/approval';

const instanceStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤销', color: 'gray' },
};

const actionMap: Record<string, { label: string; color: string }> = {
  approved: { label: '已同意', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

const { Option } = Select;

export default function ApprovalApprovedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApprovedItem[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [actionFilter, setActionFilter] = useState<string | undefined>();

  const fetchList = async (page = 1, pageSize = 20, action?: string) => {
    setLoading(true);
    try {
      const result = await approvalApi.listMyApproved({ page, pageSize, status: action });
      if (result.code === 0 && result.data) {
        setData(result.data.list);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1, 20, actionFilter);
  }, [actionFilter]);

  const handlePageChange = (page: number, pageSize: number) => {
    fetchList(page, pageSize, actionFilter);
  };

  const columns = [
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
      render: (v: string) => (
        <Tag color={actionMap[v]?.color || 'gray'}>
          {actionMap[v]?.label || v}
        </Tag>
      ),
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
    <PageContainer title="已办审批" subTitle="查看我审批过的所有申请">
      <Card style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span className="text-text-2">操作筛选：</span>
            <Select
              placeholder="全部"
              style={{ width: 140 }}
              allowClear
              value={actionFilter}
              onChange={setActionFilter}
            >
              <Option value="approved">已同意</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </Space>
        </div>
        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
            showTotal: true,
          }}
        />
      </Card>
    </PageContainer>
  );
}
