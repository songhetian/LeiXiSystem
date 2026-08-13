'use client';

import { useState, useEffect } from 'react';
import { Message } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { attendanceApi, DailyRecord } from '@/services/attendance';
import { SearchFieldConfig } from '@/components/SearchForm';

const searchFields: SearchFieldConfig[] = [
  { key: 'employeeNo', label: '工号', type: 'input', placeholder: '请输入工号' },
  { key: 'startDate', label: '开始日期', type: 'input', placeholder: 'YYYY-MM-DD' },
  { key: 'endDate', label: '结束日期', type: 'input', placeholder: 'YYYY-MM-DD' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'normal', label: '正常' },
      { value: 'abnormal', label: '异常' },
      { value: 'leave', label: '请假' },
      { value: 'absent', label: '旷工' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'green' },
  abnormal: { label: '异常', color: 'red' },
  leave: { label: '请假', color: 'arcoblue' },
  absent: { label: '旷工', color: 'orangered' },
};

export default function AttendanceDailyPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyRecord[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const result = await attendanceApi.getDailyList({
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

  const handleRecalc = async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    try {
      const result = await attendanceApi.recalcDaily({
        startDate: startOfMonth,
        endDate: endOfMonth,
      });
      if (result.code === 0) {
        Message.success(`重新计算完成，更新 ${result.data?.updated || 0} 条记录`);
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '计算失败');
      }
    } catch (e) {
      Message.error('计算失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '班次', dataIndex: 'shiftName', width: 100 },
    { title: '工时(小时)', dataIndex: 'workHours', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'recalc', label: '重新计算', type: 'primary', onClick: handleRecalc },
  ];

  return (
    <AppLayout title="考勤日报" activeMenu="attendance-daily">
      <PageContainer title="考勤日报">
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
      </PageContainer>
    </AppLayout>
  );
}
