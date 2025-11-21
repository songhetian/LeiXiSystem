import React from 'react';
import { Card, Tag, Button, Space, Progress } from 'antd';
import {
  UserOutlined, CalendarOutlined, ClockCircleOutlined,
  EyeOutlined, SwapOutlined, SettingOutlined
} from '@ant-design/icons';

const VacationCard = ({ employee, onViewDetail, onConvert, onEditQuota }) => {
  // Calculate remaining balances
  const annualRemaining = (employee.annual_leave_total || 0) - (employee.annual_leave_used || 0);
  const overtimeRemaining = (employee.overtime_leave_total || 0) - (employee.overtime_leave_used || 0);
  const totalRemaining = annualRemaining + overtimeRemaining;
  const overtimeHoursRemaining = (employee.overtime_hours_total || 0) - (employee.overtime_hours_converted || 0);

  // Calculate usage percentage
  const totalDays = employee.total_days || 0;
  const usedDays = (employee.annual_leave_used || 0) + (employee.overtime_leave_used || 0);
  const usagePercent = totalDays > 0 ? (usedDays / totalDays * 100) : 0;

  return (
    <Card
      className="vacation-card hover:shadow-lg transition-shadow duration-300 rounded-xl border-2 border-gray-200"
      bodyStyle={{ padding: '16px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <UserOutlined className="text-blue-600 text-xl" />
          </div>
          <div>
            <div className="font-bold text-lg text-gray-800">{employee.real_name}</div>
            <div className="text-sm text-gray-500">{employee.employee_no}</div>
          </div>
        </div>
        <Tag color="blue">{employee.department_name}</Tag>
      </div>

      {/* Balance Summary */}
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">假期余额</span>
          <span className="text-2xl font-bold text-blue-600">{totalRemaining.toFixed(1)} 天</span>
        </div>
        <Progress
          percent={100 - usagePercent}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          showInfo={false}
          size="small"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>已用: {usedDays.toFixed(1)} 天</span>
          <span>总额: {totalDays.toFixed(1)} 天</span>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">
            <CalendarOutlined className="mr-1" />
            年假
          </div>
          <div className="text-lg font-bold text-blue-600">{annualRemaining.toFixed(1)}</div>
          <div className="text-xs text-gray-500">{employee.annual_leave_total || 0} 天</div>
        </div>

        <div className="p-2 bg-green-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">
            <CalendarOutlined className="mr-1" />
            加班假
          </div>
          <div className="text-lg font-bold text-green-600">{overtimeRemaining.toFixed(1)}</div>
          <div className="text-xs text-gray-500">{employee.overtime_leave_total || 0} 天</div>
        </div>

        <div className="p-2 bg-purple-50 rounded-lg col-span-2">
          <div className="text-xs text-gray-600 mb-1">
            <ClockCircleOutlined className="mr-1" />
            加班时长
          </div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-purple-600">{overtimeHoursRemaining.toFixed(1)} 小时</div>
            <div className="text-xs text-gray-500">
              可转 {(overtimeHoursRemaining / 8).toFixed(1)} 天
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => onViewDetail(employee)}
          className="flex-1"
          size="large"
        >
          详情
        </Button>
        <Button
          icon={<SwapOutlined />}
          onClick={() => onConvert(employee)}
          disabled={overtimeHoursRemaining < 8}
          size="large"
        >
          转换
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={() => onEditQuota(employee)}
          size="large"
        >
          额度
        </Button>
      </div>
    </Card>
  );
};

export default VacationCard;
