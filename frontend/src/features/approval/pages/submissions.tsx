'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Card, Button, Space, Select, Modal, Form, Input, Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { approvalApi, SubmissionItem, Workflow } from '@/services/approval';
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

export default function ApprovalSubmissionsPage() {
  const router = useRouter();
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionData, setSubmissionData] = useState<SubmissionItem[]>([]);
  const [submissionPagination, setSubmissionPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchSubmissions = async (page = 1, pageSize = 20, status?: string) => {
    setSubmissionLoading(true);
    try {
      const result = await approvalApi.listMySubmissions({ page, pageSize, status });
      if (result.code === 0 && result.data) {
        setSubmissionData(result.data.list);
        setSubmissionPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } finally {
      setSubmissionLoading(false);
    }
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
    } catch (e: any) {
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
    <PageContainer title="我的申请" subTitle="查看我发起的所有审批申请">
      <Card style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span className="text-text-2">状态筛选：</span>
            <Select
              placeholder="全部"
              style={{ width: 140 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'pending', label: '审批人' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' },
              ]}
            />
          </Space>
          <Button type="primary" onClick={openApplyModal}>
            发起申请
          </Button>
        </div>
        <Table
          columns={submissionColumns}
          data={submissionData}
          rowKey="id"
          loading={submissionLoading}
          pagination={{
            current: submissionPagination.current,
            pageSize: submissionPagination.pageSize,
            total: submissionPagination.total,
            onChange: handleSubmissionPageChange,
            showTotal: true,
          }}
        />
      </Card>

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

