'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Descriptions, Table, Divider, Tag, Space, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { reimbursementApi, Reimbursement, ReimbursementType } from '@/services/reimbursement';
import { SearchFieldConfig } from '@/components/SearchForm';

const searchFields: SearchFieldConfig[] = [
  { key: 'keyword', label: '关键词', type: 'input', placeholder: '请输入关键词' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'pending', label: '审批中' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  pending: { label: '审批中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

const createFormFields: FormFieldConfig[] = [
  {
    key: 'title',
    label: '标题',
    type: 'input',
    placeholder: '请输入报销标题',
    required: true,
  },
  {
    key: 'totalAmount',
    label: '总金额',
    type: 'input',
    placeholder: '请输入总金额',
    required: true,
  },
  {
    key: 'description',
    label: '说明',
    type: 'input',
    placeholder: '请输入报销说明',
  },
];

export default function MyReimbursementPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Reimbursement[]>([]);
  const [types, setTypes] = useState<ReimbursementType[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentReimbursement, setCurrentReimbursement] = useState<Reimbursement | null>(null);

  const fetchTypes = async () => {
    try {
      const result = await reimbursementApi.getTypes();
      if (result.code === 0 && result.data) {
        setTypes(result.data);
      }
    } catch (e) {
      Message.error('获取报销类型失败');
    }
  };

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const result = await reimbursementApi.getMyReimbursements({
        page,
        pageSize,
        ...params,
      });
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
    fetchTypes();
    fetchData(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchData(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchData(1, pagination.pageSize, {});
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize, searchParams);
  };

  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  const handleCreateCancel = () => {
    setCreateModalVisible(false);
  };

  const handleCreateOk = async (values: Record<string, any>) => {
    setCreateLoading(true);
    try {
      const result = await reimbursementApi.createReimbursement({
        title: values.title,
        totalAmount: Number(values.totalAmount),
        description: values.description,
        items: [],
      });
      if (result.code === 0) {
        Message.success('创建成功');
        setCreateModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '创建失败');
      }
    } catch (e) {
      Message.error('创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewDetail = async (record: Reimbursement) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const result = await reimbursementApi.getDetail(record.id);
      if (result.code === 0 && result.data) {
        setCurrentReimbursement(result.data);
      } else {
        Message.error(result.message || '获取详情失败');
      }
    } catch (e) {
      Message.error('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
    setCurrentReimbursement(null);
  };

  const handleSubmitApproval = async (record: Reimbursement) => {
    try {
      const result = await reimbursementApi.submitApproval(record.id);
      if (result.code === 0) {
        Message.success('提交成功');
        fetchData(pagination.current, pagination.pageSize, searchParams);
        setDetailVisible(false);
      } else {
        Message.error(result.message || '提交失败');
      }
    } catch (e) {
      Message.error('提交失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '标题', dataIndex: 'title', width: 240 },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 120,
      render: (value: number) => (
        <span style={{ fontWeight: 600 }}>{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    {
      title: '当前审批人',
      dataIndex: 'currentApproverName',
      width: 120,
      render: (value: string) => value || '-',
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 200 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 150,
      render: (_: any, record: Reimbursement) => (
        <Space>
          <Button type="text" size="mini" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'draft' && (
            <Button type="text" size="mini" status="success" onClick={() => handleSubmitApproval(record)}>
              提交
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'create', label: '新建报销', type: 'primary', onClick: handleCreate },
  ];

  const renderDetailContent = () => {
    if (!currentReimbursement) return null;

    return (
      <div>
        <Descriptions
          title="基本信息"
          column={2}
          data={[
            { label: '标题', value: currentReimbursement.title, span: 2 },
            { label: '申请人', value: currentReimbursement.applicantName },
            { label: '部门', value: currentReimbursement.departmentName },
            { label: '总金额', value: `¥${currentReimbursement.totalAmount}` },
            {
              label: '状态',
              value: statusMap[currentReimbursement.status]?.label || currentReimbursement.status,
            },
            { label: '创建时间', value: currentReimbursement.createdAt, span: 2 },
            { label: '说明', value: currentReimbursement.description || '-', span: 2 },
          ]}
        />
        <Divider />
        <h4>报销明细</h4>
        <Table
          data={currentReimbursement.items}
          columns={[
            { title: '类型', dataIndex: 'typeName', width: 150 },
            { title: '日期', dataIndex: 'date', width: 120 },
            { title: '说明', dataIndex: 'description' },
            { title: '金额', dataIndex: 'amount', width: 120 },
          ]}
          pagination={false}
          size="small"
        />
        {currentReimbursement.status === 'draft' && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button type="primary" onClick={() => handleSubmitApproval(currentReimbursement)}>
              提交审批
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout title="我的报销" activeMenu="my-reimbursement">
      <PageContainer title="我的报销">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          toolbar={toolbar}
          pagination={pagination}
          onPageChange={handlePageChange}
          onRowClick={handleViewDetail}
        />
        <ModalForm
          visible={createModalVisible}
          title="新建报销"
          fields={createFormFields}
          onOk={handleCreateOk}
          onCancel={handleCreateCancel}
          confirmLoading={createLoading}
        />
        <Modal
          title="报销详情"
          visible={detailVisible}
          onCancel={handleDetailCancel}
          confirmLoading={detailLoading}
          okText={null}
          cancelText="关闭"
          footer={null}
          style={{ width: 720 }}
        >
          {renderDetailContent()}
        </Modal>
      </PageContainer>
    </AppLayout>
  );
}
