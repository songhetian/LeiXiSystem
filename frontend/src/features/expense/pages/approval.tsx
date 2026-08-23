'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Message,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Descriptions,
  Card,
  Divider,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { reimbursementApi, Reimbursement } from '@/services/reimbursement';
import { usePermission } from '@/hooks/use-permission';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  pending: { label: '待提交', color: 'orange' },
  approving: { label: '审批中', color: 'blue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

export default function ExpenseApprovalPage() {
  const { can } = usePermission();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Reimbursement[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<Reimbursement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await reimbursementApi.getPendingApprovals({ page, pageSize });
      if (res.code === 0 && res.data) {
        setData(res.data.list || []);
        setPagination({
          current: res.data.page || 1,
          pageSize: res.data.pageSize || 20,
          total: res.data.total || 0,
        });
      }
    } catch (e) {
      Message.error('获取待审批列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

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

  const openAction = (type: 'approve' | 'reject') => {
    setActionType(type);
    setComment('');
  };

  const handleAction = async () => {
    if (!currentItem || !actionType) return;
    setActionLoading(true);
    try {
      const res = await reimbursementApi[actionType](currentItem.id, { comment });
      if (res.code === 0) {
        Message.success(actionType === 'approve' ? '已通过' : '已驳回');
        setActionType(null);
        setDetailVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
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
      render: (v: number) => <span className="font-medium text-text-1">¥{v?.toFixed(2) || '0.00'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const info = STATUS_MAP[v] || STATUS_MAP.draft;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      width: 180,
      render: (_v: any, record: Reimbursement) => (
        <Space>
          <Button size="mini" onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button size="mini" type="primary" onClick={() => { openDetail(record); setTimeout(() => openAction('approve'), 300); }}>
            通过
          </Button>
          <Button size="mini" status="danger" onClick={() => { openDetail(record); setTimeout(() => openAction('reject'), 300); }}>
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="报销审批">
      <Card className="rounded-md">
        <Table
          loading={loading}
          columns={columns as any}
          data={data}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: true,
            sizeCanChange: true,
            onChange: (page, pageSize) => fetchList(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title="报销单详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {currentItem && (currentItem.status === 'approving' || currentItem.status === 'pending') && (
              <>
                <Button status="danger" onClick={() => openAction('reject')}>
                  驳回
                </Button>
                <Button type="primary" onClick={() => openAction('approve')}>
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
                { label: '金额', value: <span className="font-medium text-text-1">¥{currentItem.totalAmount?.toFixed(2)}</span> },
                { label: '申请人', value: currentItem.applicantName },
                { label: '部门', value: currentItem.departmentName || '-' },
                { label: '状态', value: (
                  <Tag color={(STATUS_MAP[currentItem.status] || STATUS_MAP.draft).color}>
                    {(STATUS_MAP[currentItem.status] || STATUS_MAP.draft).label}
                  </Tag>
                ) },
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
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border-2">
                        <th className="text-left p-2">费用名称</th>
                        <th className="text-left p-2">日期</th>
                        <th className="text-right p-2">金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItem.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border-2">
                          <td className="p-2">{item.description || '-'}</td>
                          <td className="p-2">{item.date || '-'}</td>
                          <td className="p-2 text-right">¥{item.amount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        onCancel={() => setActionType(null)}
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
