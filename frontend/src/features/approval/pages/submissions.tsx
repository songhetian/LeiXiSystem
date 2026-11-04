'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, Modal, Form, Input, Message, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { APPROVAL_INSTANCE_STATUS as approvalStatusMap } from '@/features/approval/lib/status-maps';
import { approvalApi, SubmissionItem, Workflow } from '@/services/approval';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

const TextArea = Input.TextArea;


const MODULE_LABEL: Record<string, string> = {
  leave: '请假',
  overtime: '加班',
  reimbursement: '报销',
  general: '通用',
  procurement: '采购',
};

// 分页接口的数据体（code/message 外壳已在 fetcher 中解包）
interface PageData {
  list: SubmissionItem[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ApprovalSubmissionsPage() {
  const router = useRouter();
  const [submissionPagination, setSubmissionPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // SWR 共享缓存：分页与状态筛选编入 cacheKey，参数变化自动重拉
  const { data: submissionData, loading: submissionLoading, error: submissionError, revalidate: revalidateSubmissions } = useCachedData<PageData>(
    `approval:submissions:${submissionPagination.current}:${submissionPagination.pageSize}:${statusFilter ?? ''}`,
    async () => {
      const result = await approvalApi.listMySubmissions({
        page: submissionPagination.current,
        pageSize: submissionPagination.pageSize,
        status: statusFilter,
      });
      if (result.code === 0 && result.data) return result.data;
      throw new Error(result.message || '获取申请列表失败');
    },
  );
  // 有响应时以响应中的分页信息为准；加载中回退本地 state（保留上次 total，防止页码条闪烁）
  const submissionPageResult = submissionData
    ? { current: submissionData.page, pageSize: submissionData.pageSize, total: submissionData.total }
    : submissionPagination;

  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchWorkflows = async () => {
    try {
      const res = await approvalApi.listAvailableWorkflows();
      if (res.code === 0 && res.data) {
        setWorkflows(res.data);
      }
    } catch (e) {
      // 忽略，用户可能没有权限
    }
  };

  const handleSubmissionPageChange = (page: number, pageSize: number) => {
    // 携带上次响应的 total，避免加载新页时页码条闪为 0
    setSubmissionPagination({ ...submissionPageResult, current: page, pageSize });
  };

  const openApplyModal = () => {
    fetchWorkflows();
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setSubmitting(true);
      const res = await approvalApi.startInstance({
        workflowCode: values.workflowCode,
        title: values.title,
        formData: values.formData ? { 说明: values.formData } : undefined,
      });
      if (res.code === 0) {
        Message.success('提交成功');
        setModalVisible(false);
        // 提交成功后回到第一页：已在第一页则强制刷新（绕过缓存），否则由 cacheKey 变化自动重拉
        if (submissionPagination.current === 1) {
          revalidateSubmissions();
        } else {
          setSubmissionPagination({ ...submissionPageResult, current: 1 });
        }
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      notifyError(e, '参数校验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submissionColumns: ProTableColumn[] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      render: (v: string, record: SubmissionItem) => (
        <a
          style={{ cursor: 'pointer' }}
          onClick={() => router.push(`/approval/instances/${record.instanceId}`)}
        >
          {v}
        </a>
      ),
    },
    { title: '审批中', dataIndex: 'workflowName', width: 120 },
    { title: '当前节点', dataIndex: 'currentNodeName', width: 120 },
    { title: '提交时间', dataIndex: 'submitTime', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={approvalStatusMap} />,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_: any, record: SubmissionItem) => (
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
            <span className="text-sm text-text-3">状态筛选</span>
            <Select
              placeholder="全部"
              style={{ width: 140 }}
              allowClear
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v || '');
                setSubmissionPagination((p) => ({ ...p, current: 1 }));
              }}
              options={[
                { value: 'pending', label: '审批人' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' },
              ]}
            />
          </div>
          <Button type="primary" onClick={openApplyModal}>
            发起申请
          </Button>
        </div>
        <ProTable
          columns={submissionColumns}
          data={submissionData?.list ?? []}
          rowKey="id"
          loading={submissionLoading}
          error={submissionError}
          onRetry={revalidateSubmissions}
          pagination={{
            current: submissionPageResult.current,
            pageSize: submissionPageResult.pageSize,
            total: submissionPageResult.total,
          }}
          onPageChange={handleSubmissionPageChange}
          emptyElement={<Empty description="暂无申请记录" />}
        />
      </div>

      <Modal
        title="发起审批申请"
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 520 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="审批流程" field="workflowCode" rules={[{ required: true, message: '请选择审批流程' }]}>
            <Select
              placeholder="请选择审批流程"
              showSearch
              options={workflows.map(w => ({
                value: w.code,
                label: `${w.name} - ${MODULE_LABEL[w.module] || w.module}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="申请标题" field="title" rules={[{ required: true, message: '请输入申请标题' }]}>
            <Input placeholder="请输入申请标题" />
          </Form.Item>
          <Form.Item label="申请说明" field="formData">
            <TextArea
              placeholder="请输入申请说明（可选）"
              style={{ width: '100%', minHeight: 100 }}
              autoSize={{ minRows: 4 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

