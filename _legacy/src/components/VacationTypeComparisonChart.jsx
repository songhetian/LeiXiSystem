import React from 'react';
import { Card } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const VacationTypeComparisonChart = ({ data }) => {
  // Transform data for type comparison
  const typeData = [
    {
      name: '年假',
      total: data?.annual_leave_total || 0,
      used: data?.annual_leave_used || 0,
      remaining: (data?.annual_leave_total || 0) - (data?.annual_leave_used || 0),
      color: '#1890ff'
    },
    {
      name: '加班假',
      total: data?.overtime_leave_total || 0,
      used: data?.overtime_leave_used || 0,
      remaining: (data?.overtime_leave_total || 0) - (data?.overtime_leave_used || 0),
      color: '#52c41a'
    },
    {
      name: '病假',
      total: data?.sick_leave_total || 0,
      used: data?.sick_leave_used || 0,
      remaining: (data?.sick_leave_total || 0) - (data?.sick_leave_used || 0),
      color: '#faad14'
    }
  ];

  return (
    <Card title="假期类型对比" className="shadow-sm">
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={typeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: '天数', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" name="总额度" fill="#8884d8" />
            <Bar dataKey="used" name="已使用" fill="#82ca9d" />
            <Bar dataKey="remaining" name="剩余" fill="#ffc658" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {typeData.map((item, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border-2 hover:shadow-md transition-shadow"
            style={{ borderColor: item.color }}
          >
            <div className="text-sm text-gray-600 mb-1">{item.name}</div>
            <div className="text-2xl font-bold mb-2" style={{ color: item.color }}>
              {item.remaining.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">
              总额: {item.total.toFixed(1)} | 已用: {item.used.toFixed(1)}
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${item.total > 0 ? (item.used / item.total * 100) : 0}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default VacationTypeComparisonChart;
