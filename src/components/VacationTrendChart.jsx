import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Spin, Select, ConfigProvider } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';

const VacationTrendChart = ({ employeeId, year }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    if (employeeId) loadTrendData();
  }, [employeeId, months, year]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/vacation/trend-data', { 
        params: { employee_id: employeeId, months, year } 
      });
      if (response.data.success) setData(response.data.data);
    } catch (error) {
      logger.error('加载趋势数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">假期核销趋势分析</span>
        <Select size="small" value={months} onChange={setMonths} className="w-28 font-black" bordered={false} popupClassName="custom-flagship-select-dropdown">
          <Select.Option value={3}>近3个月</Select.Option>
          <Select.Option value={6}>近6个月</Select.Option>
          <Select.Option value={12}>近12个月</Select.Option>
        </Select>
      </div>
      
      <Spin spinning={loading}>
        <div className="h-[240px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '11px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 800 }} />
                <Line type="monotone" dataKey="annual_leave_used" name="年假" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="overtime_leave_used" name="加班假" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="sick_leave_used" name="病假" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-300 font-bold text-[10px] uppercase tracking-widest">
              No trend data available
            </div>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default VacationTrendChart;
