import React, { useState, useEffect } from 'react';
import { Input, DatePicker, Button, Space, Select, Tag } from 'antd';
import { SearchOutlined, CalendarOutlined, ClearOutlined } from '@ant-design/icons';
import { useDebounce, getQuickDateRange, daysBetween } from '../hooks/useVacationHelpers';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const VacationSearchBar = ({ onSearch, loading }) => {
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [quickRange, setQuickRange] = useState(null);

  // 防抖搜索文本
  const debouncedSearchText = useDebounce(searchText, 300);

  // 当防抖值变化时触发搜索
  useEffect(() => {
    handleSearch();
  }, [debouncedSearchText, dateRange]);

  const handleSearch = () => {
    const [startDate, endDate] = dateRange;
    onSearch({
      keyword: debouncedSearchText,
      startDate: startDate ? startDate.format('YYYY-MM-DD') : null,
      endDate: endDate ? endDate.format('YYYY-MM-DD') : null
    });
  };

  const handleQuickRange = (type) => {
    const [start, end] = getQuickDateRange(type);
    if (start && end) {
      setDateRange([dayjs(start), dayjs(end)]);
      setQuickRange(type);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setDateRange([null, null]);
    setQuickRange(null);
  };

  const handleDateChange = (dates) => {
    setDateRange(dates || [null, null]);
    setQuickRange(null); // 清除快捷选择标记
  };

  // 验证日期范围不超过365天
  const disabledDate = (current) => {
    if (!dateRange || !dateRange[0]) {
      return false;
    }
    const tooLate = current && current.diff(dateRange[0], 'days') > 365;
    const tooEarly = current && dateRange[0].diff(current, 'days') > 365;
    return tooEarly || tooLate;
  };

  const quickRangeOptions = [
    { label: '今日', value: 'today', color: 'blue' },
    { label: '本周', value: 'week', color: 'cyan' },
    { label: '本月', value: 'month', color: 'green' },
    { label: '本季度', value: 'quarter', color: 'orange' },
    { label: '本年', value: 'year', color: 'purple' }
  ];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
      <div className="space-y-4">
        {/* 搜索框 */}
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <Input
              placeholder="搜索姓名、工号或审批单号..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="large"
              className="rounded-lg"
            />
          </div>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            size="large"
            className="px-6"
          >
            搜索
          </Button>

          {(searchText || dateRange[0]) && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="large"
            >
              清除
            </Button>
          )}
        </div>

        {/* 日期范围选择 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">日期范围:</span>
          </div>

          {/* 快捷选择按钮 */}
          <Space size="small">
            {quickRangeOptions.map(option => (
              <Tag
                key={option.value}
                color={quickRange === option.value ? option.color : 'default'}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleQuickRange(option.value)}
              >
                {option.label}
              </Tag>
            ))}
          </Space>

          {/* 自定义日期范围 */}
          <RangePicker
            value={dateRange}
            onChange={handleDateChange}
            disabledDate={disabledDate}
            format="YYYY-MM-DD"
            placeholder={['开始日期', '结束日期']}
            className="rounded-lg"
          />

          {/* 显示选中的天数 */}
          {dateRange[0] && dateRange[1] && (
            <span className="text-sm text-gray-500">
              共 {daysBetween(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')) + 1} 天
            </span>
          )}
        </div>

        {/* 提示信息 */}
        {debouncedSearchText !== searchText && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
            正在搜索...
          </div>
        )}
      </div>
    </div>
  );
};

export default VacationSearchBar;
