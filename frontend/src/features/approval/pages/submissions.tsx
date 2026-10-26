'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Button, Select, Modal, Form, Input, Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import StatusTag from '@/components/StatusTag';
import { approvalApi, SubmissionItem, Workflow } from '@/services/approval';
import useFetchState from '@/hooks/use-fetch-state';
import { notifyError } from '@/lib/request';

const TextArea = Input.TextArea;

const approvalStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤销', color: 'gray' },
};

const MODULE_LABEL: Record<string, string> = {
  leave: '请假',
  overtime: '加班',
  reimbursement: '报销',
  general: '通用',
  procurement: '采购',
};

interface ListResult {
  list: SubmissionItem[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ApprovalSubmissionsPage() {
  const router = useRouter();
  const { data: submissionData, loading: submissionLoading, error: submissionError, run: runFetchSubmissions } = useFetchState<ListResult>();
  const [submissionPagination, setSubmissionPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchSubmissions = async (page = 1, pageSize = 20, status?: string) => {
    await runFetchSubmissions(async () => {
      const result = await approvalApi.listMySubmissions({ page, pageSize, status });
      if (result.code === 0 && result.data) {
        setSubmissionPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
        return result.data;
      }
      throw new Error(result.message || '获取申请列表失败');
    });
  };

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

  useEffect(() => {
    fetchSubmissions(1, 20, statusFilter);
  }, [statusFilter]);

  const handleSubmissionPageChange = (page: number, pageSize: number) => {
    fetchSubmissions(page, pageSize, statusFilter);
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
        fetchSubmissions(1, 20, statusFilter);
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      notifyError(e, '参数校验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submissionColumns = [
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
        <DataState
          loading={submissionLoading}
          error={submissionError}
          onRetry={() => fetchSubmissions(submissionPagination.current, submissionPagination.pageSize, statusFilter)}
          isEmpty={!submissionData || submissionData.list.length === 0}
          emptyText="暂无申请记录"
        >
          <Table
            columns={submissionColumns}
            data={submissionData?.list || []}
            rowKey="id"
            scroll={{ x: true }}
            pagination={{
              current: submissionPagination.current,
              pageSize: submissionPagination.pageSize,
              total: submissionPagination.total,
              onChange: handleSubmissionPageChange,
              showTotal: true,
            }}
          />
        </DataState>
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

