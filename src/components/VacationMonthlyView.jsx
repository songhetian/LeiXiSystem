import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Spin, message, DatePicker, Button, Space } from 'antd';
import { CalendarOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';
import { formatDateTime } from '../utils/date';
import dayjs from 'dayjs';
import OvertimeConversionModal from './OvertimeConversionModal';

const VacationMonthlyView = ({ employeeId, year: initialYear }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [year, setYear] = useState(initialYear || dayjs().year());
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [conversionModalVisible, setConversionModalVisible] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (employeeId) {
      loadMonthlyData();
    }
    fetchHolidays();
  }, [employeeId, year, month]);

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/holidays?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Filter for current month
        const currentMonthHolidays = result.data.filter(h => dayjs(h.date).month() + 1 === month);
        setHolidays(currentMonthHolidays);
      }
    } catch (error) {
      console.error('Failed to fetch holidays', error);
    }
  };

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiBaseUrl()}/vacation/usage-details?employee_id=${employeeId}&year=${year}&month=${month}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        message.error(result.message || '加载月度数据失败');
      }
    } catch (error) {
      console.error('加载月度数据失败:', error);
      message.error('加载月度数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeTag = (type) => {
    const typeMap = {
      'addition': { color: 'green', text: '增加' },
      'deduction': { color: 'red', text: '扣减' },
      'conversion': { color: 'blue', text: '转换' },
      'adjustment': { color: 'orange', text: '调整' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getLeaveTypeTag = (type) => {
    const typeMap = {
      'annual_leave': { color: 'blue', text: '年假' },
      'sick_leave': { color: 'orange', text: '病假' },
      'overtime_leave': { color: 'green', text: '加班假' },
      'personal_leave': { color: 'default', text: '事假' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 100,
      render: (type) => getChangeTypeTag(type)
    },
    // {
    //   title: '假期类型',
    //   dataIndex: 'leave_type',
    //   key: 'leave_type',
    //   width: 100,
    //   render: (type) => getLeaveTypeTag(type)
    // },
    {
      title: '变更数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => (
        <span className={amount > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
          {amount > 0 ? '+' : ''}{amount} 天
        </span>
      )
    },
    {
      title: '变更后余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 120,
      render: (val) => val != null ? `${val} 天` : '-'
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100
    }
  ];

  // Calculate monthly summary
  const summary = data.reduce((acc, item) => {
    if (item.change_type === 'deduction') {
      acc.totalUsed += Math.abs(parseFloat(item.amount || 0));
    } else if (item.change_type === 'addition') {
      acc.totalAdded += parseFloat(item.amount || 0);
    }
    return acc;
  }, { totalUsed: 0, totalAdded: 0 });

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined />
          <span>月度使用明细</span>
        </div>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={() => setConversionModalVisible(true)}
          >
            加班转假期
          </Button>
          <DatePicker
            picker="month"
            value={dayjs(`${year}-${String(month).padStart(2, '0')}`)}
            onChange={(date) => {
              if (date) {
                setYear(date.year());
                setMonth(date.month() + 1);
              }
            }}
            format="YYYY年MM月"
          />
          <Button icon={<ReloadOutlined />} onClick={loadMonthlyData}>
            刷新
          </Button>
        </Space>
      }
      className="shadow-sm"
    >
      {/* Summary Row */}
      <div className="mb-4 space-y-4">
        {/* Special Dates Alert */}
        {holidays.length > 0 && (
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-orange-800">本月特殊日期:</span>
            {holidays.map(h => (
              <div key={h.date} className="flex items-center gap-1 text-sm">
                <span className="text-gray-600">{dayjs(h.date).format('MM-DD')}</span>
                <span className="font-medium text-gray-800">{h.name}</span>
                <Tag color={h.type === 'holiday' ? 'red' : 'blue'}>
                  {h.type === 'holiday' ? '休' : '班'}
                </Tag>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-600">本月统计：</span>
            <span className="ml-4 text-green-600 font-semibold">新增 {summary.totalAdded.toFixed(1)} 天</span>
            <span className="ml-4 text-red-600 font-semibold">使用 {summary.totalUsed.toFixed(1)} 天</span>
            <span className="ml-4 text-blue-600 font-semibold">
              净变化 {(summary.totalAdded - summary.totalUsed).toFixed(1)} 天
            </span>
          </div>
          <div className="text-sm text-gray-500">
            共 {data.length} 条记录
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Spin>

      <OvertimeConversionModal
        visible={conversionModalVisible}
        onClose={() => setConversionModalVisible(false)}
        employeeId={employeeId}
        onSuccess={loadMonthlyData}
      />
    </Card>
  );
};

export default VacationMonthlyView;
