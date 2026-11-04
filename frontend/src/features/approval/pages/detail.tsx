'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  Message,
  Timeline,
  Divider,
  Empty,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import DataState from '@/components/DataState';
import { approvalApi, InstanceDetail, ApprovalRecord } from '@/services/approval';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import {
  APPROVAL_INSTANCE_STATUS as approvalStatusMap,
  APPROVAL_RECORD_STATUS as recordStatusMap,
} from '@/features/approval/lib/status-maps';


const MODULE_LABEL: Record<string, string> = {
  leave: '请假',
  overtime: '加班',
  reimbursement: '报销',
  general: '通用',
  procurement: '采购',
};

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermission();
  const id = Number(params?.id);

  // SWR 共享缓存：详情按 id 编入 cacheKey，id 变化自动重拉
  const { data: detail, loading, error, revalidate } = useCachedData<InstanceDetail>(
    `approval:detail:${id}`,
    async () => {
      if (!id) throw new Error('获取详情失败');
      const res = await approvalApi.getInstance(id);
      if (res.code === 0 && res.data) return res.data;
      throw new Error(res.message || '获取详情失败');
    },
  );

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const openApproveModal = () => {
    setActionType('approve');
    setComment('');
    setActionModalVisible(true);
  };

  const openRejectModal = () => {
    setActionType('reject');
    setComment('');
    setActionModalVisible(true);
  };

  const handleActionOk = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      let result;
      if (actionType === 'approve') {
        result = await approvalApi.approve(detail.id, { comment });
      } else {
        result = await approvalApi.reject(detail.id, { comment });
      }
      if (result.code === 0) {
        Message.success(actionType === 'approve' ? '同意成功' : '驳回成功');
        setActionModalVisible(false);
        // 审批完成后强制重拉详情（绕过缓存取最新状态与审批记录）
        revalidate();
      } else {
        Message.error(result.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const isPending = detail?.status === 'pending';

  const renderFormData = (formData?: Record<string, any>) => {
    if (!formData || Object.keys(formData).length === 0) {
      return <Empty description="暂无表单数据" />;
    }
    const data = Object.entries(formData).map(([key, value]) => ({
      label: key,
      value: String(value ?? '-'),
    }));
    return <Descriptions column={1} border size="small" data={data} />;
  };

  const renderTimeline = (records: ApprovalRecord[]) => {
    if (!records || records.length === 0) {
      return <Empty description="暂无审批记录" />;
    }
    return (
      <Timeline>
        {records.map((record, index) => (
          <Timeline.Item
            key={record.id}
            dotColor={
              record.action === 'approved'
                ? 'green'
                : record.action === 'rejected'
                ? 'red'
                : 'blue'
            }
            label={record.operateTime}
          >
            <div style={{ marginBottom: 4 }}>
              <Space>
                <span style={{ fontWeight: 500 }}>{record.nodeName}</span>
                <Tag
                  color={
                    recordStatusMap[record.action]?.color || 'gray'
                  }
                  size="small"
                >
                  {recordStatusMap[record.action]?.label || record.action}
                </Tag>
              </Space>
            </div>
            <div className="text-text-2 text-sm">
              审批人：{record.approverName || '-'}
            </div>
            {record.comment && (
              <div className="mt-1.5 p-2 bg-bg-tertiary rounded text-sm">
                {record.comment}
              </div>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  return (
      <PageContainer
      >
        <DataState loading={loading} error={error} onRetry={revalidate} isEmpty={!detail}>
          {detail && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
                      {detail.title}
                    </div>
                    <Space>
                      <Tag color="gray">{MODULE_LABEL[detail.module] || detail.module}</Tag>
                      <StatusTag
                        status={detail.status}
                        statusMap={approvalStatusMap}
                      />
                    </Space>
                  </div>
                  {isPending && can('approval:todo:view') && (
                    <Space>
                      <Button type="primary" onClick={openApproveModal}>
                        同意
                      </Button>
                      <Button status="danger" onClick={openRejectModal}>
                        驳回
                      </Button>
                    </Space>
                  )}
                </div>

                <Descriptions
                  column={3}
                  border
                  size="small"
                  data={[
                    { label: '审批中', value: detail.workflowName },
                    { label: '申请人', value: detail.submitterName },
                    { label: '申请部门', value: detail.submitterDepartment || '-' },
                    { label: '提交时间', value: detail.submitTime || '-' },
                  ]}
                />
              </Card>

              <Card
                title="表单内容"
                style={{ marginBottom: 16 }}
                size="small"
              >
                {renderFormData(detail.formData)}
              </Card>

              <Card title="审批流程" size="small">
                {renderTimeline(detail.records)}
              </Card>
            </>
          )}
        </DataState>

        <Modal
          visible={actionModalVisible}
          title={actionType === 'approve' ? '同意审批' : '驳回审批'}
          onOk={handleActionOk}
          onCancel={() => setActionModalVisible(false)}
          confirmLoading={actionLoading}
          okText="确定"
          cancelText="取消"
          maskClosable={false}
        >
          <div style={{ marginBottom: 12 }}>
            {detail && (
              <div>
                <p>
                  <span className="text-text-2">标题</span>
                  {detail.title}
                </p>
                <p>
                  <span className="text-text-2">申请人：</span>
                  {detail.submitterName}
                </p>
              </div>
            )}
          </div>
          <Input.TextArea
            value={comment}
            onChange={setComment}
            placeholder={
              actionType === 'approve'
                ? '请输入审批意见（选填）'
                : '请输入驳回原因（必填）'
            }
            style={{ width: '100%', minHeight: 100 }}
          />
        </Modal>
      </PageContainer>
  );
}
