'use client';

import { useState, useEffect } from 'react';
import { Message, Space, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { payrollApi, PayrollRun } from '@/services/payroll';
import { SearchFieldConfig } from '@/components/SearchForm';

const searchFields: SearchFieldConfig[] = [
  { key: 'month', label: '月份', type: 'input', placeholder: 'YYYY-MM' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'confirmed', label: '已确认' },
      { value: 'published', label: '已发布' },
      { value: 'recalled', label: '已撤回' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'arcoblue' },
  confirmed: { label: '已确认', color: 'green' },
  published: { label: '已发布', color: 'purple' },
  recalled: { label: '已撤回', color: 'gray' },
};

const createFormFields: FormFieldConfig[] = [
  {
    key: 'month',
    label: '月份',
    type: 'input',
    placeholder: '请输入月份，如 2026-08',
    required: true,
  },
  {
    key: 'remark',
    label: '备注',
    type: 'input',
    placeholder: '请输入备注（选填）',
  },
];

export default function PayrollRunsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PayrollRun[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const result = await payrollApi.getPayrollRuns({
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
      const result = await payrollApi.createPayrollRun({
        month: values.month,
        remark: values.remark,
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

  const handleViewDetails = (record: PayrollRun) => {
    Message.info(`查看批次 ${record.month} 明细`);
  };

  const handleConfirm = async (record: PayrollRun) => {
    try {
      const result = await payrollApi.confirmPayrollRun(record.id);
      if (result.code === 0) {
        Message.success('确认成功');
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '确认失败');
      }
    } catch (e) {
      Message.error('确认失败');
    }
  };

  const handlePublish = async (record: PayrollRun) => {
    try {
      const result = await payrollApi.publishPayrollRun(record.id);
      if (result.code === 0) {
        Message.success('发布成功');
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '发布失败');
      }
    } catch (e) {
      Message.error('发布失败');
    }
  };

  const handleRecall = async (record: PayrollRun) => {
    try {
      const result = await payrollApi.recallPayrollRun(record.id);
      if (result.code === 0) {
        Message.success('撤回成功');
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '撤回失败');
      }
    } catch (e) {
      Message.error('撤回失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '月份', dataIndex: 'month', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    { title: '员工数', dataIndex: 'totalEmployees', width: 100 },
    { title: '总金额', dataIndex: 'totalAmount', width: 120 },
    { title: '创建人', dataIndex: 'createdByName', width: 120 },
    { title: '创建时间', dataIndex: 'createdAt', width: 200 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 280,
      render: (_: any, record: PayrollRun) => (
        <Space>
          <Button type="text" size="mini" onClick={() => handleViewDetails(record)}>
            明细
          </Button>
          {record.status === 'draft' && (
            <Button type="text" size="mini" status="success" onClick={() => handleConfirm(record)}>
              确认
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Button type="text" size="mini" status="success" onClick={() => handlePublish(record)}>
              发布
            </Button>
          )}
          {record.status === 'published' && (
            <Button type="text" size="mini" status="warning" onClick={() => handleRecall(record)}>
              撤回
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'create', label: '创建批次', type: 'primary', onClick: handleCreate },
  ];

  return (
    <AppLayout title="算薪批次" activeMenu="payroll-runs">
      <PageContainer title="算薪批次">
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
        />
        <ModalForm
          visible={createModalVisible}
          title="创建算薪批次"
          fields={createFormFields}
          onOk={handleCreateOk}
          onCancel={handleCreateCancel}
          confirmLoading={createLoading}
        />
      </PageContainer>
    </AppLayout>
  );
}
