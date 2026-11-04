'use client';

import { useState } from 'react';
import { Tabs, Button, Space, Modal, Input, Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { APPROVAL_RECORD_STATUS as approvalStatusMap } from '@/features/approval/lib/status-maps';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { approvalApi, TodoItem, SubmissionItem } from '@/services/approval';
import { useCachedData } from '@/hooks/use-cached-data';

const TabPane = Tabs.TabPane;


// 分页接口的数据体（code/message 外壳已在 fetcher 中解包）
interface PageData<T> {
  list: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ApprovalTodoPage() {
  const [activeTab, setActiveTab] = useState('todos');

  // SWR 共享缓存：待办 / 我的申请两个列表各一个 hook，翻页参数编入 cacheKey 自动重拉；
  // 两个 Tab 挂载即预取（SWR 语义），切换 Tab 不再手动触发请求
  const [todoPagination, setTodoPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const { data: todoData, loading: todoLoading, error: todoError, revalidate: revalidateTodos } = useCachedData<PageData<TodoItem>>(
    `approval:todo:${todoPagination.current}:${todoPagination.pageSize}`,
    async () => {
      const result = await approvalApi.listTodos({ page: todoPagination.current, pageSize: todoPagination.pageSize });
      if (result.code === 0 && result.data) return result.data;
      throw new Error(result.message || '获取待办列表失败');
    },
  );
  // 有响应时以响应中的分页信息为准；加载中回退本地 state（保留上次 total，防止页码条闪烁）
  const todoPageResult = todoData
    ? { current: todoData.page, pageSize: todoData.pageSize, total: todoData.total }
    : todoPagination;

  const [submissionPagination, setSubmissionPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const { data: submissionData, loading: submissionLoading, error: submissionError, revalidate: revalidateSubmissions } = useCachedData<PageData<SubmissionItem>>(
    `approval:submissions:${submissionPagination.current}:${submissionPagination.pageSize}`,
    async () => {
      const result = await approvalApi.listMySubmissions({ page: submissionPagination.current, pageSize: submissionPagination.pageSize });
      if (result.code === 0 && result.data) return result.data;
      throw new Error(result.message || '获取申请列表失败');
    },
  );
  const submissionPageResult = submissionData
    ? { current: submissionData.page, pageSize: submissionData.pageSize, total: submissionData.total }
    : submissionPagination;

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [currentTodo, setCurrentTodo] = useState<TodoItem | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const handleTodoPageChange = (page: number, pageSize: number) => {
    // 携带上次响应的 total，避免加载新页时页码条闪为 0
    setTodoPagination({ ...todoPageResult, current: page, pageSize });
  };

  const handleSubmissionPageChange = (page: number, pageSize: number) => {
    setSubmissionPagination({ ...submissionPageResult, current: page, pageSize });
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
        // 审批完成后强制刷新待办列表（绕过缓存拉最新数据）
        revalidateTodos();
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

  const todoColumns: ProTableColumn[] = [
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

  const submissionColumns: ProTableColumn[] = [
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
    <PageContainer >
      <Tabs activeTab={activeTab} onChange={handleTabChange}>
        <TabPane key="todos" title="待办审批">
          <div className="pro-card">
            <ProTable
              columns={todoColumns}
              data={todoData?.list ?? []}
              rowKey="id"
              loading={todoLoading}
              error={todoError}
              onRetry={revalidateTodos}
              pagination={{
                current: todoPageResult.current,
                pageSize: todoPageResult.pageSize,
                total: todoPageResult.total,
              }}
              onPageChange={handleTodoPageChange}
            />
          </div>
        </TabPane>
        <TabPane key="submissions" title="我的申请">
          <div className="pro-card">
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
            />
          </div>
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
