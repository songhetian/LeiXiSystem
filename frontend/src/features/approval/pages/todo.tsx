'use client';

import { useState, useEffect } from 'react';
import { Tabs, Table, Button, Space, Modal, Input, Message, Tag, Card } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import DataState from '@/components/DataState';
import { approvalApi, TodoItem, SubmissionItem } from '@/services/approval';
import useFetchState from '@/hooks/use-fetch-state';

const TabPane = Tabs.TabPane;

const approvalStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

interface ListResult<T> {
  list: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ApprovalTodoPage() {
  const [activeTab, setActiveTab] = useState('todos');

  const { data: todoData, loading: todoLoading, error: todoError, run: runFetchTodos, setData: setTodoData } = useFetchState<ListResult<TodoItem>>();
  const [todoPagination, setTodoPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const { data: submissionData, loading: submissionLoading, error: submissionError, run: runFetchSubmissions, setData: setSubmissionData } = useFetchState<ListResult<SubmissionItem>>();
  const [submissionPagination, setSubmissionPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [currentTodo, setCurrentTodo] = useState<TodoItem | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTodos = async (page = 1, pageSize = 20) => {
    await runFetchTodos(async () => {
      const result = await approvalApi.listTodos({ page, pageSize });
      if (result.code === 0 && result.data) {
        setTodoPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
        return result.data;
      }
      throw new Error(result.message || '获取待办列表失败');
    });
  };

  const fetchSubmissions = async (page = 1, pageSize = 20) => {
    await runFetchSubmissions(async () => {
      const result = await approvalApi.listMySubmissions({ page, pageSize });
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

  useEffect(() => {
    fetchTodos(1, 20);
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'submissions' && (!submissionData || submissionData.list.length === 0)) {
      fetchSubmissions(1, 20);
    }
  };

  const handleTodoPageChange = (page: number, pageSize: number) => {
    fetchTodos(page, pageSize);
  };

  const handleSubmissionPageChange = (page: number, pageSize: number) => {
    fetchSubmissions(page, pageSize);
  };

  const openApproveModal = (item: TodoItem) => {
    setActionType('approve');
    setCurrentTodo(item);
    setComment('');
    setActionModalVisible(true);
  };

  const openRejectModal = (item: TodoItem) => {
    setActionType('reject');
    setCurrentTodo(item);
    setComment('');
    setActionModalVisible(true);
  };

  const handleActionOk = async () => {
    if (!currentTodo) return;
    setActionLoading(true);
    try {
      let result;
      if (actionType === 'approve') {
        result = await approvalApi.approve(currentTodo.instanceId, { comment });
      } else {
        result = await approvalApi.reject(currentTodo.instanceId, { comment });
      }
      if (result.code === 0) {
        Message.success(actionType === 'approve' ? '同意成功' : '驳回成功');
        setActionModalVisible(false);
        fetchTodos(todoPagination.current, todoPagination.pageSize);
      } else {
        Message.error(result.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionCancel = () => {
    setActionModalVisible(false);
    setCurrentTodo(null);
    setComment('');
  };

  const todoColumns = [
    { title: '标题', dataIndex: 'title', width: 200 },
    { title: '审批流', dataIndex: 'workflowName', width: 120 },
    { title: '申请人', dataIndex: 'submitterName', width: 100 },
    { title: '部门', dataIndex: 'submitterDepartment', width: 120 },
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
      width: 160,
      render: (_: any, record: TodoItem) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => openApproveModal(record)}
            data-testid="btn-同意"
          >
            同意
          </Button>
          <Button
            status="danger"
            size="small"
            onClick={() => openRejectModal(record)}
            data-testid="btn-驳回"
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const submissionColumns = [
    { title: '标题', dataIndex: 'title', width: 200 },
    { title: '审批流', dataIndex: 'workflowName', width: 120 },
    { title: '当前节点', dataIndex: 'currentNodeName', width: 120 },
    { title: '提交时间', dataIndex: 'submitTime', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={approvalStatusMap} />,
    },
  ];

  return (
    <PageContainer title="审批中心">
      <Tabs activeTab={activeTab} onChange={handleTabChange}>
        <TabPane key="todos" title="待办审批">
          <Card style={{ marginTop: 16 }}>
            <DataState
              loading={todoLoading}
              error={todoError}
              onRetry={() => fetchTodos(todoPagination.current, todoPagination.pageSize)}
              isEmpty={!todoData || todoData.list.length === 0}
            >
              <Table
                columns={todoColumns}
                data={todoData?.list || []}
                rowKey="id"
                pagination={{
                  current: todoPagination.current,
                  pageSize: todoPagination.pageSize,
                  total: todoPagination.total,
                  onChange: handleTodoPageChange,
                  showTotal: true,
                }}
              />
            </DataState>
          </Card>
        </TabPane>
        <TabPane key="submissions" title="我的申请">
          <Card style={{ marginTop: 16 }}>
            <DataState
              loading={submissionLoading}
              error={submissionError}
              onRetry={() => fetchSubmissions(submissionPagination.current, submissionPagination.pageSize)}
              isEmpty={!submissionData || submissionData.list.length === 0}
            >
              <Table
                columns={submissionColumns}
                data={submissionData?.list || []}
                rowKey="id"
                pagination={{
                  current: submissionPagination.current,
                  pageSize: submissionPagination.pageSize,
                  total: submissionPagination.total,
                  onChange: handleSubmissionPageChange,
                  showTotal: true,
                }}
              />
            </DataState>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        visible={actionModalVisible}
        title={actionType === 'approve' ? '同意' : '驳回'}
        onOk={handleActionOk}
        onCancel={handleActionCancel}
        confirmLoading={actionLoading}
        okText="确定"
        cancelText="取消"
        maskClosable={false}
      >
        <div style={{ marginBottom: 12 }}>
          {currentTodo && (
            <div>
              <p><strong>标题：</strong>{currentTodo.title}</p>
              <p><strong>申请人：</strong>{currentTodo.submitterName}</p>
            </div>
          )}
        </div>
        <Input.TextArea
          value={comment}
          onChange={setComment}
          placeholder={actionType === 'approve' ? '请输入审批意见（选填）' : '请输入驳回原因（必填）'}
          style={{ width: '100%', minHeight: 80 }}
        />
      </Modal>
    </PageContainer>
  );
}
