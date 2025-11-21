import React, { useState, useEffect } from 'react';
import { Card, Spin, message, Select } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getApiBaseUrl } from '../utils/apiConfig';

const { Option } = Select;

const VacationTrendChart = ({ employeeId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    if (employeeId) {
      loadTrendData();
    }
  }, [employeeId, months]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiBaseUrl()}/vacation/trend-data?employee_id=${employeeId}&months=${months}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        message.error(result.message || '加载趋势数据失败');
      }
    } catch (error) {
      console.error('加载趋势数据失败:', error);
      message.error('加载趋势数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="假期使用趋势"
      extra={
        <Select value={months} onChange={setMonths} style={{ width: 120 }}>
          <Option value={3}>近3个月</Option>
          <Option value={6}>近6个月</Option>
          <Option value={12}>近12个月</Option>
        </Select>
      }
      className="shadow-sm"
    >
      <Spin spinning={loading}>
        <div style={{ height: 350 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  label={{ value: '月份', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  label={{ value: '天数', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="annual_leave_used"
                  name="年假使用"
                  stroke="#1890ff"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="overtime_leave_used"
                  name="加班假使用"
                  stroke="#52c41a"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="sick_leave_used"
                  name="病假使用"
                  stroke="#faad14"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              暂无数据
            </div>
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default VacationTrendChart;
