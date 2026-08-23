'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Table, Descriptions, Tag, Space, Divider } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { payslipApi, Payslip, PayslipDetail, PayslipItem } from '@/services/payslip';
import { SearchFieldConfig } from '@/components/SearchForm';

const searchFields: SearchFieldConfig[] = [
  { key: 'month', label: '月份', type: 'input', placeholder: 'YYYY-MM' },
];

const statusMap: Record<string, { label: string; color: string }> = {
  unviewed: { label: '未查看', color: 'arcoblue' },
  viewed: { label: '已查看', color: 'gray' },
};

export default function MyPayslipsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payslip[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentPayslip, setCurrentPayslip] = useState<PayslipDetail | null>(null);

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await payslipApi.getMyPayslips({
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
    } catch (e: any) {
      setError(e?.message || '加载失败');
      notifyError(e, '加载失败');
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

  const handleViewDetail = async (record: Payslip) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const result = await payslipApi.getMyPayslipDetail(record.id);
      if (result.code === 0 && result.data) {
        setCurrentPayslip(result.data);
        if (result.data.status === 'unviewed') {
          await payslipApi.markAsViewed(record.id);
          fetchData(pagination.current, pagination.pageSize, searchParams);
        }
      } else {
        Message.error(result.message || '获取明细失败');
      }
    } catch (e) {
      Message.error('获取明细失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
    setCurrentPayslip(null);
  };

  const columns: ProTableColumn[] = [
    { title: '月份', dataIndex: 'month', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    { title: '基本工资', dataIndex: 'baseSalary', width: 120 },
    { title: '应发合计', dataIndex: 'totalIncome', width: 120 },
    { title: '扣款合计', dataIndex: 'totalDeduction', width: 120 },
    {
      title: '实发工资',
      dataIndex: 'netSalary',
      width: 120,
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#00B42A' }}>{value}</span>
      ),
    },
    { title: '发放时间', dataIndex: 'createdAt', width: 200 },
  ];

  const renderDetailContent = () => {
    if (!currentPayslip) return null;

    const incomeItems = currentPayslip.items.filter((item: PayslipItem) => item.type === 'income');
    const deductionItems = currentPayslip.items.filter((item: PayslipItem) => item.type === 'deduction');
    const adjustmentItems = currentPayslip.adjustments || [];

    return (
      <div>
        <Descriptions
          title="基本信息"
          column={2}
          data={[
            { label: '工号', value: currentPayslip.employeeNo },
            { label: '姓名', value: currentPayslip.employeeName },
            { label: '部门', value: currentPayslip.departmentName },
            { label: '月份', value: currentPayslip.month },
          ]}
        />
        <Divider />
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <div>
            <Tag color="green">应发合计</Tag>
            <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 8 }}>
              {currentPayslip.totalIncome}
            </span>
          </div>
          <div>
            <Tag color="red">扣款合计</Tag>
            <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 8 }}>
              {currentPayslip.totalDeduction}
            </span>
          </div>
          <div>
            <Tag color="arcoblue">实发工资</Tag>
            <span style={{ fontSize: 20, fontWeight: 700, marginLeft: 8, color: '#165DFF' }}>
              {currentPayslip.netSalary}
            </span>
          </div>
        </div>
        <Divider />
        <h4>收入明细</h4>
        <Table
          data={incomeItems}
          columns={[
            { title: '项目', dataIndex: 'name', width: 200 },
            { title: '金额', dataIndex: 'amount', width: 120 },
          ]}
          pagination={false}
          size="small"
        />
        {deductionItems.length > 0 && (
          <>
            <Divider />
            <h4>扣款明细</h4>
            <Table
              data={deductionItems}
              columns={[
                { title: '项目', dataIndex: 'name', width: 200 },
                { title: '金额', dataIndex: 'amount', width: 120 },
              ]}
              pagination={false}
              size="small"
            />
          </>
        )}
        {adjustmentItems.length > 0 && (
          <>
            <Divider />
            <h4>调整项</h4>
            <Table
              data={adjustmentItems}
              columns={[
                { title: '项目', dataIndex: 'name', width: 200 },
                { title: '金额', dataIndex: 'amount', width: 120 },
              ]}
              pagination={false}
              size="small"
            />
          </>
        )}
      </div>
    );
  };

  return (
    <PageContainer title="我的工资条">
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => fetchData(pagination.current, pagination.pageSize, searchParams)}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        pagination={pagination}
        onPageChange={handlePageChange}
        onRowClick={handleViewDetail}
      />
      <Modal
        title="工资条明细"
        visible={detailVisible}
        onCancel={handleDetailCancel}
        confirmLoading={detailLoading}
        okText="关闭"
        cancelText={null}
        onOk={handleDetailCancel}
        style={{ width: 720 }}
      >
        {renderDetailContent()}
      </Modal>
    </PageContainer>
  );
}
